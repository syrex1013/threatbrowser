import type { EnginePlatform, Profile } from '../shared/profileSettings'

export function enginePlatform(): EnginePlatform {
  // The stealth engine runs darwin hosts as a native Mac browser and spoofs
  // Windows on every other platform (upstream getDefaultStealthArgs).
  return process.platform === 'darwin' ? 'macos' : 'windows'
}

/** Structured platform wins; legacy raw flags are read until migration on save. */
export function effectivePlatform(input: unknown): EnginePlatform {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return enginePlatform()
  const profile = input as Profile
  if (PLATFORMS.includes(profile.platform as EnginePlatform))
    return profile.platform as EnginePlatform
  if (Array.isArray(profile.extraArgs)) {
    for (const arg of profile.extraArgs) {
      if (typeof arg !== 'string') continue
      const match = arg.match(/^--fingerprint-platform=(macos|windows|linux)$/)
      if (match) return match[1] as EnginePlatform
    }
  }
  return enginePlatform()
}

export function deriveSeed(profileId: number): number {
  // Stable per profile, inside the engine's own 5-digit seed range.
  return 10000 + (Math.abs(Math.trunc(profileId)) % 90000)
}

const PLATFORMS: EnginePlatform[] = ['macos', 'windows', 'linux']
const BROWSER_IDENTITIES = ['chrome', 'chromium', 'edge', 'opera', 'brave']
const KNOWN_BRANDS = ['Chrome', 'Chromium', 'Microsoft Edge', 'Edge', 'Opera', 'Brave']
const BRAND_ARGS = ['--fingerprint-brand', '--fingerprint-brand-version']
const MANAGED_ARGS: Record<string, true> = {
  '--user-data-dir': true,
  '--proxy-server': true,
  '--proxy-bypass-list': true,
  '--load-extension': true,
  '--disable-extensions-except': true,
  '--remote-debugging-port': true,
  '--headless': true,
  '--fingerprint': true,
  '--fingerprint-platform': true,
  '--fingerprint-brand': true,
  '--fingerprint-brand-version': true,
  '--fingerprint-gpu-renderer': true,
  '--fingerprint-gpu-vendor': true,
  '--fingerprint-hardware-concurrency': true,
  '--fingerprint-timezone': true,
  '--fingerprint-locale': true,
  '--lang': true,
  '--start-maximized': true,
  '--window-size': true,
  '--enable-automation': true
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function httpUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return null
  try {
    const url = new URL(value)
    return /^https?:\/\//i.test(value) &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null
  } catch {
    return null
  }
}

