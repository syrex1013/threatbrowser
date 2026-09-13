import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import type { Browser, Page } from 'puppeteer-core'
import { app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'
import {
  applyConfigToProfile,
  migrateProfileSettings,
  profileIdentity,
  type Profile,
  type ProfileConfig
} from '../shared/profileSettings'
import type { StoredProfile } from './types'
import { cookiesToNetscape, type PuppeteerCookie } from './cookieFormats'
import { deriveSeed, effectivePlatform, enginePlatform, validateProfile } from './profileValidation'
import {
  claimOwnedTarget,
  configureProfilePage,
  configureProfilePermissions,
  newProfilePage
} from './profileRuntime'

/** scrypt password hash in the `salt:hash` hex form (no external dependency). */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Constant-time scrypt verification of a password against a stored hash. */
function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== 'string' || !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(stored)) return false
  const [salt, expected] = stored.split(':')
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(expected, 'hex'))
}

/**
 * Native Apple GPU identity for the launch. The free macOS engine hard-spoofs
 * an M1/8-core template regardless of seed; real Chrome on this machine reports
 * the true chip and logical cores. Pin engine flags to the OS-detected values
 * so the visible GPU/cores match what a genuine browser on this hardware shows.
 * Returns null when not an Apple-silicon host (engine defaults apply).
 */
function nativeAppleGraphics(): { renderer: string; vendor: string; cores: number } | null {
  const model = (os.cpus()[0]?.model ?? '').trim()
  if (!model.startsWith('Apple')) return null
  const chip = model.replace(/^Apple\s+/i, '')
  const cores = os.cpus().length
  if (!chip || !Number.isInteger(cores) || cores <= 0) return null
  return {
    renderer: `ANGLE (Apple, ANGLE Metal Renderer: ${chip}, Unspecified Version)`,
    vendor: 'Google Inc. (Apple)',
    cores
  }
}

const datadir = process.env.THREATBROWSER_DATA_DIR || (is.dev ? __dirname : app.getPath('userData'))
fs.mkdirSync(datadir, { recursive: true })

type ProfileLaunch = {
  controller: AbortController
  browser?: Browser
  settled: Promise<void>
  done: Promise<void>
  release: () => void
  cookieTask: Promise<void>
  closing?: Promise<void>
  error?: unknown
}
const runningBrowsers = new Map<number, ProfileLaunch>()

function readStoredProfile(id: number): StoredProfile {
  const file = profilePath(id)
  if (!fs.existsSync(file)) throw new Error(`Profile ${id} not found`)
  return normalizeProfile(JSON.parse(fs.readFileSync(file, 'utf8')))
}

function publicProfile(stored: StoredProfile): Profile {
  const { passwordHash, ...profile } = stored
  return {
    ...profile,
    hasPassword: Boolean(passwordHash),
    launched: runningBrowsers.has(stored.id)
  }
}

export function profilePath(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error('Profile invalid: id must be a positive safe integer')
  return path.join(datadir, 'profiles', String(id), 'profile.json')
}

function authorize(stored: StoredProfile, password?: string): void {
  if (stored.passwordHash && !verifyPassword(password ?? '', stored.passwordHash))
    throw new Error('Invalid profile password')
}

function assertValid(profile: Profile): void {
  const result = validateProfile(profile, effectivePlatform(profile))
  if (!result.ok) throw new Error(`Profile invalid: ${result.errors.join('; ')}`)
}

function atomicWrite(file: string, value: unknown): void {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  let fd: number | undefined
  try {
    fd = fs.openSync(temporary, 'wx', 0o600)
    fs.writeFileSync(fd, JSON.stringify(value, null, 2))
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    fs.renameSync(temporary, file)
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
    fs.rmSync(temporary, { force: true })
  }
}

/**
 * Google engine data for the address bar (omnibox). Without a user choice,
 * Chromium falls back to its prepopulated default, which anti-detect binaries
 * do not guarantee to be Google. Skipped whenever the pref already exists so a
 * user's own search-engine choice is never overwritten.
 */
