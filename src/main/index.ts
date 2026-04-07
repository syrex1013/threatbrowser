import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { cookiesToNetscape, parseCookiesJson, parseCookiesNetscape } from './cookieFormats'
import { type Campaign, type CampaignRun, type CampaignRunEvent, validateCampaign } from './campaignTypes'
import {
  loadProfiles,
  launchProfile,
  CreateProfile,
  editProfile,
  DeleteProfile
} from './profileService'
import {
  testProxy,
  CreateProxy,
  DeleteProxy,
  GetProxies,
  editProxy,
  getProxyCountry
} from './proxyService'

import logger from '../logger/logger'
import { Profile, ProxyData } from './types'

puppeteer.use(StealthPlugin())

type CampaignRunState = {
  run: CampaignRun
  campaign: Campaign
  events: CampaignRunEvent[]
}

const campaignRuns = new Map<string, CampaignRunState>()

function addCampaignEvent(runId: string, event: CampaignRunEvent): void {
  const run = campaignRuns.get(runId)
  if (!run) return
  run.events.push(event)
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.send('campaigns:run:event', { runId, event })
}

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
  ipcMain.handle('launch-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] launch-profile: ${profile.id}`)
    return await launchProfile(profile)
  })
  ipcMain.addListener('profile-closed', function closelistener(arg1) {
    logger.info(`[electron-main] profile-closed: ${JSON.stringify(arg1)}`)
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.send('profile-closed', arg1)
    }
  })
  // Load profiles
  ipcMain.handle('load-profiles', async () => {
    logger.info('[electron-main] load-profiles')
    return await loadProfiles()
  })

  // Create Profile
  ipcMain.handle('create-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] create-profile: ${JSON.stringify(profile)}`)
    return await CreateProfile(profile)
  })

  // edit-profile
  ipcMain.handle('edit-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] update-profile: ${JSON.stringify(profile)}`)
    return await editProfile(profile)
  })

  // delete profile
  ipcMain.handle('delete-profile', async (_, profile: Profile) => {
    logger.info(`[electron-main] delete-profile: ${JSON.stringify(profile)}`)
    return await DeleteProfile(profile)
  })

  // create proxy
  ipcMain.handle('create-proxy', async (_, proxy: ProxyData | string) => {
    logger.info(`[electron-main] create-proxy: ${JSON.stringify(proxy)}`)
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
    logger.info(`[electron-main] edit-proxy: ${editProxyData.id} ${JSON.stringify(editProxyData)}`)
    return await editProxy(editProxyData)
  })

  // get-proxy-country
  ipcMain.handle('get-proxy-country', async (_, proxy: string) => {
    logger.info(`[electron-main] get-proxy-country: ${proxy}`)
    return await getProxyCountry(proxy)
  })

  // test proxy
  ipcMain.handle('test-proxy', async (_, proxy: string) => {
    logger.info(`[electron-main] test-proxy: ${proxy}`)
    return await testProxy(proxy)
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

  ipcMain.handle('cookies:export', async (_, payload: { cookies: string; format?: 'json' | 'netscape' }) => {
    const format = payload.format ?? 'json'
    try {
      if (format === 'json') return payload.cookies
      const parsed = parseCookiesJson(payload.cookies)
      return cookiesToNetscape(parsed)
    } catch (error) {
      logger.error(`[electron-main] cookies:export error: ${error}`)
      throw error
    }
  })

  ipcMain.handle(
    'cookies:import',
    async (_, payload: { contents: string; format?: 'json' | 'netscape' }) => {
      const format = payload.format ?? 'json'
      try {
        const parsed =
          format === 'json' ? parseCookiesJson(payload.contents) : parseCookiesNetscape(payload.contents)
        return JSON.stringify(parsed)
      } catch (error) {
        logger.error(`[electron-main] cookies:import error: ${error}`)
        throw error
      }
    }
  )

  ipcMain.handle('campaigns:run', async (_, payload: { campaign: Campaign; profileId?: number }) => {
    const validated = validateCampaign(payload.campaign)
    if (!validated.ok) {
      const msg = validated.errors.join('; ')
      logger.error(`[electron-main] campaigns:run invalid: ${msg}`)
      throw new Error(`Invalid campaign: ${msg}`)
    }

    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const run: CampaignRun = {
      id: runId,
      campaignId: payload.campaign.id,
      status: 'running',
      startedAt: Date.now(),
      logs: []
    }
    const state: CampaignRunState = { run, campaign: payload.campaign, events: [] }
    campaignRuns.set(runId, state)
    addCampaignEvent(runId, { ts: Date.now(), type: 'status', status: 'running' })

    // Minimal v1 runner: only supports a single step `open_url` on an existing/new profile.
    // Full step support will be expanded incrementally.
    try {
      const profiles = await loadProfiles()
      const profile =
        typeof payload.profileId === 'number'
          ? profiles.find((p) => p.id === payload.profileId)
          : profiles[0]

      if (!profile) throw new Error('No profile available to run campaign')

      addCampaignEvent(runId, { ts: Date.now(), type: 'log', level: 'info', message: `Launching ${profile.name}` })
      await launchProfile(profile)

      state.run.status = 'succeeded'
      state.run.finishedAt = Date.now()
      addCampaignEvent(runId, { ts: Date.now(), type: 'status', status: 'succeeded' })
      return { runId }
    } catch (error) {
      state.run.status = 'failed'
      state.run.finishedAt = Date.now()
      state.run.error = String(error)
      addCampaignEvent(runId, { ts: Date.now(), type: 'status', status: 'failed', error: String(error) })
      throw error
    }
  })

  ipcMain.handle('campaigns:run:get', async (_, payload: { runId: string }) => {
    const run = campaignRuns.get(payload.runId)
    if (!run) return null
    return run
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
