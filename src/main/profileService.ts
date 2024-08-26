import fs from 'fs'
import path from 'path'
import { Profile } from './types'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'

let datadir = __dirname
if (!is.dev) {
  datadir = app.getPath('userData')
}
logger.info(`[profileService] Data directory: ${datadir}`)

puppeteer.use(StealthPlugin())

export async function loadProfiles() {
  logger.info('[profileService] Loading profiles')
  const profilesDir = path.join(datadir, 'profiles')
  const profiles: Profile[] = []

  if (!fs.existsSync(profilesDir)) {
    logger.warn('[profileService] No profiles found')
    return profiles
  }
  const profileDirs = fs.readdirSync(profilesDir)

  profileDirs.forEach((dir) => {
    const profilePath = path.join(profilesDir, dir, 'profile.json')
    if (fs.existsSync(profilePath)) {
      const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
      profiles.push(profile)
    }
  })

  logger.info(`[profileService] Profiles loaded: ${JSON.stringify(profiles)}`)
  return profiles
}

export async function launchProfile(name: string) {
  logger.info(`[profileService] Launching profile: ${name}`)
  const profilesDir = path.join(datadir, 'profiles')
  const profilePath = path.join(profilesDir, name, 'profile.json')

  if (fs.existsSync(profilePath)) {
    const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    logger.info(`[profileService] Profile data: ${JSON.stringify(profile)}`)
    const browserArgs: string[] = []
    let proxyUsername: string = ''
    let proxyPassword: string = ''

    if (profile.proxy) {
      const proxyUrl = new URL(profile.proxy)
      browserArgs.push(`--proxy-server=${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`)

      if (proxyUrl.username && proxyUrl.password) {
        proxyUsername = proxyUrl.username
        proxyPassword = proxyUrl.password
      }
    }

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: browserArgs,
      userDataDir: path.join(profilesDir, name)
    })

    const page = await browser.newPage()

    if (proxyUsername && proxyPassword) {
      await page.authenticate({ username: proxyUsername, password: proxyPassword })
    }

    if (profile.useragent) {
      await page.setUserAgent(profile.useragent)
    }
    await page.goto('https://www.google.com')

    // Handle browser close event
    browser.on('disconnected', () => {
      logger.info(`[profileService] Profile closed: ${name}`)
      ChangeStatus(name)
      ipcMain.emit('profile-closed', name)
    })
  } else {
    logger.error(`[profileService] Profile not found: ${name}`)
  }
}

export async function CreateProfile(profile) {
  logger.info(`[profileService] Creating profile with data: ${JSON.stringify(profile)}`)
  const profilesDir = path.join(datadir, 'profiles')
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
    proxy: profile.proxy,
    proxyId: profile.proxyId,
    launched: false
  }
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function UpdateProfile(profileData, oldProfileName) {
  logger.info(
    `[profileService] Updating profile: ${oldProfileName} with data: ${JSON.stringify(profileData)}`
  )
  const profilesDir = path.join(datadir, 'profiles')
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
    proxy: profileData.proxy,
    proxyId: profileData.proxyId,
    launched: false
  }
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function UpdateNote(data) {
  logger.info(`[profileService] Updating note: ${JSON.stringify(data)}`)
  const profilesDir = path.join(datadir, 'profiles')
  const profileDir = path.join(profilesDir, data.name)
  const profilePath = path.join(profileDir, 'profile.json')

  const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
  profile.notes = data.notes

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
}

export async function DeleteProfile(profileName: string) {
  logger.info(`[profileService] Deleting profile: ${profileName}`)
  const profileDir = path.join(datadir, 'profiles', profileName)

  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true })
    logger.info(`[profileService] Profile deleted: ${profileName}`)
  } else {
    logger.error(`[profileService] Profile not found: ${profileName}`)
  }
}

export async function ChangeStatus(profileName: string) {
  logger.info(`[profileService] Changing status of profile: ${profileName}`)
  const profilesDir = path.join(datadir, 'profiles')
  const profilePath = path.join(profilesDir, profileName, 'profile.json')

  if (fs.existsSync(profilePath)) {
    const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    profile.launched = !profile.launched

    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
  } else {
    logger.error(`[profileService] Profile not found: ${profileName}`)
  }
}