const GOOGLE_SEARCH_ENGINE = {
  alternate_urls: [],
  contextual_search_url: '',
  created_from_play_api: false,
  date_created: '0',
  doodle_url: '',
  enforced_by_policy: false,
  favicon_url: 'https://www.google.com/favicon.ico',
  featured_by_policy: false,
  id: '7',
  image_search_branding_label: '',
  image_translate_source_language_param_key: '',
  image_translate_target_language_param_key: '',
  image_translate_url: '',
  image_url: '',
  image_url_post_params: '',
  input_encodings: ['UTF-8'],
  is_active: 0,
  keyword: 'google.com',
  last_modified: '0',
  last_visited: '0',
  logo_url: '',
  new_tab_url: '',
  originating_url: '',
  policy_origin: 0,
  preconnect_to_search_url: false,
  prefetch_likely_navigations: false,
  prepopulate_id: 1,
  safe_for_autoreplace: true,
  search_intent_params: [],
  search_url_post_params: '',
  send_x_geo_header: false,
  short_name: 'Google',
  starter_pack_id: 0,
  suggestions_url: 'https://www.google.com/complete/search?client=chrome&q={searchTerms}',
  suggestions_url_post_params: '',
  synced_guid: '485bf7d3-0215-45af-87dc-538868000101',
  url: 'https://www.google.com/search?q={searchTerms}',
  usage_count: 0
} as const

/**
 * Preseed Google as the omnibox search engine for a profile directory. Must run
 * before the engine launch: Chromium keeps a mirrored copy of the default
 * search provider data and clears both on mismatch, so the two dicts are
 * written identically.
 */
function ensureGoogleDefaultSearch(profileDir: string): void {
  const preferencesPath = path.join(profileDir, 'Default', 'Preferences')
  let prefs: Record<string, unknown> = {}
  try {
    prefs = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')) as Record<string, unknown>
  } catch {
    // Missing or unreadable Preferences: Chromium creates a fresh profile.
  }
  const existing = prefs['default_search_provider_data'] as Record<string, unknown> | undefined
  if (existing?.['template_url_data'] !== undefined) return
  prefs['default_search_provider_data'] = {
    template_url_data: GOOGLE_SEARCH_ENGINE,
    mirrored_template_url_data: GOOGLE_SEARCH_ENGINE
  }
  try {
    fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
    atomicWrite(preferencesPath, prefs)
  } catch (error) {
    logger.warn(`[profileService] Default search preseed failed: ${String(error)}`)
  }
}

export async function loadProfiles(): Promise<Profile[]> {
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
      try {
        const raw = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as Partial<StoredProfile>
        const normalized = normalizeProfile(raw)
        profiles.push(publicProfile(normalized))
      } catch (error) {
        logger.error(
          `[profileService] Skipping unreadable profile ${dir}: ${String(error)} (${profilePath})`
        )
      }
    }
  })

  logger.info(`[profileService] Profiles loaded: ${profiles.length}`)
  return profiles
}

function normalizeProfile(raw: Partial<StoredProfile>, legacy = true): StoredProfile {
  const normalized: StoredProfile = {
    id: raw.id ?? Date.now(),
    name: raw.name ?? 'Unnamed profile',
    useragent: raw.useragent ?? '',
    notes: raw.notes ?? '',
    proxy: raw.proxy ?? '',
    proxyId: raw.proxyId,
    launched: raw.launched ?? false,
    cookies: raw.cookies,
    fingerprint: raw.fingerprint ?? {},
    startPages:
      raw.startPages !== undefined
        ? raw.startPages
        : (raw as Partial<Profile> & { startUrl?: string }).startUrl
          ? [(raw as Partial<Profile> & { startUrl?: string }).startUrl as string]
          : [],
    folder: raw.folder ?? '',
    pinnedTag: raw.pinnedTag ?? undefined,
    platform: raw.platform,
    browserIdentity: raw.browserIdentity,
    brandVersion: raw.brandVersion,
    permissionRules: raw.permissionRules,
    resources: raw.resources,
    passwordHash: raw.passwordHash,
    tags: raw.tags ?? [],
    humanize: raw.humanize ?? false,
    geoip: raw.geoip ?? false,
    timezone: raw.timezone ?? '',
    locale: raw.locale ?? '',
    extensions: raw.extensions ?? [],
    browserVersion: raw.browserVersion ?? '',
    humanPreset: raw.humanPreset ?? 'default',
    width: raw.width,
    height: raw.height,
    extraArgs: raw.extraArgs ?? [],
    seed: raw.seed ?? deriveSeed(raw.id ?? 0)
  }
  return legacy ? migrateProfileSettings(normalized) : normalized
}

