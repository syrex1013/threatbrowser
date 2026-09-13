import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'
import {
  applyConfigToProfile,
  migrateProfileSettings,
  profileToConfig,
  type ProfileConfig
} from '../shared/profileSettings'
import { effectivePlatform, validateProfile } from './profileValidation'

const datadir = process.env.THREATBROWSER_DATA_DIR || (is.dev ? __dirname : app.getPath('userData'))

function configsPath(): string {
  return path.join(datadir, 'configs.json')
}

function normalizeConfig(input: unknown, legacy = false): ProfileConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Config invalid: expected an object')
  }
  const config = input as ProfileConfig
  if (!Number.isSafeInteger(config.id)) throw new Error('Config invalid: id must be a safe integer')
  if (typeof config.name !== 'string' || !config.name.trim()) {
    throw new Error('Config invalid: name must be a nonempty string')
  }
  for (const field of ['humanize', 'geoip'] as const) {
    if (typeof config[field] !== 'boolean')
      throw new Error(`Config invalid: ${field} must be a boolean`)
  }
  for (const field of [
    'humanPreset',
    'timezone',
    'locale',
    'webrtcMode',
    'browserVersion'
  ] as const) {
    if (typeof config[field] !== 'string')
      throw new Error(`Config invalid: ${field} must be a string`)
  }
  for (const field of [
    'description',
    'platform',
    'browserIdentity',
    'brandVersion',
    'useragent',
    'gpuRenderer',
    'gpuVendor',
    'folder'
  ] as const) {
    if (config[field] !== undefined && typeof config[field] !== 'string') {
      throw new Error(`Config invalid: ${field} must be a string`)
    }
  }
  for (const field of ['width', 'height', 'cores'] as const) {
    if (
      config[field] !== undefined &&
      (typeof config[field] !== 'number' || !Number.isFinite(config[field]))
    ) {
      throw new Error(`Config invalid: ${field} must be a finite number`)
    }
  }
  for (const field of ['extensions', 'extraArgs'] as const) {
    if (!Array.isArray(config[field]) || config[field].some((value) => typeof value !== 'string')) {
      throw new Error(`Config invalid: ${field} must be an array of strings`)
    }
  }

  let candidate = applyConfigToProfile(
    { id: 0, name: config.name, useragent: '', notes: '', proxy: '', launched: false },
    config
  )
  if (legacy) {
    const startUrl = 'startUrl' in input ? input.startUrl : undefined
    if (startUrl !== undefined && typeof startUrl !== 'string') {
      throw new Error('Config invalid: startUrl must be a string')
    }
    candidate = migrateProfileSettings({ ...candidate, startUrl })
  } else {
    // Explicitly empty rules distinguish new configs from legacy implicit location grants.
    if (candidate.permissionRules === undefined) candidate.permissionRules = []
  }
  // Configs have no proxy; only the projected validation candidate needs one for IP WebRTC.
  if (config.webrtcMode === 'ip') candidate.proxy = 'http://127.0.0.1:8080'
  const validation = validateProfile(candidate, effectivePlatform(candidate))
  if (!validation.ok) throw new Error(`Config invalid: ${validation.errors.join('; ')}`)
  return {
    id: config.id,
    ...profileToConfig(candidate, config.name),
    ...(config.description === undefined ? {} : { description: config.description })
  }
}

function writeConfigs(configs: ProfileConfig[]): void {
  fs.mkdirSync(datadir, { recursive: true })
  const file = configsPath()
  const temporary = `${file}.${randomUUID()}.tmp`
  const fd = fs.openSync(temporary, 'wx', 0o600)
  try {
    try {
      fs.writeFileSync(fd, JSON.stringify(configs, null, 2), 'utf8')
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(temporary, file)
  } catch (error) {
    fs.rmSync(temporary, { force: true })
    throw error
  }
}

export function listConfigs(): ProfileConfig[] {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(configsPath(), 'utf8'))
    if (!Array.isArray(raw)) throw new Error('Expected a config array')
    const configs = raw.map((config) => normalizeConfig(config, true))
    if (new Set(configs.map((config) => config.id)).size !== configs.length) {
      throw new Error('Duplicate config ids')
    }
    return configs
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    logger.error('[configService] Config store unreadable')
    throw new Error('Config store unreadable')
  }
}

export function saveConfig(config: ProfileConfig): ProfileConfig {
  const configs = listConfigs()
  const next = normalizeConfig(config)
  if (!next.id) next.id = Date.now()
  const index = configs.findIndex((c) => c.id === next.id)
  if (index >= 0) {
    configs[index] = next
  } else {
    configs.push(next)
  }
  writeConfigs(configs)
  logger.info(`[configService] Saved config ${next.id}`)
  return next
}

export function deleteConfig(id: number): void {
  const configs = listConfigs().filter((c) => c.id !== id)
  writeConfigs(configs)
  logger.info(`[configService] Deleted config ${id}`)
}
