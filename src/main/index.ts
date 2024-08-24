import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import path from 'path'
import fs from 'fs'

puppeteer.use(StealthPlugin())

interface Profile {
  name: string
  useragent: string
  notes: string
  proxy: string
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
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
  ipcMain.on('launch-profile', async (event, args) => {
    console.log('Launching profile:', args)
    launchProfile(args) // Assuming args is an object and name is the key
  })

  // Load profiles
  ipcMain.handle('load-profiles', async () => {
    console.log('Loading profiles')
    const profilesDir = path.join(__dirname, 'profiles')
    const profiles: Profile[] = []

    if (fs.existsSync(profilesDir)) {
      const profileDirs = fs.readdirSync(profilesDir)

      profileDirs.forEach((dir) => {
        const profilePath = path.join(profilesDir, dir, 'profile.json')
        if (fs.existsSync(profilePath)) {
          const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
          profiles.push(profile)
        }
      })
    }

    return profiles
  })

  // Create Profile
  ipcMain.on('create-profile', async (event, profile) => {
    console.log('Creating profile')
    const profilesDir = path.join(__dirname, 'profiles')
    console.log(profilesDir)
    console.log('Profile data: ', profile)
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir)
    }
    const profileDir = path.join(profilesDir, profile.name)
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir)
    }

    const profilePath = path.join(profileDir, 'profile.json')
    const jsonProfile: Profile = {
      name: profile.name,
      useragent: profile.useragent,
      notes: profile.notes,
      proxy: profile.proxy
    }

    fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
  })

  // update-profile
  ipcMain.on('update-profile', async (event, { profileData, oldProfileName }) => {
    console.log('Updating profile')
    const profilesDir = path.join(__dirname, 'profiles')
    const oldProfileDir = path.join(profilesDir, oldProfileName)
    const newProfileDir = path.join(profilesDir, profileData.name)
    const profilePath = path.join(newProfileDir, 'profile.json')

    if (oldProfileName !== profileData.name && fs.existsSync(oldProfileDir)) {
      fs.renameSync(oldProfileDir, newProfileDir)
    }

    const jsonProfile: Profile = {
      name: profileData.name,
      useragent: profileData.useragent,
      notes: profileData.notes,
      proxy: profileData.proxy
    }

    fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
  })

  ipcMain.on('delete-profile', (event, profileName: string) => {
    const profileDir = path.join(__dirname, 'profiles', profileName)

    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
      event.reply('profile-deleted', { success: true })
    } else {
      event.reply('profile-deleted', { success: false, message: 'Profile not found' })
    }
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

async function launchProfile(name: string) {
  const profilesDir = path.join(__dirname, 'profiles')
  const profilePath = path.join(profilesDir, name, 'profile.json')

  if (fs.existsSync(profilePath)) {
    const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized', ...(profile.proxy ? [`--proxy-server=${profile.proxy}`] : [])],
      userDataDir: path.join(profilesDir, name)
    })

    const page = await browser.newPage()

    if (profile.useragent) {
      await page.setUserAgent(profile.useragent)
    }

    await page.goto('https://bot.sannysoft.com')
  } else {
    console.error('Profile not found')
  }
}