/**
 * Project a form profile to the on-disk persisted shape: hash a new plaintext
 * password, carry an existing hash over unchanged, and omit empty optional
 * fields. `password`/`hasPassword` are never written to disk.
 */
function buildPersisted(profile: Profile & { passwordHash?: string }): StoredProfile {
  const jsonProfile = normalizeProfile(profile, false)
  const passwordHash = profile.password ? hashPassword(profile.password) : jsonProfile.passwordHash
  return {
    id: jsonProfile.id,
    name: jsonProfile.name,
    useragent: jsonProfile.useragent,
    notes: jsonProfile.notes,
    proxy: jsonProfile.proxy,
    proxyId: jsonProfile.proxyId,
    launched: jsonProfile.launched,
    cookies: jsonProfile.cookies,
    fingerprint: jsonProfile.fingerprint,
    startPages: jsonProfile.startPages,
    folder: jsonProfile.folder || undefined,
    pinnedTag: jsonProfile.pinnedTag,
    platform: jsonProfile.platform,
    browserIdentity: jsonProfile.browserIdentity,
    brandVersion: jsonProfile.brandVersion,
    permissionRules: (jsonProfile.permissionRules ?? []).map((rule) => ({
      ...rule,
      origin: new URL(rule.origin).origin
    })),
    resources: jsonProfile.resources,
    passwordHash: passwordHash || undefined,
    tags: jsonProfile.tags,
    humanize: jsonProfile.humanize,
    geoip: jsonProfile.geoip,
    timezone: jsonProfile.timezone,
    locale: jsonProfile.locale,
    extensions: jsonProfile.extensions,
    browserVersion: jsonProfile.browserVersion,
    humanPreset: jsonProfile.humanPreset,
    width: jsonProfile.width,
    height: jsonProfile.height,
    extraArgs: jsonProfile.extraArgs,
    seed: jsonProfile.seed
  }
}

export async function launchProfile(profile: Profile, password?: string): Promise<void> {
  await launchProfileForAutomation(profile, password)
}

export async function launchProfileForAutomation(
  profile: Profile,
  password?: string
): Promise<{ browser: Browser; page: Page; profileData: Profile; profileDir: string }> {
  const stored = readStoredProfile(profile.id)
  authorize(stored, password)
  if (runningBrowsers.has(profile.id)) throw new Error(`Profile ${profile.id} is already running`)
  const profileData = publicProfile(stored)
  assertValid(profileData)
  const profileDir = path.dirname(profilePath(profile.id))
  const completion = Promise.withResolvers<void>()
  const launchSettled = Promise.withResolvers<void>()
  const record: ProfileLaunch = {
    controller: new AbortController(),
    done: completion.promise,
    release: completion.resolve,
    settled: launchSettled.promise,
    cookieTask: Promise.resolve()
  }
  runningBrowsers.set(profile.id, record)
  const finish = async (): Promise<void> => {
    if (runningBrowsers.get(profile.id) !== record) return
    try {
      await record.cookieTask
      const cookies = loadAndStringifyCookies(profileDir, profile.id)
      ipcMain.emit('profile-closed', { id: profile.id, cookies })
    } catch (error) {
      record.error = error
      logger.error(`[profileService] Cookie persistence failed for ${profile.id}`)
    } finally {
      runningBrowsers.delete(profile.id)
      record.release()
    }
  }
  try {
    const { browser, page } = await launchEngine(profileData, profileDir, (browser) => {
      record.browser = browser
      browser.once('disconnected', () => {
        void record.settled.then(finish)
      })
      record.controller.signal.throwIfAborted()
    })
    record.controller.signal.throwIfAborted()
    if (!browser.connected) throw new Error('Profile browser closed during launch')
    return { browser, page, profileData, profileDir }
  } catch (error) {
    if (record.browser?.connected) await record.browser.close().catch(() => undefined)
    await finish()
    throw error
  } finally {
    launchSettled.resolve()
  }
}

/**
 * Shared engine launch: builds the stealth args from a profile, launches the
 * CloakBrowser Chromium against a profile directory, and opens a page wired
 * with the webdriver patch, UA, geolocation, cookies and start pages. Both
 * persisted profiles and one-time temp profiles use this.
 */
