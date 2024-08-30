import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
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
