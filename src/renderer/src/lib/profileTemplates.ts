import type { ProfileConfig } from '../../../shared/profileSettings'

/**
 * Built-in profile templates. Every option in every template maps to a
 * verified engine mechanism — no aspirational fields:
 *
 * - `--fingerprint-platform=windows|linux` (verified: coherent UA, platform
 *   and platform-matched GPU on any host; `android` is unsupported).
 * - `--fingerprint-brand=<name> --fingerprint-brand-version=<v>` (verified:
 *   UA-CH brands on secure pages, e.g. "Microsoft Edge/145 Chromium/145").
 * - UA strings, cores, window size — all standard profile fields.
 *
 * Firefox and Safari engine identities are impossible: the stealth engine is
 * Chromium; a Firefox/Safari UA over Chromium semantics is an instant
 * detection (cross-signal inconsistency), so they are not offered.
 */

const CHROME_MAJOR = '145'
const CHROME_FULL = '145.0.0.0'

export type BrowserIdentity = 'chrome' | 'chromium' | 'edge' | 'opera' | 'brave'

type PlatformUa = {
  macos: string
  windows: string
  linux: string
}

const UA_BY_PLATFORM: Record<BrowserIdentity, PlatformUa> = {
  chrome: {
    macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`
  },
  chromium: {
    macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`
  },
  edge: {
    macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 Edg/${CHROME_FULL}`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 Edg/${CHROME_FULL}`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 Edg/${CHROME_FULL}`
  },
  opera: {
    macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 OPR/116.0.0.0`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 OPR/116.0.0.0`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36 OPR/116.0.0.0`
  },
  brave: {
    macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL} Safari/537.36`
  }
}

/** Brand flags the engine honors in UA-CH on secure pages. */
function brandArgs(identity: BrowserIdentity): string[] {
  switch (identity) {
    case 'edge':
      return [`--fingerprint-brand=Microsoft Edge`, `--fingerprint-brand-version=${CHROME_MAJOR}`]
    case 'opera':
      return [`--fingerprint-brand=Opera`, `--fingerprint-brand-version=116`]
    case 'brave':
      return [`--fingerprint-brand=Brave`, `--fingerprint-brand-version=${CHROME_MAJOR}`]
    default:
      return []
  }
}

export function platformArgs(platform: 'macos' | 'windows' | 'linux'): string[] {
  // The engine already defaults to the host-native identity; only spoof
  // explicitly when the template targets another platform.
  return platform === 'macos' ? [] : [`--fingerprint-platform=${platform}`]
}

export function uaFor(identity: BrowserIdentity, platform: 'macos' | 'windows' | 'linux'): string {
  return UA_BY_PLATFORM[identity][platform]
}

type TemplateSpec = {
  key: string
  name: string
  description: string
  identity: BrowserIdentity
  platform: 'macos' | 'windows' | 'linux'
  width?: number
  height?: number
  cores?: number
  humanize?: boolean
  humanPreset?: 'default' | 'careful'
}

const SPECS: TemplateSpec[] = [
  // — Windows · Chrome —
  {
    key: 'win-chrome-standard',
    name: 'Windows · Chrome · Standard',
    description: 'Windows 11 desktop with a 1080p monitor — the most common visitor profile.',
    identity: 'chrome',
    platform: 'windows',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  },
  {
    key: 'win-chrome-laptop',
    name: 'Windows · Chrome · Laptop',
    description: 'Compact 1366×768 laptop with modest hardware.',
    identity: 'chrome',
    platform: 'windows',
    width: 1366,
    height: 768,
    cores: 8,
    humanize: true
  },
  {
    key: 'win-chrome-workstation',
    name: 'Windows · Chrome · Workstation',
    description: 'High-core count workstation with a 1440p display.',
    identity: 'chrome',
    platform: 'windows',
    width: 2560,
    height: 1440,
    cores: 16,
    humanize: true
  },
  // — Windows · other Chromium browsers —
  {
    key: 'win-edge-standard',
    name: 'Windows · Edge · Standard',
    description: 'Microsoft Edge on Windows 11 — the platform default browser.',
    identity: 'edge',
    platform: 'windows',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  },
  {
    key: 'win-edge-laptop',
    name: 'Windows · Edge · Laptop',
    description: 'Edge on a compact laptop, careful human timing.',
    identity: 'edge',
    platform: 'windows',
    width: 1366,
    height: 768,
    cores: 8,
    humanize: true,
    humanPreset: 'careful'
  },
  {
    key: 'win-opera-standard',
    name: 'Windows · Opera · Standard',
    description: 'Opera with its OPR UA suffix and brand hints.',
    identity: 'opera',
    platform: 'windows',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  },
  {
    key: 'win-brave-standard',
    name: 'Windows · Brave · Standard',
    description: 'Brave looks like Chrome in the UA with Brave brand hints.',
    identity: 'brave',
    platform: 'windows',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  },
  // — Windows · Chromium dev —
  {
    key: 'win-chromium-dev',
    name: 'Windows · Chromium · Dev',
    description: 'Plain Chromium build for development and testing.',
    identity: 'chromium',
    platform: 'windows',
    width: 1920,
    height: 1080,
    cores: 12
  },
  // — macOS —
  {
    key: 'mac-chrome-native',
    name: 'macOS · Chrome · Native',
    description: 'Host-native Mac identity — engine-matched GPU and hardware.',
    identity: 'chrome',
    platform: 'macos',
    humanize: true
  },
  {
    key: 'mac-chrome-careful',
    name: 'macOS · Chrome · Careful',
    description: 'Native Mac identity with slower, more cautious human timing.',
    identity: 'chrome',
    platform: 'macos',
    humanize: true,
    humanPreset: 'careful'
  },
  {
    key: 'mac-edge-standard',
    name: 'macOS · Edge · Standard',
    description: 'Microsoft Edge on macOS.',
    identity: 'edge',
    platform: 'macos',
    humanize: true
  },
  {
    key: 'mac-chromium-dev',
    name: 'macOS · Chromium · Dev',
    description: 'Plain Chromium on the native Mac identity.',
    identity: 'chromium',
    platform: 'macos'
  },
  // — Linux —
  {
    key: 'linux-chrome-standard',
    name: 'Linux · Chrome · Standard',
    description: 'X11 Linux desktop with the engine’s OpenGL GPU template.',
    identity: 'chrome',
    platform: 'linux',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  },
  {
    key: 'linux-chrome-workstation',
    name: 'Linux · Chrome · Workstation',
    description: 'High-core Linux workstation at 1440p.',
    identity: 'chrome',
    platform: 'linux',
    width: 2560,
    height: 1440,
    cores: 16,
    humanize: true
  },
  {
    key: 'linux-chromium-dev',
    name: 'Linux · Chromium · Dev',
    description: 'Plain Chromium for Linux-based automation rigs.',
    identity: 'chromium',
    platform: 'linux',
    width: 1920,
    height: 1080,
    cores: 12
  },
  {
    key: 'linux-opera-standard',
    name: 'Linux · Opera · Standard',
    description: 'Opera on X11 Linux.',
    identity: 'opera',
    platform: 'linux',
    width: 1920,
    height: 1080,
    cores: 8,
    humanize: true
  }
]

/** Built-in templates as ProfileConfigs with stable negative ids. */
export const PROFILE_TEMPLATES: ProfileConfig[] = SPECS.map((spec, index) => ({
  id: -(index + 1),
  name: spec.name,
  description: spec.description,
  platform: spec.platform,
  useragent: uaFor(spec.identity, spec.platform),
  humanize: spec.humanize ?? false,
  humanPreset: spec.humanPreset ?? 'default',
  geoip: true,
  timezone: '',
  locale: '',
  width: spec.width,
  height: spec.height,
  webrtcMode: 'default',
  cores: spec.cores,
  browserVersion: '',
  extensions: [],
  extraArgs: [...platformArgs(spec.platform), ...brandArgs(spec.identity)]
}))

export const TEMPLATE_UNSUPPORTED_NOTE =
  'Firefox, Safari and mobile/Android identities are not offered: the stealth engine is ' +
  'Chromium-based, and those UA/engine combinations are instantly inconsistent (the ' +
  'cross-signal rule every fingerprint checker scores). Windows, macOS and Linux × ' +
  'Chrome, Chromium, Edge, Opera and Brave are fully supported.'