async function launchEngine(
  profileData: Profile,
  profileDir: string,
  onSpawn?: (browser: Browser) => void
): Promise<{ browser: Browser; page: Page }> {
  // Stealth engine: CloakBrowser's source-patched Chromium binary provides the
  // canvas/WebGL/audio/font/GPU/screen/UA fingerprint layer plus stealth-driver
  // consistency. No JS-level fingerprint injection is applied here.
  const { launch } = await import('cloakbrowser/puppeteer')
  const { binaryInfo } = await import('cloakbrowser')
  const selectedVersion = binaryInfo(profileData.browserVersion || undefined).version

  const options: Record<string, unknown> = {
    headless: false,
    humanize: profileData.humanize ?? false,
    launchOptions: { userDataDir: profileDir, defaultViewport: null },
    geoip: profileData.geoip === true
  }

  if ((profileData.humanPreset ?? 'default') === 'careful') {
    options.humanPreset = 'careful'
  }

  const extraArgs: string[] = [...(profileData.extraArgs ?? [])]
  extraArgs.push(
    ...profileIdentity(profileData, selectedVersion, effectivePlatform(profileData)).args
  )
  // Background tabs must stay live: occluded renderers suspend geolocation
  extraArgs.push(
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  )
  if (profileData.width && profileData.height) {
    extraArgs.push(
      `--window-size=${Math.round(profileData.width)},${Math.round(profileData.height)}`
    )
  }
  // Native GPU pins are only appropriate for the host-native desktop identity.
  const spoofed = effectivePlatform(profileData) !== enginePlatform()
  const native = spoofed ? null : nativeAppleGraphics()
  const pinGpu =
    profileData.fingerprint?.webgl?.renderer || profileData.fingerprint?.webgl?.vendor
      ? {
          renderer: profileData.fingerprint?.webgl?.renderer,
          vendor: profileData.fingerprint?.webgl?.vendor
        }
      : native
  if (pinGpu?.renderer) extraArgs.push(`--fingerprint-gpu-renderer=${pinGpu.renderer}`)
  if (pinGpu?.vendor) extraArgs.push(`--fingerprint-gpu-vendor=${pinGpu.vendor}`)
  const pinCores = profileData.fingerprint?.hardwareConcurrency ?? native?.cores
  if (pinCores) extraArgs.push(`--fingerprint-hardware-concurrency=${pinCores}`)
  const webrtcMode = profileData.fingerprint?.webrtc?.mode
  switch (webrtcMode) {
    case 'ip':
      // Spoof the WebRTC public IP to the proxy exit IP; the engine resolves
      // `auto` to the egress IP and drops the flag when there is no proxy.
      extraArgs.push('--fingerprint-webrtc-ip=auto')
      break
    case 'real':
      // No WebRTC flags: expose the real host candidates.
      break
    case 'proxyOnly':
      extraArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
      break
    case 'disable':
      extraArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
      extraArgs.push('--disable-features=WebRtcHideLocalIpsWithMdns')
      break
    default:
      break
  }
  // Persistent per-profile seed pins the engine fingerprint across launches;
  // unshifted first so it overrides the engine's random default via arg dedup.
  extraArgs.unshift(`--fingerprint=${profileData.seed ?? deriveSeed(profileData.id)}`)
  if (profileData.proxy?.trim()) {
    options.proxy = profileData.proxy
  } else {
    // Profile without a proxy: Chromium otherwise inherits the OS system proxy
    // (or env proxy on Linux), and a dead ambient proxy shows "no internet"
    // even though the profile selected none. Pin direct networking + system DNS.
    extraArgs.push('--no-proxy-server')
  }
  options.args = extraArgs
  const timezone = profileData.timezone || profileData.fingerprint?.timezone
  if (timezone) options.timezone = timezone

  const locale =
    profileData.locale || profileData.fingerprint?.locale || profileData.fingerprint?.languages?.[0]
  if (locale) options.locale = locale

  const extensionPaths = profileData.extensions?.filter((p) => p && fs.existsSync(p))
  if (extensionPaths?.length) options.extensionPaths = extensionPaths

  if (profileData.browserVersion) options.browserVersion = profileData.browserVersion

  ensureGoogleDefaultSearch(profileDir)

  const browser = (await launch(options)) as Browser
  try {
    onSpawn?.(browser)

    await configureProfilePermissions(browser, profileData)
    browser.on('targetcreated', (target) => {
      if (target.type() !== 'page') return
      // newProfilePage arms a claim before requesting its page; consume it here
      // so owned pages are configured exactly once, pre-navigation, by
      // newProfilePage. Unclaimed targets (popups, links) configure on attach.
      const owned = claimOwnedTarget(target)
      let attached: Page | null = null
      void target
        .page()
        .then(async (page) => {
          attached = page
          if (!page || page.isClosed() || /^(chrome-extension|devtools):/.test(page.url())) return
          if (!owned) await configureProfilePage(page, profileData)
          page.on('requestfinished', () => {
            void exportCookiesToJson(page, profileDir)
          })
        })
        .catch(async () => {
          if (browser.connected && attached && !attached.isClosed()) {
            logger.error(`[profileService] Page setup failed for ${profileData.id}`)
            await browser.close().catch(() => undefined)
          }
        })
    })
    const page = await newProfilePage(browser, profileData)

    if (profileData.cookies && profileData.cookies !== '{}') {
      const cookies = JSON.parse(profileData.cookies) as unknown
      if (Array.isArray(cookies)) {
        await page.browserContext().setCookie(...cookies)
      }
    }

    const startPages = profileData.startPages ?? []
    for (let i = 0; i < startPages.length; i++) {
      const target = i === 0 ? page : await newProfilePage(browser, profileData)
      try {
        await target.goto(startPages[i], { waitUntil: 'domcontentloaded', timeout: 120000 })
      } catch {
        throw new Error(`Start page ${i + 1} navigation failed`)
      }
    }

    return { browser, page }
  } catch (error) {
    await browser.close().catch(() => undefined)
    throw error
  }
}

