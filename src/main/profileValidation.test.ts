import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveSeed, effectivePlatform, validateProfile } from './profileValidation'
import type { Profile } from '../shared/profileSettings'

const baseProfile: Profile = {
  id: 1,
  name: 'P1',
  useragent: '',
  notes: '',
  proxy: '',
  launched: false
}

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

describe('validateProfile', () => {
  beforeEach(() => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a minimal valid profile', () => {
    expect(validateProfile(baseProfile, 'macos')).toEqual({ ok: true })
  })

  it('accepts geoip without a proxy (engine resolves the direct egress IP)', () => {
    expect(validateProfile({ ...baseProfile, geoip: true }, 'macos')).toEqual({
      ok: true
    })
  })

  it('accepts geoip with a proxy', () => {
    expect(
      validateProfile({ ...baseProfile, geoip: true, proxy: 'http://p:8080' }, 'macos')
    ).toEqual({ ok: true })
  })

  it('rejects width without height and out-of-range dimensions', () => {
    const half = validateProfile({ ...baseProfile, width: 1920 }, 'macos')
    expect(half.ok).toBe(false)
    if (!half.ok) expect(half.errors).toContain('width and height must be set together')

    const tiny = validateProfile({ ...baseProfile, width: 100, height: 200 }, 'macos')
    expect(tiny.ok).toBe(false)
    if (!tiny.ok)
      expect(tiny.errors.some((e) => e.includes('integers between 200 and 8192'))).toBe(true)
  })

  it('accepts paired in-range dimensions', () => {
    expect(validateProfile({ ...baseProfile, width: 1920, height: 1080 }, 'macos')).toEqual({
      ok: true
    })
  })

  it('validates timezone identifiers', () => {
    expect(validateProfile({ ...baseProfile, timezone: 'Europe/Berlin' }, 'macos')).toEqual({
      ok: true
    })
    const bad = validateProfile({ ...baseProfile, timezone: 'Not/AZone' }, 'macos')
    expect(bad.ok).toBe(false)
  })

  it('validates BCP 47 locales', () => {
    expect(validateProfile({ ...baseProfile, locale: 'en-US' }, 'macos')).toEqual({ ok: true })
    const bad = validateProfile({ ...baseProfile, locale: 'en_US' }, 'macos')
    expect(bad.ok).toBe(false)
  })

  it('requires a Chromium user agent matching the engine platform', () => {
    expect(validateProfile({ ...baseProfile, useragent: MAC_UA }, 'macos')).toEqual({ ok: true })
    expect(validateProfile({ ...baseProfile, useragent: WIN_UA }, 'windows')).toEqual({ ok: true })

    const crossOs = validateProfile({ ...baseProfile, useragent: WIN_UA }, 'macos')
    expect(crossOs.ok).toBe(false)

    const firefox = validateProfile(
      { ...baseProfile, useragent: 'Mozilla/5.0 (X11; Linux x86_64) Gecko Firefox/131.0' },
      'windows'
    )
    expect(firefox.ok).toBe(false)
    if (!firefox.ok) expect(firefox.errors.some((e) => e.includes('Chromium-based'))).toBe(true)

    const headless = validateProfile(
      { ...baseProfile, useragent: WIN_UA.replace('Chrome/', 'HeadlessChrome/') },
      'windows'
    )
    expect(headless.ok).toBe(false)
    if (!headless.ok) expect(headless.errors.some((e) => e.includes('HeadlessChrome'))).toBe(true)
  })

  it('rejects managed extra args but allows harmless ones', () => {
    const bad = validateProfile(
      { ...baseProfile, extraArgs: ['--proxy-server=http://evil:1'] },
      'macos'
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.some((e) => e.includes('--proxy-server'))).toBe(true)

    expect(validateProfile({ ...baseProfile, extraArgs: ['--mute-audio'] }, 'macos')).toEqual({
      ok: true
    })
  })

  it('validates geolocation ranges', () => {
    const bad = validateProfile(
      { ...baseProfile, fingerprint: { geolocation: { latitude: 999, longitude: 0 } } },
      'macos'
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.some((e) => e.includes('latitude'))).toBe(true)

    const good = validateProfile(
      { ...baseProfile, fingerprint: { geolocation: { latitude: 52.52, longitude: 13.405 } } },
      'macos'
    )
    expect(good).toEqual({ ok: true })
  })

  it('validates seed range', () => {
    const bad = validateProfile({ ...baseProfile, seed: 42 }, 'macos')
    expect(bad.ok).toBe(false)
    expect(validateProfile({ ...baseProfile, seed: 12345 }, 'macos')).toEqual({ ok: true })
  })

  it('uses structured platform before fallback and legacy fingerprint data', () => {
    const profile: Profile = {
      ...baseProfile,
      platform: 'windows',
      useragent: WIN_UA,
      fingerprint: { platform: 'MacIntel' }
    }
    expect(effectivePlatform({ ...profile, extraArgs: ['--fingerprint-platform=linux'] })).toBe(
      'windows'
    )
    expect(validateProfile(profile, 'macos')).toEqual({ ok: true })
    expect(validateProfile({ ...profile, useragent: MAC_UA }, 'macos').ok).toBe(false)
    expect(
      effectivePlatform({
        extraArgs: [null, '--fingerprint-platform=linux-invalid', '--fingerprint-platform=linux']
      })
    ).toBe('linux')
    expect(effectivePlatform(null)).toBe('macos')
  })

  it('rejects macOS identities on non-Darwin hosts', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' })
    expect(validateProfile({ ...baseProfile, platform: 'macos' }, 'windows')).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('macOS identity is unavailable')])
    })
    expect(validateProfile({ ...baseProfile, platform: 'windows' }, 'windows')).toEqual({
      ok: true
    })
  })

  it('rejects managed setting overrides with field-specific errors', () => {
    const keys = [
      '--fingerprint-platform',
      '--fingerprint-brand',
      '--fingerprint-brand-version',
      '--fingerprint-gpu-renderer',
      '--fingerprint-gpu-vendor',
      '--fingerprint-hardware-concurrency',
      '--fingerprint-timezone',
      '--fingerprint-locale',
      '--lang'
    ]
    expect(
      validateProfile(
        {
          ...baseProfile,
          browserIdentity: 'edge',
          extraArgs: keys.map((key) => `${key}=override`)
        },
        'macos'
      )
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(keys.map((key) => expect.stringContaining(key)))
    })
  })

  it('matches managed arg keys exactly and retains only manual unknown brands', () => {
    expect(
      validateProfile({ ...baseProfile, extraArgs: ['--fingerprint-unrelated=1'] }, 'macos')
    ).toEqual({ ok: true })
    const manual = {
      ...baseProfile,
      extraArgs: ['--fingerprint-brand=Custom Browser', '--fingerprint-brand-version=12']
    }
    expect(validateProfile(manual, 'macos')).toEqual({ ok: true })
    expect(validateProfile({ ...manual, browserIdentity: 'edge' }, 'macos').ok).toBe(false)
    expect(validateProfile({ ...manual, brandVersion: '12' }, 'macos').ok).toBe(false)
  })

  it.each([null, false, 'profile', []])('rejects non-profile boundary value %j', (input) => {
    expect(validateProfile(input, 'macos')).toMatchObject({
      ok: false,
      errors: [expect.stringContaining('profile')]
    })
  })

  it('returns field errors for malformed primitive and nested types without coercion', () => {
    const result = validateProfile(
      {
        ...baseProfile,
        id: -1,
        useragent: 3,
        launched: 'false',
        geoip: 'false',
        timezone: [],
        locale: {},
        platform: 'android',
        browserIdentity: 'firefox',
        humanPreset: 'fast',
        extraArgs: [null],
        tags: {},
        startPages: 'https://example.com',
        permissionRules: [null, { origin: 'https://example.com', geolocation: true }],
        resources: { blockImages: 1, cacheEnabled: 'false' },
        fingerprint: { geolocation: false, webrtc: [], webgl: null }
      },
      'macos'
    )
    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(
        [
          'id',
          'useragent',
          'launched',
          'geoip',
          'timezone',
          'locale',
          'platform',
          'browserIdentity',
          'humanPreset',
          'extraArgs',
          'tags',
          'startPages',
          'permissionRules[0]',
          'permissionRules[1].geolocation',
          'resources.blockImages',
          'resources.cacheEnabled',
          'geolocation',
          'fingerprint.webrtc',
          'fingerprint.webgl'
        ].map((field) => expect.stringContaining(field))
      )
    })
  })

  it.each<[Record<string, unknown>, string]>([
    [{ fingerprint: null }, 'fingerprint'],
    [{ resources: [] }, 'resources'],
    [{ permissionRules: {} }, 'permissionRules'],
    [{ fingerprint: { geolocation: { latitude: NaN, longitude: 0 } } }, 'latitude'],
    [{ fingerprint: { geolocation: { latitude: 0 } } }, 'longitude'],
    [{ fingerprint: { geolocation: { latitude: 0, longitude: Infinity } } }, 'longitude'],
    [{ fingerprint: { geolocation: { latitude: 0, longitude: 0, accuracy: -1 } } }, 'accuracy'],
    [
      { fingerprint: { geolocation: { latitude: 0, longitude: 0, accuracy: Infinity } } },
      'accuracy'
    ],
    [{ fingerprint: { hardwareConcurrency: 1.5 } }, 'hardwareConcurrency'],
    [{ fingerprint: { hardwareConcurrency: 129 } }, 'hardwareConcurrency'],
    [{ width: NaN, height: 800 }, 'width/height'],
    [{ browserIdentity: 'edge', brandVersion: '1.2.3.4.5' }, 'brandVersion'],
    [{ browserIdentity: 'brave', brandVersion: '65536' }, 'brandVersion'],
    [{ browserIdentity: 'chrome', brandVersion: '123' }, 'brandVersion'],
    [{ startPages: ['javascript:alert(1)'] }, 'startPages'],
    [{ startPages: ['https://user:secret@example.com'] }, 'startPages'],
    [{ permissionRules: [{ origin: 'https://example.com/path' }] }, 'origin'],
    [{ permissionRules: [{ origin: 'https://example.com?query' }] }, 'origin'],
    [{ permissionRules: [{ origin: 'https://example.com#hash' }] }, 'origin'],
    [
      {
        permissionRules: [{ origin: 'https://EXAMPLE.com:443' }, { origin: 'https://example.com' }]
      },
      'unique'
    ],
    [{ startPages: Array(21).fill('https://example.com') }, 'at most 20'],
    [
      {
        permissionRules: Array.from({ length: 21 }, (_, index) => ({
          origin: `https://example${index}.com`
        }))
      },
      'at most 20'
    ]
  ])('rejects invalid boundary %j', (patch, field) => {
    expect(validateProfile({ ...baseProfile, ...patch }, 'macos')).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining(field as string)])
    })
  })

  it('accepts real zero coordinates, full IANA zones and BCP 47 extensions', () => {
    expect(
      validateProfile(
        {
          ...baseProfile,
          id: 0,
          platform: 'windows',
          browserIdentity: 'edge',
          brandVersion: '65535.0.1.2',
          geoip: false,
          timezone: 'America/Argentina/Buenos_Aires',
          locale: 'en-US-u-ca-gregory',
          fingerprint: {
            geolocation: { latitude: 0, longitude: 0, accuracy: 0 },
            hardwareConcurrency: 128,
            opaque: { retained: true }
          },
          permissionRules: [
            { origin: 'http://localhost:8000', geolocation: 'allow', notifications: 'prompt' }
          ],
          resources: { blockImages: false, blockMedia: true, cacheEnabled: false }
        },
        'windows'
      )
    ).toEqual({ ok: true })
    expect(validateProfile({ ...baseProfile, timezone: 'UTC' }, 'macos')).toEqual({ ok: true })
  })

  it('rejects provably incompatible GPU pins without inventing allowed models', () => {
    for (const [platform, renderer] of [
      ['windows', 'Apple M4'],
      ['linux', 'ANGLE Metal'],
      ['macos', 'Direct3D11'],
      ['linux', 'Direct3D11']
    ] as const) {
      expect(
        validateProfile(
          { ...baseProfile, platform, fingerprint: { webgl: { renderer } } },
          platform
        )
      ).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([expect.stringContaining('conflicts')])
      })
    }
    expect(
      validateProfile(
        {
          ...baseProfile,
          platform: 'windows',
          fingerprint: { webgl: { renderer: 'Custom OpenGL', vendor: 'Custom vendor' } }
        },
        'windows'
      )
    ).toEqual({ ok: true })
    expect(
      validateProfile({ ...baseProfile, fingerprint: { webgl: { vendor: ' ' } } }, 'macos').ok
    ).toBe(false)
  })

  it('requires a proxy for webrtc ip (public-IP spoof) mode', () => {
    const withoutProxy: Profile = {
      ...baseProfile,
      fingerprint: { webrtc: { mode: 'ip' } }
    }
    const withProxy: Profile = {
      ...baseProfile,
      proxy: 'http://user:pass@1.2.3.4:8080',
      fingerprint: { webrtc: { mode: 'ip' } }
    }
    expect(validateProfile(withoutProxy, 'macos')).toEqual({
      ok: false,
      errors: ['webrtc ip mode requires a proxy (it spoofs the WebRTC IP to the proxy exit IP)']
    })
    expect(validateProfile(withProxy, 'macos')).toEqual({ ok: true })
  })
})

describe('deriveSeed', () => {
  it('returns a stable in-range seed for the same id', () => {
    const first = deriveSeed(123456)
    const second = deriveSeed(123456)
    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(10000)
    expect(first).toBeLessThanOrEqual(99999)
  })
})
