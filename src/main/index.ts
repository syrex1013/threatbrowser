import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import logger from '../logger/logger'
import { runPixelscanFingerprintCheck } from './pixelscan'
import { deleteConfig, listConfigs, saveConfig } from './configService'
import { registerAutomationIpc } from './automationApi'
import { checkProxies, createDefaultCheckerDeps, type CheckTarget } from './proxyChecker'
import {
  cookiesToNetscape,
  cookiesToMozilla,
  parseCookiesJson,
  parseCookiesNetscape,
  parseCookiesMozilla
} from './cookieFormats'
import type { Campaign } from './campaignTypes'
import { validateCampaign } from './campaignTypes'
import {
  loadProfiles,
  launchProfile,
  CreateProfile,
  editProfile,
  DeleteProfile,
  stopProfile,
  exportProfilesBundle,
  importProfilesBundle,
  bulkCreateProfiles,
  collectCookies,
  launchOneTimeProfile,
  verifyProfilePassword
} from './profileService'
import {
  testProxy,
  CreateProxy,
  DeleteProxy,
  GetProxies,
  editProxy,
  getProxyCountry
} from './proxyService'
import { PROXY_SOURCES, scrapeProxies } from './proxyScraper'
import { CampaignEngine, CampaignStore } from './campaignService'
import type { Profile, ProfileConfig } from '../shared/profileSettings'
import type { ProxyData } from './types'
import { enginePlatform } from './profileValidation'