export async function exportProfileCookies(
  profileId: number,
  format: 'json' | 'netscape'
): Promise<string> {
  const profilesDir = path.join(datadir, 'profiles')
  const profileDir = path.join(profilesDir, profileId.toString())
  const pathCookie = path.join(profileDir, 'cookies.json')
  if (!fs.existsSync(pathCookie)) return format === 'netscape' ? cookiesToNetscape([]) : '[]'

  const raw = fs.readFileSync(pathCookie, 'utf8')
  if (format === 'json') return raw

  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return cookiesToNetscape([])
  return cookiesToNetscape(parsed as unknown as PuppeteerCookie[])
}

export async function importProfileCookies(profileId: number, cookiesJson: string): Promise<void> {
  readStoredProfile(profileId)
  const parsed = JSON.parse(cookiesJson) as unknown
  if (!Array.isArray(parsed)) throw new Error('Cookies must be an array')
  atomicWrite(path.join(path.dirname(profilePath(profileId)), 'cookies.json'), parsed)
  loadAndStringifyCookies(path.dirname(profilePath(profileId)), profileId)
}

function loadAndStringifyCookies(profileDir: string, id: number): string {
  const file = path.join(profileDir, 'profile.json')
  if (!fs.existsSync(file)) return '[]'
  const current = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredProfile
  const cookieFile = path.join(profileDir, 'cookies.json')
  if (!fs.existsSync(cookieFile)) return current.cookies ?? '[]'
  const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'))
  if (!Array.isArray(cookies)) throw new Error(`Cookie persistence failed for ${id}`)
  current.cookies = JSON.stringify(cookies)
  atomicWrite(file, current)
  return current.cookies
}

async function exportCookiesToJson(page: Page, profileDir: string): Promise<void> {
  const id = Number(path.basename(profileDir))
  const record = runningBrowsers.get(id)
  const capture = async (): Promise<void> => {
    if (!fs.existsSync(path.join(profileDir, 'profile.json')) || page.isClosed()) return
    const cookies = await page.browserContext().cookies()
    if (fs.existsSync(path.join(profileDir, 'profile.json')))
      atomicWrite(path.join(profileDir, 'cookies.json'), cookies)
  }
  const task = (record?.cookieTask ?? Promise.resolve()).then(capture)
  const observed = task.catch(() => {
    if (record?.browser?.connected && !record.controller.signal.aborted) {
      record.error = new Error(`Cookie persistence failed for ${id}`)
      logger.error(`[profileService] Cookie persistence failed for ${id}`)
    }
  })
  if (record) record.cookieTask = observed
  await observed
}

