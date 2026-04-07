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
      const raw = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as Partial<Profile>
      profiles.push(normalizeProfile(raw))
    }
  })

  logger.info(`[profileService] Profiles loaded: ${JSON.stringify(profiles)}`)
  return profiles
}

function normalizeProfile(raw: Partial<Profile>): Profile {
  return {
    id: raw.id ?? Date.now(),
    name: raw.name ?? 'Unnamed profile',
    useragent: raw.useragent ?? '',
    notes: raw.notes ?? '',
    proxy: raw.proxy ?? '',
    proxyId: raw.proxyId,
    launched: raw.launched ?? false,
    cookies: raw.cookies,
    fingerprint: raw.fingerprint ?? {},
    startUrl: raw.startUrl,
    tags: raw.tags ?? []
  }
}

export async function launchProfile(profile: Profile) {
  logger.info(`[profileService] Launching profile: ${profile.id}`)
  const profilesDir = path.join(datadir, 'profiles')
  const profilePath = path.join(profilesDir, profile.id.toString(), 'profile.json')

  if (fs.existsSync(profilePath)) {
    const profileData: Profile = normalizeProfile(
      JSON.parse(fs.readFileSync(profilePath, 'utf8')) as Partial<Profile>
    )
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

    // Best-effort WebRTC leak mitigation (not equivalent to deep engine patches)
    if (profileData.fingerprint?.webrtc?.mode === 'disable') {
      browserArgs.push('--disable-features=WebRtcHideLocalIpsWithMdns')
      browserArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
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

    // Best-effort fingerprint settings (no deep engine patches)
    await applyFingerprint(page, profileData)

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

    if (profileData.startUrl) {
      try {
        await page.goto(profileData.startUrl, { waitUntil: 'domcontentloaded' })
      } catch (error) {
        logger.warn(`[profileService] startUrl navigation failed: ${error}`)
      }
    }

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

async function applyFingerprint(page: any, profile: Profile): Promise<void> {
  const fp = profile.fingerprint ?? {}

  if (fp.timezone) {
    try {
      await page.emulateTimezone(fp.timezone)
    } catch (error) {
      logger.warn(`[profileService] emulateTimezone failed: ${error}`)
    }
  }

  const acceptLanguage = fp.locale ? fp.locale : fp.languages?.length ? fp.languages.join(',') : undefined
  if (acceptLanguage) {
    try {
      await page.setExtraHTTPHeaders({ 'Accept-Language': acceptLanguage })
    } catch (error) {
      logger.warn(`[profileService] setExtraHTTPHeaders failed: ${error}`)
    }
  }

  if (fp.viewport) {
    try {
      await page.setViewport(fp.viewport)
    } catch (error) {
      logger.warn(`[profileService] setViewport failed: ${error}`)
    }
  }

  // Geolocation: apply permissions + set position (works only if site requests it)
  if (fp.geolocation) {
    try {
      const context = page.browserContext?.()
      if (context?.overridePermissions) {
        const url = profile.startUrl ? new URL(profile.startUrl).origin : undefined
        if (url) {
          await context.overridePermissions(url, ['geolocation'])
        }
      }
      if (page.setGeolocation) {
        await page.setGeolocation(fp.geolocation)
      }
    } catch (error) {
      logger.warn(`[profileService] geolocation apply failed: ${error}`)
    }
  }

  // Early injection: best-effort patches for navigator + WebGL + WebRTC
  const languages = fp.languages
  const locale = fp.locale
  const platform = fp.platform
  const hardwareConcurrency = fp.hardwareConcurrency
  const deviceMemory = fp.deviceMemory
  const webglVendor = fp.webgl?.vendor
  const webglRenderer = fp.webgl?.renderer
  const disableWebrtc = fp.webrtc?.mode === 'disable'

  if (
    languages ||
    locale ||
    platform ||
    hardwareConcurrency ||
    deviceMemory ||
    webglVendor ||
    webglRenderer ||
    disableWebrtc
  ) {
    try {
      await page.evaluateOnNewDocument(
        (cfg: {
          languages?: string[]
          locale?: string
          platform?: string
          hardwareConcurrency?: number
          deviceMemory?: number
          webglVendor?: string
          webglRenderer?: string
          disableWebrtc?: boolean
        }) => {
          const defineGetter = (obj: any, prop: string, value: unknown) => {
            try {
              Object.defineProperty(obj, prop, {
                get: () => value,
                configurable: true
              })
            } catch {
              // ignore
            }
          }

          if (cfg.languages?.length) {
            defineGetter(navigator, 'languages', cfg.languages)
            defineGetter(navigator, 'language', cfg.languages[0])
          } else if (cfg.locale) {
            defineGetter(navigator, 'language', cfg.locale)
          }

          if (cfg.platform) {
            defineGetter(navigator, 'platform', cfg.platform)
          }
          if (typeof cfg.hardwareConcurrency === 'number') {
            defineGetter(navigator, 'hardwareConcurrency', cfg.hardwareConcurrency)
          }
          if (typeof cfg.deviceMemory === 'number') {
            defineGetter(navigator, 'deviceMemory', cfg.deviceMemory)
          }

          if (cfg.webglVendor || cfg.webglRenderer) {
            const patch = (proto: any) => {
              if (!proto?.getParameter) return
              const original = proto.getParameter
              proto.getParameter = function (p: number) {
                // 37445: UNMASKED_VENDOR_WEBGL, 37446: UNMASKED_RENDERER_WEBGL
                if (p === 37445 && cfg.webglVendor) return cfg.webglVendor
                if (p === 37446 && cfg.webglRenderer) return cfg.webglRenderer
                return original.apply(this, arguments as any)
              }
            }
            patch((window as any).WebGLRenderingContext?.prototype)
            patch((window as any).WebGL2RenderingContext?.prototype)
          }

          if (cfg.disableWebrtc) {
            try {
              ;(window as any).RTCPeerConnection = undefined
              ;(window as any).webkitRTCPeerConnection = undefined
              ;(navigator as any).mediaDevices = undefined
            } catch {
              // ignore
            }
          }
        },
        {
          languages,
          locale,
          platform,
          hardwareConcurrency,
          deviceMemory,
          webglVendor,
          webglRenderer,
          disableWebrtc
        }
      )
    } catch (error) {
      logger.warn(`[profileService] evaluateOnNewDocument failed: ${error}`)
    }
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
  const jsonProfile: Profile = normalizeProfile(profile)
  const persisted: Profile = {
    id: profile.id,
    name: profile.name,
    useragent: profile.useragent,
    notes: profile.notes,
    proxy: profile.proxy,
    proxyId: profile.proxyId,
    launched: profile.launched,
    cookies: profile.cookies,
    fingerprint: jsonProfile.fingerprint,
    startUrl: jsonProfile.startUrl,
    tags: jsonProfile.tags
  }
  fs.writeFileSync(profilePath, JSON.stringify(persisted, null, 2))
}

export async function editProfile(profile: Profile) {
  logger.info(
    `[profileService] Updating profile: ${profile.id} with data: ${JSON.stringify(profile)}`
  )
  const profilesDir = path.join(datadir, 'profiles')
  const oldProfileDir = path.join(profilesDir, profile.id.toString())
  const profilePath = path.join(oldProfileDir, 'profile.json')

  const jsonProfile: Profile = normalizeProfile(profile)
  const persisted: Profile = {
    id: profile.id,
    name: profile.name,
    useragent: profile.useragent,
    notes: profile.notes,
    proxy: profile.proxy,
    proxyId: profile.proxyId,
    launched: profile.launched,
    cookies: profile.cookies,
    fingerprint: jsonProfile.fingerprint,
    startUrl: jsonProfile.startUrl,
    tags: jsonProfile.tags
  }
  fs.writeFileSync(profilePath, JSON.stringify(persisted, null, 2))
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