export function validateProfile(
  input: unknown,
  platform: EnginePlatform
): { ok: true } | { ok: false; errors: string[] } {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, errors: ['profile must be an object'] }
  const errors: string[] = []
  const profile = input as Profile

  if (
    profile.id !== undefined &&
    (!Number.isSafeInteger(profile.id) || (profile.id as number) < 0)
  ) {
    errors.push('id must be a nonnegative safe integer')
  }
  for (const field of ['name', 'useragent', 'notes', 'proxy'] as const) {
    if (typeof profile[field] !== 'string') errors.push(`${field} must be a string`)
  }
  if (typeof profile.name === 'string' && !profile.name.trim())
    errors.push('name must not be blank')
  for (const field of [
    'cookies',
    'folder',
    'pinnedTag',
    'password',
    'timezone',
    'locale',
    'browserVersion',
    'brandVersion'
  ] as const) {
    if (profile[field] !== undefined && typeof profile[field] !== 'string')
      errors.push(`${field} must be a string`)
  }
  if (typeof profile.launched !== 'boolean') errors.push('launched must be a boolean')
  for (const field of ['hasPassword', 'humanize', 'geoip'] as const) {
    if (profile[field] !== undefined && typeof profile[field] !== 'boolean')
      errors.push(`${field} must be a boolean`)
  }
  if (
    profile.proxyId !== undefined &&
    (!Number.isSafeInteger(profile.proxyId) || (profile.proxyId as number) <= 0)
  ) {
    errors.push('proxyId must be a positive safe integer')
  }
  for (const field of ['tags', 'extensions', 'extraArgs'] as const) {
    const values = profile[field]
    if (values === undefined) continue
    if (!Array.isArray(values)) errors.push(`${field} must be an array of strings`)
    else
      for (const value of values) {
        if (typeof value !== 'string') {
          errors.push(`${field} must be an array of strings`)
          break
        }
      }
  }
  if (profile.platform !== undefined && !PLATFORMS.includes(profile.platform as EnginePlatform)) {
    errors.push('platform must be macos, windows or linux')
  }
  if (
    profile.browserIdentity !== undefined &&
    !BROWSER_IDENTITIES.includes(profile.browserIdentity as string)
  ) {
    errors.push('browserIdentity must be chrome, chromium, edge, opera or brave')
  }
  if (
    profile.humanPreset !== undefined &&
    profile.humanPreset !== 'default' &&
    profile.humanPreset !== 'careful'
  ) {
    errors.push('humanPreset must be default or careful')
  }
  if (typeof profile.brandVersion === 'string' && profile.brandVersion !== '') {
    if (
      !/^\d+(?:\.\d+){0,3}$/.test(profile.brandVersion) ||
      profile.brandVersion.split('.').some((part) => Number(part) > 65535)
    ) {
      errors.push('brandVersion must have 1–4 numeric components, each at most 65535')
    }
    if (!['edge', 'opera', 'brave'].includes(profile.browserIdentity as string)) {
      errors.push('brandVersion requires an Edge, Opera or Brave browserIdentity')
    }
  }

  const identityPlatform = PLATFORMS.includes(profile.platform as EnginePlatform)
    ? (profile.platform as EnginePlatform)
    : platform
  if (!PLATFORMS.includes(identityPlatform)) errors.push('platform must be macos, windows or linux')
  if (identityPlatform === 'macos' && process.platform !== 'darwin') {
    errors.push('macOS identity is unavailable on this host')
  }
  if ((profile.width === undefined) !== (profile.height === undefined)) {
    errors.push('width and height must be set together')
  }
  for (const dim of [profile.width, profile.height]) {
    if (dim !== undefined && (!inRange(dim, 200, 8192) || !Number.isInteger(dim))) {
      errors.push('width/height must be integers between 200 and 8192')
      break
    }
  }
  const timezone = profile.timezone || profile.fingerprint?.timezone
  const locale =
    profile.locale || profile.fingerprint?.locale || profile.fingerprint?.languages?.[0]
  if (typeof timezone === 'string' && timezone.trim()) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone.trim() })
    } catch {
      errors.push('timezone is not a valid IANA identifier')
    }
  }
  if (typeof locale === 'string' && locale.trim()) {
    try {
      Intl.getCanonicalLocales(locale.trim())
    } catch {
      errors.push('locale is not a valid BCP 47 tag')
    }
  }

  const ua = typeof profile.useragent === 'string' ? profile.useragent.trim() : ''
  if (ua) {
    if (!/Chrome\/\d+/.test(ua))
      errors.push('user agent must describe a Chromium-based browser (engine identity)')
    if (/HeadlessChrome/.test(ua)) errors.push('user agent must not carry a HeadlessChrome marker')
    const osTokenOk =
      identityPlatform === 'macos'
        ? ua.includes('Macintosh')
        : identityPlatform === 'linux'
          ? /X11.*Linux/.test(ua)
          : ua.includes('Windows NT')
    if (!osTokenOk) {
      errors.push(
        identityPlatform === 'macos'
          ? 'user agent OS token must be Macintosh on the mac identity'
          : identityPlatform === 'linux'
            ? 'user agent OS token must be X11 Linux on the linux identity'
            : 'user agent OS token must be Windows NT on the windows identity'
      )
    }
    if (/Android|Mobile|iPhone|iPad/.test(ua))
      errors.push('user agent must describe a supported desktop identity')
  }

  if (Array.isArray(profile.extraArgs)) {
    const rawBrands = profile.extraArgs.filter(
      (arg): arg is string =>
        typeof arg === 'string' && arg.split('=')[0].trim() === '--fingerprint-brand'
    )
    const manualBrand =
      profile.browserIdentity === undefined &&
      profile.brandVersion === undefined &&
      rawBrands.length > 0 &&
      rawBrands.every((arg) => {
        const brand = arg.slice(arg.indexOf('=') + 1).trim()
        return (
          arg.startsWith('--fingerprint-brand=') &&
          brand.length > 0 &&
          !KNOWN_BRANDS.includes(brand)
        )
      })
    for (const arg of profile.extraArgs) {
      if (typeof arg !== 'string') continue
      const key = arg.split('=')[0].trim()
      if (Object.hasOwn(MANAGED_ARGS, key) && !(manualBrand && BRAND_ARGS.includes(key))) {
        errors.push(`extra arg ${key} is managed by the app/engine and cannot be overridden`)
      }
    }
  }

  if (profile.startPages !== undefined) {
    if (!Array.isArray(profile.startPages)) errors.push('startPages must be an array')
    else {
      if (profile.startPages.length > 20) errors.push('startPages must contain at most 20 URLs')
      for (const [index, url] of profile.startPages.entries()) {
        if (!httpUrl(url))
          errors.push(
            `startPages[${index}] must be an HTTP(S) URL without credentials, at most 2048 characters`
          )
      }
    }
  }
  if (profile.permissionRules !== undefined) {
    if (!Array.isArray(profile.permissionRules)) errors.push('permissionRules must be an array')
    else {
      if (profile.permissionRules.length > 20)
        errors.push('permissionRules must contain at most 20 origins')
      const origins = new Set<string>()
      for (const [index, rule] of profile.permissionRules.entries()) {
        const field = `permissionRules[${index}]`
        if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
          errors.push(`${field} must be an object`)
          continue
        }
        const url = httpUrl(rule.origin)
        if (!url || !/^https?:\/\/[^/?#\\]+$/i.test(rule.origin as string)) {
          errors.push(
            `${field}.origin must be an HTTP(S) origin without credentials, path, query or hash`
          )
        } else if (origins.has(url.origin)) errors.push(`${field}.origin must be unique`)
        else origins.add(url.origin)
        for (const permission of ['geolocation', 'notifications'] as const) {
          if (
            rule[permission] !== undefined &&
            !['allow', 'deny', 'prompt'].includes(rule[permission] as string)
          ) {
            errors.push(`${field}.${permission} must be allow, deny or prompt`)
          }
        }
      }
    }
  }
  if (profile.resources !== undefined) {
    if (
      profile.resources === null ||
      typeof profile.resources !== 'object' ||
      Array.isArray(profile.resources) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(profile.resources))
    )
      errors.push('resources must be an object')
    else
      for (const field of ['blockImages', 'blockMedia', 'cacheEnabled'] as const) {
        if (
          profile.resources[field] !== undefined &&
          typeof profile.resources[field] !== 'boolean'
        ) {
          errors.push(`resources.${field} must be a boolean`)
        }
      }
  }

  if (profile.fingerprint !== undefined) {
    if (
      profile.fingerprint === null ||
      typeof profile.fingerprint !== 'object' ||
      Array.isArray(profile.fingerprint) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(profile.fingerprint))
    )
      errors.push('fingerprint must be an object')
    else {
      const fingerprint = profile.fingerprint
      for (const field of ['timezone', 'locale', 'platform'] as const) {
        if (fingerprint[field] !== undefined && typeof fingerprint[field] !== 'string')
          errors.push(`fingerprint.${field} must be a string`)
      }
      if (fingerprint.languages !== undefined) {
        if (!Array.isArray(fingerprint.languages))
          errors.push('fingerprint.languages must be an array of strings')
        else
          for (const language of fingerprint.languages) {
            if (typeof language !== 'string') {
              errors.push('fingerprint.languages must be an array of strings')
              break
            }
          }
      }
      const cores = fingerprint.hardwareConcurrency
      if (cores !== undefined && (!inRange(cores, 1, 128) || !Number.isInteger(cores))) {
        errors.push('fingerprint.hardwareConcurrency must be an integer between 1 and 128')
      }
      if (
        fingerprint.deviceMemory !== undefined &&
        !inRange(fingerprint.deviceMemory, 0, Number.MAX_VALUE)
      ) {
        errors.push('fingerprint.deviceMemory must be a finite nonnegative number')
      }
      const viewport = fingerprint.viewport
      if (viewport !== undefined) {
        if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport))
          errors.push('fingerprint.viewport must be an object')
        else {
          for (const field of ['width', 'height'] as const) {
            if (
              !inRange(viewport[field], 1, Number.MAX_SAFE_INTEGER) ||
              !Number.isInteger(viewport[field])
            )
              errors.push(`fingerprint.viewport.${field} must be a positive safe integer`)
          }
          if (
            viewport.deviceScaleFactor !== undefined &&
            (!inRange(viewport.deviceScaleFactor, 0, Number.MAX_VALUE) ||
              viewport.deviceScaleFactor === 0)
          )
            errors.push('fingerprint.viewport.deviceScaleFactor must be a finite positive number')
          for (const field of ['isMobile', 'hasTouch'] as const) {
            if (viewport[field] !== undefined && typeof viewport[field] !== 'boolean')
              errors.push(`fingerprint.viewport.${field} must be a boolean`)
          }
        }
      }
      const geo = fingerprint.geolocation
      if (geo !== undefined) {
        if (geo === null || typeof geo !== 'object' || Array.isArray(geo))
          errors.push('geolocation must be an object')
        else {
          if (!inRange(geo.latitude, -90, 90))
            errors.push('geolocation latitude must be finite and within [-90, 90]')
          if (!inRange(geo.longitude, -180, 180))
            errors.push('geolocation longitude must be finite and within [-180, 180]')
          if (geo.accuracy !== undefined && !inRange(geo.accuracy, 0, 1e6))
            errors.push('geolocation accuracy must be finite and within [0, 1000000]')
        }
      }
      const webrtc = fingerprint.webrtc
      if (webrtc !== undefined) {
        if (webrtc === null || typeof webrtc !== 'object' || Array.isArray(webrtc))
          errors.push('fingerprint.webrtc must be an object')
        else if (!['default', 'disable', 'proxyOnly', 'ip', 'real'].includes(webrtc.mode as string))
          errors.push('fingerprint.webrtc.mode must be default, disable, proxyOnly, ip or real')
        else if (
          webrtc.mode === 'ip' &&
          (typeof profile.proxy !== 'string' || !profile.proxy.trim())
        )
          errors.push(
            'webrtc ip mode requires a proxy (it spoofs the WebRTC IP to the proxy exit IP)'
          )
      }
      const webgl = fingerprint.webgl
      if (webgl !== undefined) {
        if (
          webgl === null ||
          typeof webgl !== 'object' ||
          Array.isArray(webgl) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(webgl))
        )
          errors.push('fingerprint.webgl must be an object')
        else
          for (const field of ['vendor', 'renderer'] as const) {
            const value = webgl[field]
            if (value === undefined) continue
            if (typeof value !== 'string' || !value.trim() || value.length > 512)
              errors.push(
                `fingerprint.webgl.${field} must be a nonblank string of at most 512 characters`
              )
            else if (
              (identityPlatform !== 'macos' && /Apple|Metal/i.test(value)) ||
              (identityPlatform !== 'windows' && /Direct3D/i.test(value))
            )
              errors.push(`fingerprint.webgl.${field} conflicts with ${identityPlatform} platform`)
          }
      }
    }
  }
  if (
    profile.seed !== undefined &&
    (!inRange(profile.seed, 10000, 99999) || !Number.isInteger(profile.seed))
  ) {
    errors.push('seed must be an integer between 10000 and 99999')
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