export async function CreateProfile(profile: Profile): Promise<Profile> {
  assertValid(profile)
  return createStoredProfile(profile)
}

function createStoredProfile(profile: Profile, importedHash?: string): Profile {
  const profilesDir = path.join(datadir, 'profiles')
  fs.mkdirSync(profilesDir, { recursive: true })
  const generated = !profile.id
  const highest = fs
    .readdirSync(profilesDir)
    .reduce((max, dir) => (Number.isSafeInteger(Number(dir)) ? Math.max(max, Number(dir)) : max), 0)
  let id = generated ? Math.max(Date.now(), highest + 1) : profile.id
  let directory: string
  for (;;) {
    directory = path.dirname(profilePath(id))
    try {
      fs.mkdirSync(directory)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw new Error('Profile creation failed')
      if (!generated) throw new Error(`Profile ${id} already exists`)
      id++
    }
  }
  try {
    const persisted = buildPersisted({
      ...profile,
      id,
      launched: false,
      seed: profile.seed ?? deriveSeed(id),
      passwordHash: importedHash
    })
    atomicWrite(path.join(directory, 'profile.json'), persisted)
    logger.info(`[profileService] Created profile ${id}`)
    return publicProfile(persisted)
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

export async function editProfile(profile: Profile, currentPassword?: string): Promise<void> {
  const current = readStoredProfile(profile.id)
  if (runningBrowsers.has(profile.id))
    throw new Error(`Profile ${profile.id} must be stopped before editing`)
  authorize(current, currentPassword)
  assertValid(profile)
  const persisted = buildPersisted({ ...profile, passwordHash: current.passwordHash })
  atomicWrite(profilePath(profile.id), persisted)
  logger.info(`[profileService] Updated profile ${profile.id}`)
}

export async function DeleteProfile(profile: Profile): Promise<void> {
  const directory = path.dirname(profilePath(profile.id))
  await stopProfile(profile.id)
  fs.rmSync(directory, { recursive: true, force: true })
  logger.info(`[profileService] Deleted profile ${profile.id}`)
}

export async function stopProfile(profileId: number): Promise<void> {
  profilePath(profileId)
  const record = runningBrowsers.get(profileId)
  if (!record) return
  if (!record.closing) {
    record.controller.abort()
    record.closing = (async () => {
      if (record.browser?.connected) {
        const pages = await record.browser.pages().catch(() => [])
        if (pages[0]) await exportCookiesToJson(pages[0], path.dirname(profilePath(profileId)))
        await record.browser.close()
      }
      await record.settled
      if (record.browser?.connected) await record.browser.close()
      await record.done
      if (record.error) throw record.error
    })()
  }
  await record.closing
}
export function exportProfileBundle(profile: Profile): string {
  // Cookies and settings travel with the profile; browser-side state (cache,
  // history, extensions) stays on the source machine, matching the persisted
  // profile.json contract used by loadProfiles.
  const bundle = { version: 1, profile: profile }
  return JSON.stringify(bundle, null, 2)
}

export async function exportProfilesBundle(ids: number[]): Promise<string> {
  const profiles = await loadProfiles()
  const selected = ids.length ? profiles.filter((p) => ids.includes(p.id)) : profiles
  const stored = selected.map((profile) =>
    normalizeProfile(
      JSON.parse(
        fs.readFileSync(path.join(datadir, 'profiles', String(profile.id), 'profile.json'), 'utf8')
      ) as Partial<StoredProfile>
    )
  )
  return JSON.stringify({ version: 1, profiles: stored }, null, 2)
}

export async function importProfilesBundle(
  contents: string
): Promise<{ imported: number; skipped: string[] }> {
  const parsed: unknown = JSON.parse(contents)
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('profiles' in parsed) ||
    !Array.isArray(parsed.profiles)
  ) {
    throw new Error('Invalid bundle: expected { version: 1, profiles: Profile[] }')
  }

  if (!('version' in parsed) || parsed.version !== 1) throw new Error('Invalid bundle version')
  const skipped: string[] = []
  let imported = 0

  for (const raw of parsed.profiles) {
    if (!raw || typeof raw !== 'object') {
      skipped.push('invalid entry (not an object)')
      continue
    }
    try {
      const hash = raw.passwordHash
      if (
        hash !== undefined &&
        (typeof hash !== 'string' || !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash))
      )
        throw new Error('Invalid password hash')
      const migrated = migrateProfileSettings(raw)
      assertValid({
        id: 0,
        name: 'Imported',
        useragent: '',
        notes: '',
        proxy: '',
        launched: false,
        ...migrated
      })
      const incoming = normalizeProfile(migrated, false)
      if (fs.existsSync(profilePath(incoming.id))) incoming.id = 0
      createStoredProfile(incoming, hash)
      imported += 1
    } catch {
      skipped.push('Invalid profile entry or import write failed')
    }
  }

  return { imported, skipped }
}

