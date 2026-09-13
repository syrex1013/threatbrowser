export type EnginePlatform = 'macos' | 'windows' | 'linux'
export type BrowserIdentity = 'chrome' | 'chromium' | 'edge' | 'opera' | 'brave'
export type PermissionChoice = 'allow' | 'deny' | 'prompt'
export type PermissionRule = {
  origin: string
  geolocation?: PermissionChoice
  notifications?: PermissionChoice
}
export type ProfileResources = {
  blockImages?: boolean
  blockMedia?: boolean
  cacheEnabled?: boolean
}
export { profileIdentity } from './profileIdentity'
export type { ProfileIdentity } from './profileIdentity'

export interface Fingerprint {
  timezone?: string
  locale?: string
  languages?: string[]
  platform?: string
  hardwareConcurrency?: number
  deviceMemory?: number
  viewport?: {
    width: number
    height: number
    deviceScaleFactor?: number
    isMobile?: boolean
    hasTouch?: boolean
  }
  geolocation?: { latitude: number; longitude: number; accuracy?: number }
  webrtc?: { mode: 'default' | 'disable' | 'proxyOnly' | 'ip' | 'real' }
  webgl?: { vendor?: string; renderer?: string }
  [key: string]: unknown
}

export interface Profile {
  id: number
  name: string
  useragent: string
  notes: string
  proxy: string
  proxyId?: number
  launched: boolean
  cookies?: string
  fingerprint?: Fingerprint
  startPages?: string[]
  folder?: string
  pinnedTag?: string
  /** Transient replacement password; never persisted. */
  password?: string
  hasPassword?: boolean
  tags?: string[]
  platform?: EnginePlatform
  browserIdentity?: BrowserIdentity
  brandVersion?: string
  permissionRules?: PermissionRule[]
  resources?: ProfileResources
  humanize?: boolean
  geoip?: boolean
  timezone?: string
  locale?: string
  extensions?: string[]
  browserVersion?: string
  humanPreset?: 'default' | 'careful'
  width?: number
  height?: number
  extraArgs?: string[]
  seed?: number
}

export interface ProfileConfig {
  id: number
  name: string
  description?: string
  platform?: EnginePlatform
  browserIdentity?: BrowserIdentity
  brandVersion?: string
  useragent?: string
  humanize: boolean
  humanPreset: 'default' | 'careful'
  geoip: boolean
  timezone: string
  locale: string
  width?: number
  height?: number
  webrtcMode: NonNullable<Fingerprint['webrtc']>['mode']
  gpuRenderer?: string
  gpuVendor?: string
  cores?: number
  geolocation?: Fingerprint['geolocation']
  permissionRules?: PermissionRule[]
  resources?: ProfileResources
  browserVersion: string
  startPages?: string[]
  folder?: string
  extensions: string[]
  extraArgs: string[]
}

const configFields = [
  'platform',
  'browserIdentity',
  'brandVersion',
  'useragent',
  'humanize',
  'humanPreset',
  'geoip',
  'timezone',
  'locale',
  'width',
  'height',
  'browserVersion',
  'startPages',
  'folder',
  'extensions',
  'extraArgs',
  'permissionRules',
  'resources'
] as const

/** Config owns runtime settings, never profile identity, secrets or fingerprint seed. */
export function applyConfigToProfile(profile: Profile, config: ProfileConfig): Profile {
  const result = structuredClone(profile)
  for (const field of configFields) {
    if (config[field] === undefined) delete result[field]
    else Object.assign(result, { [field]: structuredClone(config[field]) })
  }
  result.useragent = config.useragent ?? ''
  const fingerprint = (result.fingerprint ??= {})
  // Legacy location aliases must not resurrect a cleared override.
  delete fingerprint.timezone
  delete fingerprint.locale
  for (const field of ['geolocation', 'webgl', 'hardwareConcurrency', 'webrtc'] as const)
    delete fingerprint[field]
  if (config.geolocation !== undefined)
    fingerprint.geolocation = structuredClone(config.geolocation)
  if (config.gpuRenderer !== undefined || config.gpuVendor !== undefined)
    fingerprint.webgl = { renderer: config.gpuRenderer, vendor: config.gpuVendor }
  if (config.cores !== undefined) fingerprint.hardwareConcurrency = config.cores
  fingerprint.webrtc = { mode: config.webrtcMode }
  Object.assign(
    result,
    migrateProfileSettings({
      platform: result.platform,
      browserIdentity: result.browserIdentity,
      brandVersion: result.brandVersion,
      extraArgs: result.extraArgs
    })
  )
  return result
}

