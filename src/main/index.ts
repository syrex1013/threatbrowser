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
  DeleteProfile
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

puppeteer.use(StealthPlugin())

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 670,
    minWidth: 1200,
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
    launchProfile(profileName)
  })

  // Load profiles
  ipcMain.handle('load-profiles', async () => {
    return loadProfiles()
  })

  // Create Profile
  ipcMain.on('create-profile', async (_, profile) => {
    CreateProfile(profile)
  })

  // update-profile
  ipcMain.on('update-profile', async (_, { profileData, oldProfileName }) => {
    UpdateProfile(profileData, oldProfileName)
  })

  //update-note
  ipcMain.on('update-note', async (_, data) => {
    UpdateNote(data)
  })

  // delete profile
  ipcMain.on('delete-profile', (_, profileName: string) => {
    DeleteProfile(profileName)
  })

  // create proxy
  ipcMain.handle('create-proxy', async (_, proxy) => {
    await CreateProxy(proxy)
  })

  // delete proxy
  ipcMain.handle('delete-proxy', async (_, proxyid) => {
    await DeleteProxy(proxyid)
  })

  // get proxies
  ipcMain.handle('get-proxies', async () => {
    return GetProxies()
  })

  // test proxy
  ipcMain.handle('test-proxy', async (_, proxy) => {
    return await testProxy(proxy)
  })

  // edit proxy
  ipcMain.handle('edit-proxy', async (_, proxyID, proxy) => {
    return await editProxy(proxyID, proxy)
  })

  // get proxy country
  ipcMain.handle('get-proxy-country', async (_, proxy) => {
    return await getProxyCountry(proxy)
  })

  // parse proxy
  ipcMain.handle('parse-proxy-create', async (_, proxy) => {
    return await parseProxyCreate(proxy)
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