/** Verify a plaintext password against a profile's stored scrypt hash. */
export function verifyProfilePassword(profileId: number, password: string): boolean {
  try {
    const stored = readStoredProfile(profileId)
    return !stored.passwordHash || verifyPassword(password, stored.passwordHash)
  } catch {
    return false
  }
}

/** Create `count` profiles from a config, named `${prefix} ${i}`. */
export async function bulkCreateProfiles(
  config: ProfileConfig,
  count: number,
  prefix: string
): Promise<Profile[]> {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('Count must be an integer between 1 and 100')
  }
  if (!prefix.trim()) throw new Error('Prefix is required')

  const created: Profile[] = []
  for (let i = 1; i <= count; i++) {
    const profile = applyConfigToProfile(
      {
        id: 0,
        name: `${prefix} ${i}`,
        useragent: '',
        notes: '',
        proxy: '',
        launched: false,
        tags: []
      },
      config
    )
    try {
      created.push(await CreateProfile(profile))
    } catch (cause) {
      const error = new Error(
        cause instanceof Error ? cause.message : 'Profile creation failed'
      ) as Error & { createdIds: number[] }
      error.createdIds = created.map((profile) => profile.id)
      throw error
    }
  }
  return created
}

/**
 * Launch a profile's browser, navigate each domain in a tab, harvest the
 * cookies, merge them into the profile store, and return the merged set.
 */
export async function collectCookies(
  profile: Profile,
  domains: string[],
  password?: string
): Promise<PuppeteerCookie[]> {
  const source = readStoredProfile(profile.id)
  assertValid({ ...source, startPages: domains })
  if (!domains.length) throw new Error('Profile invalid: at least one collector URL is required')

  const { browser, page, profileDir, profileData } = await launchProfileForAutomation(
    profile,
    password
  )
  try {
    const found: PuppeteerCookie[] = []
    for (const d of domains) {
      const tab = await newProfilePage(browser, profileData)
      try {
        await tab.goto(d, { waitUntil: 'domcontentloaded' })
        const params = (await tab.cookies()) as unknown as PuppeteerCookie[]
        found.push(...params)
      } catch {
        throw new Error('Cookie collector navigation failed')
      } finally {
        await tab.close().catch(() => undefined)
      }
    }
    found.push(...((await page.cookies()) as unknown as PuppeteerCookie[]))
    const byKey = new Map<string, PuppeteerCookie>()
    for (const c of found) byKey.set(`${c.name}:${c.domain ?? ''}:${c.path ?? '/'}`, c)
    const merged = [...byKey.values()]

    const pathCookie = path.join(profileDir, 'cookies.json')
    atomicWrite(pathCookie, merged)
    loadAndStringifyCookies(profileDir, profile.id)
    return merged
  } finally {
    await stopProfile(profile.id)
  }
}

/**
 * Launch a profile from a temporary directory that is deleted on close. The
 * profile is never added to the persisted store or the running list.
 */
export async function launchOneTimeProfile(payload: {
  profileId: number
  password?: string
}): Promise<{ launched: true }> {
  const stored = readStoredProfile(payload.profileId)
  authorize(stored, payload.password)
  const profileData = publicProfile(stored)
  assertValid(profileData)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'threatbrowser-onetime-'))
  const cleanup = (): void => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
  try {
    atomicWrite(path.join(tempDir, 'profile.json'), buildPersisted(profileData))
    await launchEngine(profileData, tempDir, (browser) => {
      browser.once('disconnected', cleanup)
    })
    return { launched: true }
  } catch (error) {
    cleanup()
    throw error
  }
}
