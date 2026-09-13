import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'
import type { Profile } from '../shared/profileSettings'
import { CreateProfile, launchProfile, loadProfiles, stopProfile } from './profileService'

export interface AutomationSettings {
  enabled: boolean
  port: number
  token: string
}

const DEFAULT_PORT = 35000
const MAX_BODY_BYTES = 1024 * 1024

const datadir = process.env.THREATBROWSER_DATA_DIR || (is.dev ? __dirname : app.getPath('userData'))

let settings: AutomationSettings | null = null
let server: http.Server | null = null

function settingsPath(): string {
  return path.join(datadir, 'automation.json')
}

export function getAutomationSettings(): AutomationSettings {
  if (settings) return settings
  try {
    if (fs.existsSync(settingsPath())) {
      const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as Partial<AutomationSettings>
      const port = Number(raw.port)
      if (raw && typeof raw.token === 'string' && raw.token.length >= 16) {
        settings = {
          enabled: Boolean(raw.enabled),
          port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT,
          token: raw.token
        }
        return settings
      }
    }
  } catch {
    logger.error('[automationApi] Unreadable settings, resetting')
  }
  settings = { enabled: false, port: DEFAULT_PORT, token: crypto.randomBytes(24).toString('hex') }
  persist()
  return settings
}

function persist(): void {
  if (!settings) return
  fs.mkdirSync(datadir, { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

export async function applyAutomationSettings(
  next: Partial<AutomationSettings>
): Promise<AutomationSettings> {
  const current = getAutomationSettings()
  const nextPort = Number(next.port)
  settings = {
    enabled: next.enabled ?? current.enabled,
    port: Number.isInteger(nextPort) && nextPort > 0 && nextPort < 65536 ? nextPort : current.port,
    token: typeof next.token === 'string' && next.token.length >= 16 ? next.token : current.token
  }
  persist()
  await syncServer()
  return { ...settings }
}

async function syncServer(): Promise<void> {
  const current = getAutomationSettings()
  if (current.enabled && !server) {
    await startServer()
  } else if (!current.enabled && server) {
    await stopServer()
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  })
  res.end(payload)
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const current = getAutomationSettings()
  const token = req.headers['x-api-token']
  if (token !== current.token) {
    sendJson(res, 401, { error: 'Invalid or missing X-API-Token header' })
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, app: 'threatbrowser' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/profiles') {
      sendJson(res, 200, await loadProfiles())
      return
    }

    if (req.method === 'POST' && url.pathname === '/profiles') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as Partial<Profile>
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        typeof body.name !== 'string'
      ) {
        sendJson(res, 400, { error: 'Body must be a profile object with a name' })
        return
      }
      const profile: Profile = {
        id: 0,
        useragent: '',
        notes: '',
        proxy: '',
        ...body,
        name: body.name,
        launched: false
      }
      const created = await CreateProfile(profile)
      sendJson(res, 201, created)
      return
    }
    const profileAction = url.pathname.match(/^\/profiles\/(\d+)\/(start|stop)$/)
    if (req.method === 'POST' && profileAction) {
      const id = Number(profileAction[1])
      if (!Number.isSafeInteger(id) || id <= 0) {
        sendJson(res, 400, { error: 'Profile invalid: id must be a positive safe integer' })
        return
      }
      const profiles = await loadProfiles()
      const profile = profiles.find((p) => p.id === id)
      if (!profile) {
        sendJson(res, 404, { error: `Profile ${id} not found` })
        return
      }
      if (profileAction[2] === 'start') {
        const raw = await readBody(req)
        const body: unknown = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          ('password' in body && typeof body.password !== 'string')
        ) {
          sendJson(res, 400, { error: 'Body must be an object with an optional password string' })
          return
        }
        const password =
          'password' in body && typeof body.password === 'string' ? body.password : undefined
        await launchProfile(profile, password)
        sendJson(res, 200, { started: id })
      } else {
        await stopProfile(id)
        sendJson(res, 200, { stopped: id })
      }
      return
    }

    sendJson(res, 404, { error: 'Unknown route' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      error instanceof SyntaxError ||
      /^(Profile invalid:|Profile config invalid:|Config invalid:|Body too large)/.test(message)
        ? 400
        : message === 'Invalid profile password'
          ? 403
          : /^Profile \d+ not found$/.test(message)
            ? 404
            : /^Profile \d+ (already exists|is already running|must be stopped before editing)$/.test(
                  message
                )
              ? 409
              : 500
    sendJson(res, status, { error: error instanceof SyntaxError ? 'Invalid JSON body' : message })
  }
}

async function startServer(): Promise<void> {
  const current = getAutomationSettings()
  server = http.createServer((req, res) => {
    void handle(req, res)
  })
  const { promise, resolve, reject } = Promise.withResolvers<void>()
  server.once('error', reject)
  server.listen(current.port, '127.0.0.1', () => resolve())
  await promise
  logger.info(`[automationApi] Listening on http://127.0.0.1:${current.port}`)
}

export async function stopServer(): Promise<void> {
  if (!server) return
  const closing = server
  server = null
  const { promise, resolve } = Promise.withResolvers<void>()
  closing.close(() => resolve())
  await promise
  logger.info('[automationApi] Server stopped')
}

export function isServerRunning(): boolean {
  return Boolean(server?.listening)
}

export function registerAutomationIpc(): void {
  ipcMain.handle('automation:settings:get', async () => {
    const current = getAutomationSettings()
    return { ...current, running: isServerRunning() }
  })
  ipcMain.handle('automation:settings:set', async (_, next: Partial<AutomationSettings>) => {
    const applied = await applyAutomationSettings(next)
    return { ...applied, running: isServerRunning() }
  })
}
