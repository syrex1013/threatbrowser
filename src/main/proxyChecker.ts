import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import logger from '../logger/logger'

/**
 * Proxy health with the fields every antidetect checker shows: liveness,
 * round-trip latency, anonymity level and exit country. Network access is
 * injected (`CheckerDeps`) so tests run against fakes and fixtures; the
 * default deps use axios plus ipinfo for geo.
 */

export type AnonymityLevel = 'elite' | 'anonymous' | 'transparent' | 'unknown'

export interface CheckTarget {
  protocol: string
  host: string
  port: number
  username?: string
  password?: string
}

export interface ProxyEcho {
  origin: string
  headers: Record<string, string>
}

export interface ProxyCheckResult {
  alive: boolean
  latencyMs: number | null
  anonymity: AnonymityLevel
  exitIp: string | null
  country: string | null
  error?: string
}

export interface CheckerDeps {
  fetchDirect(url: string, timeoutMs: number): Promise<ProxyEcho>
  fetchVia(proxy: CheckTarget, url: string, timeoutMs: number): Promise<ProxyEcho>
  geoLookup(host: string): Promise<string | null>
}

const PROXY_HEADERS = [
  'via',
  'forwarded',
  'x-forwarded-for',
  'x-real-ip',
  'proxy-connection',
  'x-proxy-connection',
  'proxy-agent',
  'x-proxy-id',
  'x-proxy-user'
]

function headerPresent(headers: Record<string, string>, name: string): boolean {
  const value = headers[name]
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Standard taxonomy: transparent leaks the client IP, anonymous hides the IP
 * but advertises the proxy, elite hides both.
 */
export function classifyAnonymity(echo: ProxyEcho, realIp: string): AnonymityLevel {
  const origins = echo.origin
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (origins.length === 0) return 'unknown'
  if (realIp && origins.includes(realIp)) return 'transparent'
  if (PROXY_HEADERS.some((name) => headerPresent(echo.headers, name))) return 'anonymous'
  return 'elite'
}

function normalizeEcho(payload: unknown): ProxyEcho {
  const headers: Record<string, string> = {}
  let origin = ''
  if (payload && typeof payload === 'object') {
    if ('origin' in payload && typeof payload.origin === 'string') origin = payload.origin
    if ('headers' in payload && payload.headers && typeof payload.headers === 'object') {
      for (const [key, value] of Object.entries(payload.headers)) {
        if (typeof value === 'string') headers[key.toLowerCase()] = value
        else if (typeof value === 'number') headers[key.toLowerCase()] = String(value)
      }
    }
  }
  return { origin, headers }
}

function proxyUrl(proxy: CheckTarget): string {
  const scheme = proxy.protocol.toLowerCase()
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}${proxy.password ? `:${encodeURIComponent(proxy.password)}` : ''}@`
    : ''
  return `${scheme}://${auth}${proxy.host}:${proxy.port}`
}

function agentFor(proxy: CheckTarget): HttpsProxyAgent<string> | SocksProxyAgent {
  const target = proxyUrl(proxy)
  const scheme = proxy.protocol.toLowerCase()
  if (scheme === 'socks4' || scheme === 'socks5' || scheme === 'socks')
    return new SocksProxyAgent(target)
  return new HttpsProxyAgent(target)
}

/** Production network deps: axios through proxy agents, ipinfo for country. */
export function createDefaultCheckerDeps(): CheckerDeps {
  return {
    async fetchDirect(url: string, timeoutMs: number): Promise<ProxyEcho> {
      const response = await axios.get(url, { timeout: timeoutMs })
      return normalizeEcho(response.data as unknown)
    },
    async fetchVia(proxy: CheckTarget, url: string, timeoutMs: number): Promise<ProxyEcho> {
      const response = await axios.get(url, { timeout: timeoutMs, httpsAgent: agentFor(proxy) })
      return normalizeEcho(response.data as unknown)
    },
    async geoLookup(host: string): Promise<string | null> {
      try {
        const response = await axios.get(`https://ipinfo.io/${host}/json`, { timeout: 10000 })
        const data: unknown = response.data
        if (
          data &&
          typeof data === 'object' &&
          'country' in data &&
          typeof data.country === 'string'
        ) {
          return data.country
        }
        return null
      } catch {
        return null
      }
    }
  }
}

export interface CheckOptions {
  checkUrl?: string
  timeoutMs?: number
  skipGeo?: boolean
}

export const DEFAULT_CHECK_URL = 'https://httpbin.org/get'

export async function checkProxy(
  proxy: CheckTarget,
  deps: CheckerDeps,
  options: CheckOptions = {}
): Promise<ProxyCheckResult> {
  const checkUrl = options.checkUrl ?? DEFAULT_CHECK_URL
  const timeoutMs = options.timeoutMs ?? 15000
  let realIp = ''
  try {
    const direct = await deps.fetchDirect(checkUrl, timeoutMs)
    realIp = direct.origin.split(',')[0]?.trim() ?? ''
  } catch {
    realIp = ''
  }
  const startedAt = Date.now()
  try {
    const echo = await deps.fetchVia(proxy, checkUrl, timeoutMs)
    const latencyMs = Date.now() - startedAt
    const anonymity = realIp ? classifyAnonymity(echo, realIp) : 'unknown'
    const exitIp = echo.origin.split(',')[0]?.trim() || null
    const country = options.skipGeo ? null : await deps.geoLookup(proxy.host)
    return { alive: true, latencyMs, anonymity, exitIp, country }
  } catch (error) {
    logger.warn(
      `[proxyChecker] ${proxy.host}:${proxy.port} failed: ${error instanceof Error ? error.message : 'error'}`
    )
    return {
      alive: false,
      latencyMs: null,
      anonymity: 'unknown',
      exitIp: null,
      country: null,
      error: error instanceof Error ? error.message : 'check failed'
    }
  }
}

export interface BatchCheckOptions extends CheckOptions {
  concurrency?: number
}

export interface CheckedProxy<T extends CheckTarget = CheckTarget> {
  proxy: T
  result: ProxyCheckResult
}

/** Concurrency-limited pool; results keep input order. */
export async function checkProxies<T extends CheckTarget>(
  proxies: T[],
  deps: CheckerDeps,
  options: BatchCheckOptions = {}
): Promise<Array<CheckedProxy<T>>> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 10, 50))
  const results = new Array<CheckedProxy<T>>(proxies.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, proxies.length) }, async () => {
    while (cursor < proxies.length) {
      const index = cursor
      cursor += 1
      const proxy = proxies[index]
      results[index] = { proxy, result: await checkProxy(proxy, deps, options) }
    }
  })
  await Promise.all(workers)
  return results
}
