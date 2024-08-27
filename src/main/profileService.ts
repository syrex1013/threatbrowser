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

export async function launchProfile(profile: Profile) {
  logger.info(`[profileService] Launching profile: ${profile.id}`)
  const profilesDir = path.join(datadir, 'profiles')
  const profilePath = path.join(profilesDir, profile.id.toString(), 'profile.json')

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
      userDataDir: path.join(profilesDir, profile.id.toString())
    })

    const page = await browser.newPage()

    if (proxyUsername && proxyPassword) {
      await page.authenticate({ username: proxyUsername, password: proxyPassword })
    }

    if (profile.useragent) {
      await page.setUserAgent(profile.useragent)
    }
    try {
      await page.goto('https://www.google.com')
    } catch (error) {
      logger.error(`[profileService] Error launching profile: ${error}`)
      logger.info(`[profileService] Profile closed: ${profile.id}`)
      ipcMain.emit('profile-closed', profile.id)
    }

    // Handle browser close event
    browser.on('disconnected', () => {
      logger.info(`[profileService] Profile closed: ${profile.id}`)
      ipcMain.emit('profile-closed', profile.id)
    })
  } else {
    logger.error(`[profileService] Profile not found: ${profile.id}`)
  }
}

export async function CreateProfile(profile: Profile) {
  logger.info(`[profileService] Creating profile with data: ${JSON.stringify(profile)}`)
  const profilesDir = path.join(datadir, 'profiles')
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir)
  }
  const profileDir = path.join(profilesDir, profile.id.toString())
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir)
  }

  const profilePath = path.join(profileDir, 'profile.json')
  const jsonProfile: Profile = {
    id: profile.id,
    name: profile.name,
    useragent: profile.useragent,
    notes: profile.notes,
    proxy: profile.proxy,
    proxyId: profile.proxyId,
    launched: profile.launched
  }
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function editProfile(profile: Profile) {
  logger.info(
    `[profileService] Updating profile: ${profile.id} with data: ${JSON.stringify(profile)}`
  )
  const profilesDir = path.join(datadir, 'profiles')
  const oldProfileDir = path.join(profilesDir, profile.id.toString())
  const profilePath = path.join(oldProfileDir, 'profile.json')

  const jsonProfile: Profile = {
    id: profile.id,
    name: profile.name,
    useragent: profile.useragent,
    notes: profile.notes,
    proxy: profile.proxy,
    proxyId: profile.proxyId,
    launched: profile.launched
  }
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function DeleteProfile(profile: Profile) {
  logger.info(`[profileService] Deleting profile: ${profile.id}`)
  const profileDir = path.join(datadir, 'profiles', profile.id.toString())

  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true })
    logger.info(`[profileService] Profile deleted: ${profile.id}`)
  } else {
    logger.error(`[profileService] Profile not found: ${profile.id}`)
  }
}