const datadir = process.env.THREATBROWSER_DATA_DIR || (is.dev ? __dirname : app.getPath('userData'))
fs.mkdirSync(datadir, { recursive: true })

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 670,
    minWidth: 1400,
    minHeight: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Launch Profile
  ipcMain.handle('launch-profile', async (_, profile: Profile, password?: string) => {
    logger.info(`[electron-main] launch-profile: ${profile.id}`)
    return await launchProfile(profile, password)
  })
  ipcMain.addListener('profile-closed', function closelistener(arg1) {
    logger.info(`[electron-main] profile-closed: ${arg1.id}`)
    // Focus-based delivery drops the event when the profile browser had focus
    // at close time; every window re-derives running/stopped from this event.
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('profile-closed', arg1)
    }
  })
  // Load profiles
  ipcMain.handle('load-profiles', async () => {
    logger.info('[electron-main] load-profiles')
    return await loadProfiles()
  })

  // Create Profile
  ipcMain.handle('create-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] create-profile: ${profile.id}`)
    return await CreateProfile(profile)
  })

  // edit-profile
  ipcMain.handle('edit-profile', async (_, profile: Profile, currentPassword?: string) => {
    logger.info(`[electron-main] update-profile: ${profile.id}`)
    return await editProfile(profile, currentPassword)
  })

  // delete profile
  ipcMain.handle('delete-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] delete-profile: ${profile.id}`)
    return await DeleteProfile(profile)
  })

  // create proxy
  ipcMain.handle('create-proxy', async (_, proxy: ProxyData | string) => {
    logger.info('[electron-main] create-proxy')
    return await CreateProxy(proxy)
  })

  // delete proxy
  ipcMain.handle('delete-proxy', async (_, proxy: ProxyData) => {
    logger.info(`[electron-main] delete-proxy: ${proxy.id}`)
    await DeleteProxy(proxy)
  })

  // get proxies
  ipcMain.handle('load-proxies', async () => {
    logger.info('[electron-main] get-proxies')
    const proxies = await GetProxies()
    return proxies
  })

  // edit proxy
  ipcMain.handle('edit-proxy', async (_, editProxyData: ProxyData) => {
    logger.info(`[electron-main] edit-proxy: ${editProxyData.id}`)
    return await editProxy(editProxyData)
  })

  // get-proxy-country
  ipcMain.handle('get-proxy-country', async (_, proxy: string) => {
    logger.info('[electron-main] get-proxy-country')
    return await getProxyCountry(proxy)
  })
  // test proxy
  ipcMain.handle('test-proxy', async (_, proxy: string) => {
    logger.info('[electron-main] test-proxy')
    return await testProxy(proxy)
  })

  // List public scrape sources (name + protocol).
  ipcMain.handle('proxies:sources', async () => {
    return PROXY_SOURCES.map((source) => ({ name: source.name, protocol: source.protocol }))
  })

  // Harvest free proxies from public sources.
  ipcMain.handle('proxies:scrape', async (_, payload: { sources?: string[] } = {}) => {
    logger.info('[electron-main] proxies:scrape')
    const sources = Array.isArray(payload?.sources)
      ? payload.sources.filter((s): s is string => typeof s === 'string')
      : undefined
    return await scrapeProxies({ sources })
  })

  // Batch-check proxies: liveness, latency, anonymity, country.
  ipcMain.handle(
    'proxies:check',
    async (_, payload: { proxies: CheckTarget[]; concurrency?: number }) => {
      logger.info('[electron-main] proxies:check')
      if (
        !payload ||
        !Array.isArray(payload.proxies) ||
        payload.proxies.length === 0 ||
        payload.proxies.length > 500
      ) {
        throw new Error('Payload must include 1-500 proxies')
      }
      for (const proxy of payload.proxies) {
        if (!proxy || typeof proxy.host !== 'string' || !Number.isFinite(proxy.port)) {
          throw new Error('Each proxy needs a host and port')
        }
      }
      const concurrency = Math.max(1, Math.min(payload.concurrency ?? 10, 20))
      const checked = await checkProxies(payload.proxies, createDefaultCheckerDeps(), {
        concurrency
      })
      return checked.map((entry) => entry.result)
    }
  )

  ipcMain.handle(
    'pixelscan:fingerprint-check',
    async (_, payload: { profileId?: number; password?: string }) => {
      logger.info(
        `[electron-main] pixelscan:fingerprint-check profileId=${payload.profileId ?? 'auto'}`
      )
      return await runPixelscanFingerprintCheck(payload)
    }
  )

  // Stop a launched profile window.
  ipcMain.handle('profile:stop', async (_, profileId: number) => {
    logger.info(`[electron-main] profile:stop ${profileId}`)
    await stopProfile(profileId)
  })
  ipcMain.handle('profiles:engine-info', async (_, payload: { browserVersion?: string }) => {
    if (
      !payload ||
      typeof payload !== 'object' ||
      (payload.browserVersion !== undefined && typeof payload.browserVersion !== 'string')
    )
      throw new Error('Profile invalid: browserVersion must be a string')
    const { binaryInfo } = await import('cloakbrowser')
    try {
      return {
        platform: enginePlatform(),
        chromiumVersion: binaryInfo(payload.browserVersion || undefined).version
      }
    } catch {
      return { platform: enginePlatform(), chromiumVersion: null }
    }
  })

  // Verify a profile password (scrypt) for the launch/edit gate.
  ipcMain.handle('profile:verify-password', async (_, profileId: number, password: string) => {
    return verifyProfilePassword(profileId, password)
  })

  // Bulk-create profiles from a reusable config.
  ipcMain.handle(
    'profiles:bulk-create',
    async (_, config: ProfileConfig, count: number, prefix: string) => {
      logger.info(`[electron-main] profiles:bulk-create count=${count}`)
      try {
        return { profiles: await bulkCreateProfiles(config, count, prefix) }
      } catch (error) {
        const createdIds: number[] =
          error &&
          typeof error === 'object' &&
          'createdIds' in error &&
          Array.isArray(error.createdIds)
            ? error.createdIds.filter(
                (id): id is number => typeof id === 'number' && Number.isSafeInteger(id)
              )
            : []
        const profiles = createdIds.length
          ? (await loadProfiles()).filter((profile) => createdIds.includes(profile.id))
          : []
        return { profiles, error: error instanceof Error ? error.message : 'Bulk creation failed' }
      }
    }
  )

  // Collect cookies from a set of domains into the profile store.
  ipcMain.handle(
    'cookies:collect',
    async (_, profileId: number, domains: string[], password?: string) => {
      const profile = (await loadProfiles()).find((p) => p.id === profileId)
      if (!profile) throw new Error(`Profile ${profileId} not found`)
      return await collectCookies(profile, domains, password)
    }
  )

  // Launch a one-time (temporary, auto-deleted on close) profile.
  ipcMain.handle(
    'profile:launch-one-time',
    async (_, data: { profileId: number; password?: string }) => {
      logger.info(`[electron-main] profile:launch-one-time`)
      return await launchOneTimeProfile(data)
    }
  )

  // Regenerate the persistent engine fingerprint seed and persist it.
  ipcMain.handle(
    'profile:regenerate-fingerprint',
    async (_, profileId: number, password?: string) => {
      logger.info(`[electron-main] profile:regenerate-fingerprint ${profileId}`)
      const profiles = await loadProfiles()
      const profile = profiles.find((p) => p.id === profileId)
      if (!profile) throw new Error(`Profile ${profileId} not found`)
      profile.seed = Math.floor(Math.random() * 90000) + 10000
      await editProfile(profile, password)
      return profile
    }
  )

  // Export a bundle of profiles (by id; all when empty).
  ipcMain.handle('profiles:export', async (_, ids: number[]) => {
    return await exportProfilesBundle(ids)
  })

  // Export a bundle through a save dialog.
  ipcMain.handle('profiles:export-file', async (_, ids: number[]) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export profiles',
      defaultPath: join(
        app.getPath('downloads'),
        `threatbrowser-profiles-${new Date().toISOString().slice(0, 10)}.json`
      ),
      filters: [{ name: 'ThreatBrowser profiles', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    const contents = await exportProfilesBundle(ids)
    fs.writeFileSync(filePath, contents, 'utf8')
    return filePath
  })

  // Import a bundle through an open dialog; existing ids are skipped.
  ipcMain.handle('profiles:import-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import profiles',
      properties: ['openFile'],
      filters: [{ name: 'ThreatBrowser profiles', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return null
    const contents = fs.readFileSync(filePaths[0], 'utf8')
    const result = await importProfilesBundle(contents)
    return { path: filePaths[0], ...result }
  })

  // Config manager: named reusable option-sets.
  ipcMain.handle('configs:list', async () => listConfigs())
  ipcMain.handle('configs:save', async (_, config: ProfileConfig) => saveConfig(config))
  ipcMain.handle('configs:delete', async (_, id: number) => deleteConfig(id))

  // Local automation API (127.0.0.1, token auth).
  registerAutomationIpc()
  // Tail of the application log file.
  ipcMain.handle('logs:read', async () => {
    const logFile = join(process.env.THREATBROWSER_DATA_DIR || app.getPath('userData'), 'app.log')
    if (!fs.existsSync(logFile)) return ''
    const contents = fs.readFileSync(logFile, 'utf8')
    const lines = contents.split(/\r?\n/)
    return lines.slice(-1200).join('\n')
  })

  // Clear the application log file.
  ipcMain.handle('logs:clear', async () => {
    const logDir = process.env.THREATBROWSER_DATA_DIR || app.getPath('userData')
    fs.mkdirSync(logDir, { recursive: true })
    const logFile = join(logDir, 'app.log')
    fs.writeFileSync(logFile, '', 'utf8')
  })

  // LOGGING USING IPC TO MAINTAIN ORDER

  ipcMain.on('log-info', async (_, message) => {
    logger.info(message)
  })

  ipcMain.on('log-error', async (_, message) => {
    logger.error(message)
  })

  ipcMain.on('log-debug', async (_, message) => {
    logger.debug(message)
  })

  ipcMain.handle(
    'cookies:export',
    async (_, payload: { cookies: string; format?: 'json' | 'netscape' | 'mozilla' }) => {
      const format = payload.format ?? 'json'
      try {
        if (format === 'json') return payload.cookies
        const parsed = parseCookiesJson(payload.cookies)
        return format === 'netscape' ? cookiesToNetscape(parsed) : cookiesToMozilla(parsed)
      } catch (error) {
        logger.error('[electron-main] cookies:export failed')
        throw error
      }
    }
  )

  ipcMain.handle(
    'cookies:import',
    async (_, payload: { contents: string; format?: 'json' | 'netscape' | 'mozilla' }) => {
      const format = payload.format ?? 'json'
      try {
        const parsed =
          format === 'json'
            ? parseCookiesJson(payload.contents)
            : format === 'netscape'
              ? parseCookiesNetscape(payload.contents)
              : parseCookiesMozilla(payload.contents)
        return JSON.stringify(parsed)
      } catch (error) {
        logger.error('[electron-main] cookies:import failed')
        throw error
      }
    }
  )

  // Campaign engine: validation stays in campaignTypes; execution lives in campaignService.
  const campaignEngine = new CampaignEngine((channel, payload) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send(channel, payload)
  })
  const store = new CampaignStore(path.join(datadir, 'campaigns.json'))

  ipcMain.handle('campaigns:list', async () => campaignEngine.listRuns())
  ipcMain.handle('campaigns:save', async (_, campaign: Campaign) => {
    if (!campaign || typeof campaign.id !== 'string' || !Array.isArray(campaign.steps)) {
      throw new Error('Campaign invalid: id and steps are required')
    }
    const validated = validateCampaign(campaign)
    if (!validated.ok) throw new Error(`Invalid campaign: ${validated.errors.join('; ')}`)
    return store.save({ ...campaign, updatedAt: Date.now() })
  })
  ipcMain.handle('campaigns:get', async (_, id: string) => store.get(id) ?? null)
  ipcMain.handle('campaigns:delete', async (_, id: string) => store.remove(id))

  ipcMain.handle(
    'campaigns:run',
    async (_, payload: { campaign: Campaign; profileIds?: number[] }) => {
      const validated = validateCampaign(payload.campaign)
      if (!validated.ok) {
        const msg = validated.errors.join('; ')
        logger.error('[electron-main] campaigns:run invalid: %s', msg)
        throw new Error(`Invalid campaign: ${msg}`)
      }
      const profiles = await loadProfiles()
      const wanted = Array.isArray(payload.profileIds)
        ? payload.profileIds
        : [payload.profileIds?.[0] ?? profiles[0]?.id]
      const resolved = wanted.filter(
        (id): id is number => Number.isSafeInteger(id) && profiles.some((p) => p.id === id)
      )
      if (resolved.length === 0) throw new Error('No valid profile selected for campaign')
      if (typeof payload.campaign.concurrency === 'number' && payload.campaign.concurrency > 1) {
        // Parallel execution, concurrency at most resolved.length.
        const limited = Math.min(payload.campaign.concurrency, resolved.length)
        const runIds: string[] = []
        let cursor = 0
        await Promise.all(
          Array.from({ length: limited }, async () => {
            while (cursor < resolved.length) {
              const profileId = resolved[cursor]
              cursor += 1
              const runId = await campaignEngine.launchRun({
                campaign: payload.campaign,
                profileId
              })
              runIds.push(runId)
              await campaignEngine
                .executeSteps(runId, { campaign: payload.campaign, profileId })
                .catch(() => undefined)
            }
          })
        )
        return { runIds }
      }
      const runIds: string[] = []
      for (const profileId of resolved) {
        // eslint-disable-next-line no-await-in-loop
        const runId = await campaignEngine.launchRun({ campaign: payload.campaign, profileId })
        runIds.push(runId)
        // eslint-disable-next-line no-await-in-loop
        await campaignEngine
          .executeSteps(runId, { campaign: payload.campaign, profileId })
          .catch(() => undefined)
      }
      return { runIds }
    }
  )

  ipcMain.handle('campaigns:stop', async (_, runId: string) => campaignEngine.stop(runId))

  ipcMain.handle('campaigns:run:get', async (_, payload: { runId: string }) => {
    return campaignEngine.getRun(payload.runId)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
