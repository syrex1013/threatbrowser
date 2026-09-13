import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const tmp = vi.hoisted(() => {
  const base =
    (globalThis as { process?: { env?: { TMPDIR?: string } } }).process?.env?.TMPDIR ?? '/tmp'
  return `${base}/${globalThis.crypto.randomUUID()}`
})

vi.mock('electron', () => ({
  app: { getPath: () => tmp },
  ipcMain: { emit: vi.fn().mockReturnValue(undefined) }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('../logger/logger', () => ({
  default: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined
  }
}))
const engine = vi.hoisted(() => ({ launch: vi.fn() }))
vi.mock('cloakbrowser/puppeteer', () => engine)

import type { Profile, ProfileConfig } from '../shared/profileSettings'
import type { StoredProfile } from './types'
import {
  applyConfigToProfile,
  profileToConfig,
  migrateProfileSettings
} from '../shared/profileSettings'
import { listConfigs, saveConfig } from './configService'
import {
  CreateProfile,
  bulkCreateProfiles,
  editProfile,
  loadProfiles,
  launchProfileForAutomation,
  stopProfile,
  importProfileCookies,
  exportProfilesBundle,
  importProfilesBundle,
  DeleteProfile,
  verifyProfilePassword
} from './profileService'

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: Date.now(),
    name: 'P',
    useragent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    notes: '',
    proxy: '',
    launched: false,
    hasPassword: false,
    ...overrides
  }
}

