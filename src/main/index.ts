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
  UpdateProfile,
  UpdateNote,
  DeleteProfile,
  ChangeStatus
} from './profileService'
import {
  testProxy,
  CreateProxy,
  DeleteProxy,
  GetProxies,
  editProxy,
  getProxyCountry,
  parseProxyCreate
} from './proxyService'

import logger from '../logger/logger'

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
  ipcMain.on('launch-profile', async (_, profileName) => {
    logger.info(`[electron-main] launch-profile: ${profileName}`)
    launchProfile(profileName)
  })
  ipcMain.addListener('profile-closed', function closelistener(arg1) {
    logger.info(`[electron-main] profile-closed: ${arg1}`)
    BrowserWindow.getFocusedWindow().webContents.send('profile-closed', arg1)
  })
  // Load profiles
  ipcMain.handle('load-profiles', async () => {
    logger.info('[electron-main] load-profiles')
    return loadProfiles()
  })

  // Create Profile
  ipcMain.on('create-profile', async (_, profile) => {
    logger.info(`[electron-main] create-profile: ${JSON.stringify(profile)}`)
    CreateProfile(profile)
  })

  // update-profile
  ipcMain.on('update-profile', async (_, { profileData, oldProfileName }) => {
    logger.info(`[electron-main] update-profile: ${JSON.stringify(profileData)}`)
    UpdateProfile(profileData, oldProfileName)
  })

  //update-note
  ipcMain.on('update-note', async (_, data) => {
    logger.info(`[electron-main] update-note: ${JSON.stringify(data)}`)
    UpdateNote(data)
  })
  // delete profile
  ipcMain.on('delete-profile', (_, profileName: string) => {
    logger.info(`[electron-main] delete-profile: ${profileName}`)
    DeleteProfile(profileName)
  })

  // change-profile-status
  ipcMain.on('change-profile-status', (_, profileName: string) => {
    logger.info(`[electron-main] change-profile-status: ${profileName}`)
    ChangeStatus(profileName)
  })

  // create proxy
  ipcMain.handle('create-proxy', async (_, proxy) => {
    logger.info(`[electron-main] create-proxy: ${JSON.stringify(proxy)}`)
    await CreateProxy(proxy)
  })

  // delete proxy
  ipcMain.handle('delete-proxy', async (_, proxyid) => {
    logger.info(`[electron-main] delete-proxy: ${proxyid}`)
    await DeleteProxy(proxyid)
  })

  // get proxies
  ipcMain.handle('get-proxies', async () => {
    logger.info('[electron-main] get-proxies')
    const proxies = await GetProxies()
    return proxies
  })

  // test proxy
  ipcMain.handle('test-proxy', async (_, proxy) => {
    logger.info(`[electron-main] test-proxy: ${proxy}`)
    return await testProxy(proxy)
  })

  // edit proxy
  ipcMain.handle('edit-proxy', async (_, proxyID, proxy) => {
    logger.info(`[electron-main] edit-proxy: ${proxyID} ${JSON.stringify(proxy)}`)
    return await editProxy(proxyID, proxy)
  })

  // get proxy country
  ipcMain.handle('get-proxy-country', async (_, proxy) => {
    logger.info(`[electron-main] get-proxy-country: ${proxy}`)
    return await getProxyCountry(proxy)
  })

  // parse proxy
  ipcMain.handle('parse-proxy-create', async (_, proxy) => {
    logger.info(`[electron-main] parse-proxy-create: ${proxy}`)
    return await parseProxyCreate(proxy)
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