export function profileToConfig(profile: Profile, name: string): Omit<ProfileConfig, 'id'> {
  const source = structuredClone(profile)
  return {
    name,
    platform: source.platform,
    browserIdentity: source.browserIdentity,
    brandVersion: source.brandVersion,
    useragent: source.useragent,
    humanize: source.humanize ?? false,
    humanPreset: source.humanPreset ?? 'default',
    geoip: source.geoip ?? false,
    timezone: source.timezone ?? source.fingerprint?.timezone ?? '',
    locale: source.locale ?? source.fingerprint?.locale ?? '',
    width: source.width,
    height: source.height,
    webrtcMode: source.fingerprint?.webrtc?.mode ?? 'default',
    gpuRenderer: source.fingerprint?.webgl?.renderer,
    gpuVendor: source.fingerprint?.webgl?.vendor,
    cores: source.fingerprint?.hardwareConcurrency,
    geolocation: source.fingerprint?.geolocation,
    permissionRules: source.permissionRules,
    resources: source.resources,
    browserVersion: source.browserVersion ?? '',
    startPages: source.startPages ?? [],
    folder: source.folder || undefined,
    extensions: source.extensions ?? [],
    extraArgs: source.extraArgs ?? []
  }
}

/** Read migration only. Callers persist it on the next successful save. */
export function migrateProfileSettings<T extends Partial<Profile>>(profile: T): T {
  const result = structuredClone(profile)
  const legacy = result as T & { startUrl?: string }
  if (result.startPages === undefined && legacy.startUrl) result.startPages = [legacy.startUrl]
  delete legacy.startUrl
  const args = result.extraArgs
  if (Array.isArray(args)) {
    const platforms = ['macos', 'windows', 'linux']
    const brands: Record<string, BrowserIdentity> = {
      Chrome: 'chrome',
      Chromium: 'chromium',
      'Microsoft Edge': 'edge',
      Edge: 'edge',
      Edg: 'edge',
      Opera: 'opera',
      Brave: 'brave'
    }
    let migratedBrand = Boolean(result.browserIdentity)
    for (const arg of args) {
      if (typeof arg !== 'string') continue
      const equal = arg.indexOf('=')
      const key = arg.slice(0, equal),
        value = arg.slice(equal + 1)
      if (key === '--fingerprint-platform' && platforms.includes(value))
        result.platform ??= value as EnginePlatform
      if (key === '--fingerprint-brand' && brands[value]) {
        result.browserIdentity ??= brands[value]
        migratedBrand = true
      }
    }
    if (migratedBrand) {
      const version = args.find(
        (arg) => typeof arg === 'string' && arg.startsWith('--fingerprint-brand-version=')
      )
      if (version) result.brandVersion ??= version.slice(version.indexOf('=') + 1)
    }
    result.extraArgs = args.filter((arg) => {
      if (typeof arg !== 'string') return true
      const [key, value] = arg.split('=', 2)
      return (
        !(key === '--fingerprint-platform' && platforms.includes(value)) &&
        !(migratedBrand && (key === '--fingerprint-brand' || key === '--fingerprint-brand-version'))
      )
    })
  }
  const fingerprint = result.fingerprint
  if (fingerprint) {
    const permissions = fingerprint.permissions as
      Pick<PermissionRule, 'geolocation' | 'notifications'> | undefined
    if (result.permissionRules === undefined && (fingerprint.geolocation || permissions)) {
      try {
        const url = new URL(result.startPages?.[0] ?? '')
        if (['http:', 'https:'].includes(url.protocol))
          result.permissionRules = [
            {
              origin: url.origin,
              ...(fingerprint.geolocation ? { geolocation: 'allow' as const } : {}),
              ...permissions
            }
          ]
      } catch {
        /* No valid first origin: preserve location without granting permission. */
      }
    }
    delete fingerprint.permissions
  }
  return result
}

export type ProfileBatchPatch = {
  config?: ProfileConfig
  folder?: string | null
  tags?: { mode: 'add' | 'remove' | 'replace'; values: string[] }
  proxyId?: number | null
}
export type ProfileBatchPreview = {
  id: number
  name: string
  version: string
  changes: Array<{ field: string; before: unknown; after: unknown }>
  error?: string
}
export type ProfileActionResult = {
  id: number
  status: 'updated' | 'started' | 'stopped' | 'skipped' | 'failed'
  reason?:
    | 'not-found'
    | 'running'
    | 'not-running'
    | 'requires-password'
    | 'changed'
    | 'invalid'
    | 'io-error'
    | 'launch-error'
  message?: string
}