describe('profileService persistence', () => {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(() => {
    fs.mkdirSync(tmp, { recursive: true })
    const profiles = path.join(tmp, 'profiles')
    if (fs.existsSync(profiles)) fs.rmSync(profiles, { recursive: true, force: true })
    fs.rmSync(path.join(tmp, 'configs.json'), { force: true })
  })

  it('stores a scrypt password hash, never the plaintext, and derives hasPassword on load', async () => {
    const p = profile({ name: 'Gated', password: 'abc123' })
    await CreateProfile(p)

    const stored = JSON.parse(
      fs.readFileSync(path.join(tmp, 'profiles', String(p.id), 'profile.json'), 'utf8')
    ) as Partial<StoredProfile> & Pick<Profile, 'password' | 'hasPassword'>
    expect(stored.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(stored.password).toBeUndefined()
    expect(stored.hasPassword).toBeUndefined()

    expect(verifyProfilePassword(p.id, 'abc123')).toBe(true)
    expect(verifyProfilePassword(p.id, 'wrong')).toBe(false)

    const loaded = await loadProfiles()
    expect(loaded.find((x) => x.id === p.id)?.hasPassword).toBe(true)
    expect(loaded[0]).not.toHaveProperty('passwordHash')
  })

  it('preserves the gate when editing without a new password, and replaces it when one is set', async () => {
    const p = profile({ name: 'Gated', password: 'first' })
    await CreateProfile(p)

    await editProfile({ ...p, password: undefined }, 'first')
    expect(verifyProfilePassword(p.id, 'first')).toBe(true)
    expect(verifyProfilePassword(p.id, 'second')).toBe(false)

    await editProfile({ ...p, password: 'second' }, 'first')
    expect(verifyProfilePassword(p.id, 'first')).toBe(false)
    expect(verifyProfilePassword(p.id, 'second')).toBe(true)
  })

  it('persists folder, pinnedTag and startPages through create and load', async () => {
    const p = profile({
      name: 'Work',
      folder: 'Work',
      pinnedTag: 'urgent',
      startPages: ['https://example.com', 'https://example.org']
    })
    await CreateProfile(p)

    const loaded = await loadProfiles()
    const back = loaded.find((x) => x.id === p.id)
    expect(back?.folder).toBe('Work')
    expect(back?.pinnedTag).toBe('urgent')
    expect(back?.startPages).toEqual(['https://example.com', 'https://example.org'])
  })

  it('migrates a legacy startUrl field into startPages on load', async () => {
    const id = Date.now()
    const dir = path.join(tmp, 'profiles', String(id))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'profile.json'),
      JSON.stringify({ id, name: 'Legacy', useragent: '', startUrl: 'https://old.example.com' })
    )

    const loaded = await loadProfiles()
    expect(loaded.find((x) => x.id === id)?.startPages).toEqual(['https://old.example.com'])
  })

  it('bulk-creates a config-mapped set named prefix 1..N', async () => {
    const config: ProfileConfig = {
      id: 1,
      name: 'cfg',
      humanize: true,
      humanPreset: 'default',
      geoip: false,
      timezone: 'America/New_York',
      locale: 'en-US',
      width: 1280,
      height: 800,
      webrtcMode: 'proxyOnly',
      browserVersion: '',
      folder: 'Ads',
      startPages: ['https://example.com'],
      extensions: [],
      extraArgs: []
    }
    const created = await bulkCreateProfiles(config, 3, 'AD')
    expect(created).toHaveLength(3)
    expect(created.map((c) => c.name)).toEqual(['AD 1', 'AD 2', 'AD 3'])

    const loaded = await loadProfiles()
    const ads = loaded.filter((p) => p.folder === 'Ads')
    expect(ads).toHaveLength(3)
    for (const p of ads) {
      expect(p.fingerprint?.webrtc?.mode).toBe('proxyOnly')
      expect(p.startPages).toEqual(['https://example.com'])
      expect(p.humanize).toBe(true)
    }
  })

  it('round-trips config overrides without aliasing or losing profile-owned data', async () => {
    const original = profile({
      useragent: '',
      platform: 'windows',
      browserIdentity: 'edge',
      proxy: 'http://user:pass@localhost:8080',
      seed: 12345,
      notes: 'keep',
      width: 1234,
      height: 876,
      locale: 'en-GB',
      startPages: ['https://example.com/a'],
      permissionRules: [{ origin: 'https://example.com', geolocation: 'deny' }],
      resources: { blockImages: true, cacheEnabled: false },
      fingerprint: {
        hardwareConcurrency: 12,
        webgl: { vendor: 'Custom vendor', renderer: 'Custom GPU' },
        geolocation: { latitude: 0, longitude: 0, accuracy: 25 },
        opaque: { kept: true }
      }
    })
    const config = { id: 1, ...profileToConfig(original, 'Reusable') }
    const target = profile({
      proxy: 'http://other:secret@localhost:8081',
      seed: 45678,
      fingerprint: { opaque: { other: true } }
    })
    const applied = applyConfigToProfile(target, config)
    expect(profileToConfig(applied, 'Reusable')).toEqual(profileToConfig(original, 'Reusable'))
    expect(applied).toMatchObject({
      id: target.id,
      proxy: target.proxy,
      seed: 45678,
      fingerprint: { opaque: { other: true } }
    })
    applied.permissionRules![0].geolocation = 'allow'
    expect(config.permissionRules![0].geolocation).toBe('deny')
    await CreateProfile(applied)
    const loaded = (await loadProfiles())[0]
    expect(profileToConfig(loaded, 'Reusable')).toEqual(profileToConfig(applied, 'Reusable'))
    const cleared = applyConfigToProfile(applied, { ...config, geolocation: undefined })
    expect(cleared.fingerprint?.geolocation).toBeUndefined()
    expect(target.fingerprint).toEqual({ opaque: { other: true } })
  })

  it('migrates recognized identity flags and only grants legacy first-origin permissions', () => {
    const migrated = migrateProfileSettings(
      profile({
        useragent: '',
        extraArgs: [
          '--fingerprint-platform=windows',
          '--fingerprint-platform=linux',
          '--fingerprint-brand=Microsoft Edge'
        ],
        startPages: ['https://first.example/a', 'https://second.example'],
        fingerprint: {
          geolocation: { latitude: 0, longitude: 0 },
          permissions: { geolocation: 'deny' },
          opaque: 12
        }
      })
    )
    expect(migrated).toMatchObject({
      platform: 'windows',
      browserIdentity: 'edge',
      extraArgs: [],
      permissionRules: [{ origin: 'https://first.example', geolocation: 'deny' }],
      fingerprint: { opaque: 12 }
    })
    expect(migrated.fingerprint).not.toHaveProperty('permissions')
    const manual = migrateProfileSettings(profile({ extraArgs: ['--fingerprint-brand=Unknown'] }))
    expect(manual.extraArgs).toEqual(['--fingerprint-brand=Unknown'])
    expect(manual.browserIdentity).toBeUndefined()
  })

  it('preserves an unreadable config store instead of overwriting it', () => {
    const file = path.join(tmp, 'configs.json')
    const damaged = '{broken'
    fs.writeFileSync(file, damaged)
    expect(() => listConfigs()).toThrow('unreadable')
    expect(() =>
      saveConfig({ id: 1, ...profileToConfig(profile({ useragent: '' }), 'valid') })
    ).toThrow('unreadable')
    expect(fs.readFileSync(file, 'utf8')).toBe(damaged)
  })

  it('rejects collisions without changing bytes and allocates through clock rollback', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    const first = await CreateProfile(profile({ id: 0 }))
    const file = path.join(tmp, 'profiles', String(first.id), 'profile.json')
    const bytes = fs.readFileSync(file, 'utf8')
    await expect(CreateProfile({ ...first, name: 'overwrite' })).rejects.toThrow('already exists')
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
    vi.mocked(Date.now).mockReturnValue(1000)
    const next = await CreateProfile(profile({ id: 0 }))
    expect(next.id).toBe(first.id + 1)
  })

  it('enforces disk gates despite forged public flags and preserves whitespace passwords', async () => {
    const saved = await CreateProfile(profile({ password: ' pass ' }))
    const forged = { ...saved, hasPassword: false, password: undefined }
    await expect(editProfile(forged, 'pass')).rejects.toThrow('Invalid profile password')
    await expect(launchProfileForAutomation(forged)).rejects.toThrow('Invalid profile password')
    await editProfile({ ...forged, notes: 'allowed' }, ' pass ')
    expect((await loadProfiles())[0].notes).toBe('allowed')
    const file = path.join(tmp, 'profiles', String(saved.id), 'profile.json')
    fs.writeFileSync(
      file,
      JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), passwordHash: 'bad:hash' })
    )
    expect(verifyProfilePassword(saved.id, ' pass ')).toBe(false)
  })

  it('reserves a deferred launch and closes a late browser before stop releases it', async () => {
    const saved = await CreateProfile(profile({ useragent: '' }))
    const pending = Promise.withResolvers<unknown>()
    engine.launch.mockReturnValueOnce(pending.promise)
    const started = launchProfileForAutomation(saved)
    const failed = expect(started).rejects.toThrow()
    await expect(launchProfileForAutomation(saved)).rejects.toThrow('already running')
    await expect(editProfile(saved)).rejects.toThrow('must be stopped')
    const stopped = stopProfile(saved.id)
    let disconnected: (() => void) | undefined
    const late = {
      connected: true,
      once: (_event: string, handler: () => void) => {
        disconnected = handler
      },
      close: vi.fn(async () => {
        late.connected = false
        disconnected?.()
      })
    }
    pending.resolve(late)
    await failed
    await stopped
    expect(late.connected).toBe(false)
    expect((await loadProfiles())[0].launched).toBe(false)
    await editProfile({ ...saved, notes: 'released' })
    expect((await loadProfiles())[0].notes).toBe('released')
  })

  it('merges cookies without reverting edits and never recreates a deleted profile', async () => {
    const saved = await CreateProfile(profile({ useragent: '', seed: 12345 }))
    await editProfile({
      ...saved,
      notes: 'new notes',
      seed: 54321,
      resources: { blockImages: true }
    })
    await importProfileCookies(
      saved.id,
      JSON.stringify([{ name: 'session', value: 'abc', domain: 'example.com', path: '/' }])
    )
    expect((await loadProfiles())[0]).toMatchObject({
      notes: 'new notes',
      seed: 54321,
      resources: { blockImages: true }
    })
    expect(JSON.parse((await loadProfiles())[0].cookies!)[0].value).toBe('abc')
    await DeleteProfile(saved)
    await expect(importProfileCookies(saved.id, '[]')).rejects.toThrow('not found')
    expect(await loadProfiles()).toEqual([])
  })

  it('preserves password gates only through explicit backups and reallocates collisions', async () => {
    const saved = await CreateProfile(profile({ password: 'backup secret' }))
    const backup = await exportProfilesBundle([saved.id])
    expect(JSON.parse(backup).profiles[0].passwordHash).toMatch(/^[0-9a-f]{32}:/)
    expect(await importProfilesBundle(backup)).toEqual({ imported: 1, skipped: [] })
    const copies = await loadProfiles()
    expect(copies).toHaveLength(2)
    expect(copies.every((copy) => verifyProfilePassword(copy.id, 'backup secret'))).toBe(true)
    expect(copies.every((copy) => !('passwordHash' in copy))).toBe(true)
  })
})
