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
    const profileData: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    logger.info(`[profileService] Profile data: ${JSON.stringify(profileData)}`)
    const browserArgs: string[] = []
    let proxyUsername: string = ''
    let proxyPassword: string = ''

    if (profileData.proxy) {
      const proxyUrl = new URL(profileData.proxy)
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

    if (profileData.useragent) {
      await page.setUserAgent(profileData.useragent)
    }

    if (profileData.cookies) {
      if (profileData.cookies !== '{}') {
        const cookies = JSON.parse(profileData.cookies)
        //loop and log cookies
        cookies.forEach((cookie) => async () => {
          logger.info(`[profileService] Setting cookie: ${cookie.name}`)
          await page.setCookie(cookie)
        })
      }
    }

    page.on('request', async () => {
      exportCookiesToJson(page, path.join(profilesDir, profile.id.toString()))
    })

    // Handle browser close event
    browser.on('disconnected', async () => {
      logger.info(`[profileService] Profile closed: ${profile.id}`)
      const cookies = await loadAndStringifyCookies(
        path.join(profilesDir, profile.id.toString()),
        profile
      )
      ipcMain.emit('profile-closed', { id: profile.id, cookies: cookies })
    })
  } else {
    logger.error(`[profileService] Profile not found: ${profile.id}`)
  }
}
async function loadAndStringifyCookies(profileDir: string, profile: Profile) {
  const pathCookie = path.join(profileDir, 'cookies.json')
  logger.info(`[profileService] Loading cookies from: ${pathCookie}`)
  const existingCookies = fs.existsSync(pathCookie)
    ? JSON.parse(fs.readFileSync(pathCookie, 'utf8'))
    : []
  logger.info(`[profileService] Cookies loaded: ${JSON.stringify(existingCookies)}`)
  profile.cookies = JSON.stringify(existingCookies)
  editProfile(profile)
  return JSON.stringify(existingCookies)
}
async function exportCookiesToJson(page, profileDir: string) {
  try {
    const cookies = await page.cookies()
    // Append cookies to existing file
    const pathCookie = path.join(profileDir, 'cookies.json')
    const existingCookies = fs.existsSync(pathCookie)
      ? JSON.parse(fs.readFileSync(pathCookie, 'utf8'))
      : []

    const updatedCookies = cookies.filter((cookie) => {
      // Check if cookie with the same name and domain already exists
      const existingCookie = existingCookies.find(
        (existingCookie) =>
          existingCookie.name === cookie.name && existingCookie.domain === cookie.domain
      )
      return !existingCookie
    })

    const mergedCookies = [...existingCookies, ...updatedCookies]
    fs.writeFileSync(pathCookie, JSON.stringify(mergedCookies, null, 2))
  } catch (error) {
    logger.error(`[profileService] Error exporting cookies: ${error}`)
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
    launched: profile.launched,
    cookies: profile.cookies
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
    launched: profile.launched,
    cookies: profile.cookies
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
