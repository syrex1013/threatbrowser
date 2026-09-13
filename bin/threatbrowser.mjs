#!/usr/bin/env node
/**
 * ThreatBrowser CLI — framework-compatible launches on the CloakBrowser
 * stealth engine plus binary management.
 *
 * Drop-in replacement contract: pick a framework and point your existing
 * automation at the printed endpoint, or run the launch yourself with the
 * upstream `cloakbrowser` package (Playwright default entry, Puppeteer under
 * cloakbrowser/puppeteer). Selenium attaches over the CDP endpoint.
 *
 * Usage:
 *   threatbrowser launch --profile <id> [--framework puppeteer|playwright|selenium] [--headless] [--port <n>]
 *   threatbrowser install|info|update|clear-cache
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROFILE_FIELDS = [
  'id',
  'name',
  'useragent',
  'notes',
  'proxy',
  'proxyId',
  'launched',
  'cookies',
  'fingerprint',
  'startUrl',
  'tags',
  'humanize',
  'geoip',
  'timezone',
  'locale',
  'extensions',
  'browserVersion'
]

function profilesDir() {
  if (process.env.THREATBROWSER_DATA_DIR) {
    return path.join(process.env.THREATBROWSER_DATA_DIR, 'profiles')
  }
  const base =
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'threatbrowser')
      : process.platform === 'win32'
        ? path.join(
            process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
            'threatbrowser'
          )
        : path.join(
            process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
            'threatbrowser'
          )
  return path.join(base, 'profiles')
}

// Stable per-profile seed in the engine's 5-digit range (mirrors
// src/main/profileValidation.ts deriveSeed; the TS module is not importable
// from this plain .mjs without a build step).
function deriveSeed(profileId) {
  return 10000 + (Math.abs(Math.trunc(profileId)) % 90000)
}

function normalizeProfile(raw) {
  const normalized = {}
  for (const key of PROFILE_FIELDS) {
    normalized[key] = raw?.[key]
  }
  normalized.id = raw?.id ?? Date.now()
  normalized.name = raw?.name ?? 'Unnamed profile'
  normalized.useragent = raw?.useragent ?? ''
  normalized.notes = raw?.notes ?? ''
  normalized.proxy = raw?.proxy ?? ''
  normalized.launched = raw?.launched ?? false
  normalized.humanize = raw?.humanize ?? false
  normalized.geoip = raw?.geoip ?? false
  normalized.timezone = raw?.timezone ?? ''
  normalized.locale = raw?.locale ?? ''
  normalized.extensions = Array.isArray(raw?.extensions) ? raw.extensions : []
  normalized.browserVersion = raw?.browserVersion ?? ''
  normalized.seed = typeof raw?.seed === 'number' ? raw.seed : deriveSeed(normalized.id)
  return normalized
}

// Preseed Google as the address-bar search engine for fresh profiles; Chromium
// keeps a mirrored copy of the DSE data and clears both on mismatch, so the
// dicts must be written identically. See src/main/profileService.ts.
function ensureGoogleDefaultSearch(userDataDir) {
  const preferencesPath = path.join(userDataDir, 'Default', 'Preferences')
  let prefs = {}
  try {
    prefs = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
  } catch {
    // Missing Preferences: fresh profile.
  }
  if (prefs.default_search_provider_data?.template_url_data !== undefined) return
  const google = {
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
  }
  prefs.default_search_provider_data = {
    template_url_data: google,
    mirrored_template_url_data: google
  }
  fs.mkdirSync(path.join(userDataDir, 'Default'), { recursive: true })
  fs.writeFileSync(preferencesPath, JSON.stringify(prefs, null, 2))
}

function loadProfile(id) {
  const dir = profilesDir()
  const profilePath = path.join(dir, String(id), 'profile.json')
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile ${id} not found (looked in ${dir})`)
  }
  return normalizeProfile(JSON.parse(fs.readFileSync(profilePath, 'utf8')))
}

function parseArgs(argv) {
  const args = { command: null, flags: {} }
  const positionals = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--') && key !== 'headless') {
        args.flags[key] = next
        i += 1
      } else {
        args.flags[key] = true
      }
    } else {
      positionals.push(arg)
    }
  }
  args.command = positionals[0] ?? 'help'
  args.positionals = positionals.slice(1)
  return args
}

function usage() {
  return [
    'Usage:',
    '  threatbrowser launch --profile <id> [--framework puppeteer|playwright|selenium] [--headless] [--port <n>]',
    '  threatbrowser install | info | update | clear-cache | help',
    '',
    'launch examples:',
    '  threatbrowser launch --profile 1 --framework puppeteer',
    '  threatbrowser launch --profile 1 --framework playwright --headless',
    '  threatbrowser launch --profile 1 --framework selenium --port 9222',
    '',
    'Selenium / Puppeteer connect with the printed ws:// endpoint; Playwright users',
    "can also import { launch } from 'cloakbrowser' and pass the same profile options.",
    '',
    'Data dir: THREATBROWSER_DATA_DIR env override, otherwise the OS userData path.'
  ].join('\n')
}

async function main() {
  if (process.version.startsWith('v') && Number(process.version.slice(1).split('.')[0]) < 20) {
    throw new Error('threatbrowser CLI requires Node.js >= 20')
  }

  const { command, flags } = parseArgs(process.argv.slice(2))

  switch (command) {
    case 'help':
    case undefined:
      console.log(usage())
      return
    case 'install': {
      const { ensureBinary, binaryInfo } = await import('cloakbrowser')
      const binaryPath = await ensureBinary(
        flags.licenseKey || process.env.CLOAKBROWSER_LICENSE_KEY,
        flags.browserVersion || process.env.CLOAKBROWSER_VERSION,
        flags.releaseChannel || process.env.CLOAKBROWSER_RELEASE_CHANNEL
      )
      const info = binaryInfo()
      console.log(
        JSON.stringify({ installed: true, binaryPath, version: info.version, tier: info.tier })
      )
      return
    }
    case 'info': {
      const { binaryInfo } = await import('cloakbrowser')
      console.log(JSON.stringify(binaryInfo()))
      return
    }
    case 'update': {
      const { checkForUpdate, ensureBinary } = await import('cloakbrowser')
      const next = await checkForUpdate()
      if (!next) {
        console.log(JSON.stringify({ updated: false }))
        return
      }
      await ensureBinary(
        flags.licenseKey || process.env.CLOAKBROWSER_LICENSE_KEY,
        next,
        flags.releaseChannel || process.env.CLOAKBROWSER_RELEASE_CHANNEL
      )
      console.log(JSON.stringify({ updated: true, version: next }))
      return
    }
    case 'clear-cache': {
      const { clearCache } = await import('cloakbrowser')
      clearCache()
      console.log(JSON.stringify({ cleared: true }))
      return
    }
    case 'launch': {
      await launch(flags)
      return
    }
    default:
      throw new Error(`Unknown command: ${command}\n${usage()}`)
  }
}

async function launch(flags) {
  if (!flags.profile) throw new Error('launch requires --profile <id>')
  const framework = flags.framework ?? 'puppeteer'
  if (!['puppeteer', 'playwright', 'selenium'].includes(framework)) {
    throw new Error(`Unsupported framework: ${framework}`)
  }

  const profile = loadProfile(flags.profile)
  const userDataDir = path.join(profilesDir(), String(profile.id))

  // Same rule as the app path: preseed Google as the omnibox search engine for
  // fresh profiles (skip when the browser already stored a user choice).
  ensureGoogleDefaultSearch(userDataDir)
  const headless = Boolean(flags.headless)

  const cliArgs = []
  const webrtcMode = profile.fingerprint?.webrtc?.mode
  if (webrtcMode === 'proxyOnly' || webrtcMode === 'disable') {
    cliArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
  }
  if (webrtcMode === 'disable') {
    cliArgs.push('--disable-features=WebRtcHideLocalIpsWithMdns')
  }
  if (profile.extraArgs?.length) {
    cliArgs.push(...profile.extraArgs)
  }
  if (profile.width && profile.height) {
    cliArgs.push(`--window-size=${Math.round(profile.width)},${Math.round(profile.height)}`)
  }
  // Unshifted first so the persistent seed overrides the engine's random
  // default via upstream buildArgs key dedup.
  cliArgs.unshift(`--fingerprint=${profile.seed ?? deriveSeed(profile.id)}`)
  // Same rule as the app path: no profile proxy means direct networking so a
  // dead OS/env proxy can't show "no internet" in a proxy-less profile.
  if (!profile.proxy?.trim()) cliArgs.push('--no-proxy-server')
  const timezone = profile.timezone || profile.fingerprint?.timezone || undefined
  const locale = profile.locale || profile.fingerprint?.locale || undefined

  const launchOptions = {
    headless,
    humanize: profile.humanize ?? false,
    // Auto GeoIP when no explicit timezone/locale: engine matches them to the
    // egress IP geography (echo services when no proxy), like the app path.
    geoip: profile.geoip || (!timezone && !locale),
    timezone,
    locale,
    proxy: profile.proxy?.trim() || undefined,
    extensionPaths: (profile.extensions ?? []).filter((p) => fs.existsSync(p)),
    browserVersion: profile.browserVersion || undefined,
    args: cliArgs,
    launchOptions: { userDataDir }
  }
  if (framework === 'selenium') {
    return launchSelenium(launchOptions, profile, flags)
  }

  if (framework === 'playwright') {
    const { launchPersistentContext, binaryInfo } = await import('cloakbrowser')
    const { launchOptions: userDataOption, ...playwrightOptions } = launchOptions
    const context = await launchPersistentContext({
      ...playwrightOptions,
      userDataDir: userDataOption.userDataDir
    })
    const info = binaryInfo()
    console.log(
      JSON.stringify({
        profileId: profile.id,
        framework: 'playwright',
        binaryVersion: info.version,
        binaryPath: info.binaryPath,
        humanize: launchOptions.humanize,
        geoip: launchOptions.geoip,
        endpoint: null
      })
    )
    await new Promise((resolve) => {
      const stop = async () => {
        await context.close().catch(() => undefined)
        resolve()
      }
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    })
    return
  }

  // puppeteer
  const { launch: puppeteerLaunch } = await import('cloakbrowser/puppeteer')
  const { binaryInfo } = await import('cloakbrowser')
  const browser = await puppeteerLaunch(launchOptions)
  const info = binaryInfo()
  console.log(
    JSON.stringify({
      profileId: profile.id,
      framework: 'puppeteer',
      binaryVersion: info.version,
      binaryPath: info.binaryPath,
      humanize: launchOptions.humanize,
      geoip: launchOptions.geoip,
      endpoint: browser.wsEndpoint()
    })
  )
  await new Promise((resolve) => {
    const stop = async () => {
      await browser.close().catch(() => undefined)
      resolve()
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  })
}

async function launchSelenium(launchOptions, profile, flags) {
  const port = flags.port ? Number(flags.port) : 0
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${flags.port}`)
  }

  const { ensureBinary, binaryInfo } = await import('cloakbrowser')
  const binaryPath = await ensureBinary(
    flags.licenseKey || process.env.CLOAKBROWSER_LICENSE_KEY,
    profile.browserVersion || undefined,
    flags.releaseChannel || process.env.CLOAKBROWSER_RELEASE_CHANNEL
  )

  const args = [
    '--remote-debugging-port=' + port,
    `--user-data-dir=${launchOptions.launchOptions.userDataDir}`,
    ...launchOptions.args
  ]
  if (launchOptions.proxy) args.push(`--proxy-server=${launchOptions.proxy}`)
  if (launchOptions.timezone) args.push(`--fingerprint-timezone=${launchOptions.timezone}`)
  if (launchOptions.locale) args.push(`--lang=${launchOptions.locale}`)
  if (flags.headless) args.push('--headless=new')
  for (const ext of launchOptions.extensionPaths) args.push(`--load-extension=${ext}`)
  args.push('about:blank')

  const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const info = binaryInfo()

  const endpoint = await new Promise((resolve, reject) => {
    let stderr = ''
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for the DevTools endpoint'))
    }, 60000)
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code !== 0) reject(new Error(`Browser exited early (${code}): ${stderr.slice(-500)}`))
    })
  })

  console.log(
    JSON.stringify({
      profileId: profile.id,
      framework: 'selenium',
      binaryVersion: info.version,
      binaryPath: info.binaryPath,
      humanize: launchOptions.humanize,
      geoip: launchOptions.geoip,
      endpoint
    })
  )

  await new Promise((resolve) => {
    const stop = () => {
      child.kill('SIGTERM')
      resolve()
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    child.on('exit', () => resolve())
  })
}

main().then(
  () => {
    process.exit(0)
  },
  (err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
)
