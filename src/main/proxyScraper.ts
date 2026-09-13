import axios from 'axios'
import logger from '../logger/logger'

/**
 * Free proxy harvesting. No antidetect vendor ships this (Incogniton's free
 * shared pool is the closest), so sources are public lists: ProxyScrape v2,
 * proxy-list.download, GeoNode and curated GitHub raw lists. Every source is
 * best-effort — failures are reported per source, never abort the run.
 */

export type ScrapedProtocol = 'http' | 'https' | 'socks4' | 'socks5'

export interface ScrapedProxy {
  host: string
  port: number
  protocol: ScrapedProtocol
  source: string
}

export interface ScrapeFailure {
  source: string
  error: string
}

export interface ScrapeResult {
  proxies: ScrapedProxy[]
  failures: ScrapeFailure[]
}

type FetchText = (url: string, timeoutMs: number) => Promise<string>

async function defaultFetchText(url: string, timeoutMs: number): Promise<string> {
  const response = await axios.get<string>(url, { timeout: timeoutMs, responseType: 'text' })
  return typeof response.data === 'string' ? response.data : String(response.data)
}

const LINE_ENTRY = /^\s*([^:\s]+):(\d{1,5})\s*$/

function validPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/** Parse `host:port` line lists (ProxyScrape, proxy-list.download, GitHub). */
export function parseLineList(
  text: string,
  protocol: ScrapedProtocol,
  source: string
): ScrapedProxy[] {
  const proxies: ScrapedProxy[] = []
  for (const line of text.split('\n')) {
    const match = line.match(LINE_ENTRY)
    if (!match) continue
    const port = Number(match[2])
    if (!validPort(port)) continue
    proxies.push({ host: match[1].toLowerCase(), port, protocol, source })
  }
  return proxies
}

interface GeonodeEntry {
  ip?: unknown
  port?: unknown
  protocols?: unknown
  country?: unknown
}

/** Parse GeoNode JSON (`{ data: [{ ip, port, protocols }] }`). */
export function parseGeonode(payload: unknown, source: string): ScrapedProxy[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) return []
  const entries = payload.data
  if (!Array.isArray(entries)) return []
  const proxies: ScrapedProxy[] = []
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue
    const entry: GeonodeEntry = item
    if (typeof entry.ip !== 'string' || !validPort(Number(entry.port))) continue
    const protocols = Array.isArray(entry.protocols) ? entry.protocols : []
    for (const raw of protocols) {
      if (raw !== 'http' && raw !== 'https' && raw !== 'socks4' && raw !== 'socks5') continue
      proxies.push({
        host: entry.ip.toLowerCase(),
        port: Number(entry.port),
        protocol: raw,
        source
      })
    }
  }
  return proxies
}

export interface ProxySource {
  name: string
  url: string
  /** 'lines' parses text; 'geonode' parses GeoNode JSON. */
  format: 'lines' | 'geonode'
  protocol: ScrapedProtocol
}

export const PROXY_SOURCES: ProxySource[] = [
  {
    name: 'proxyscrape-http',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    format: 'lines',
    protocol: 'http'
  },
  {
    name: 'proxyscrape-socks4',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all&ssl=all&anonymity=all',
    format: 'lines',
    protocol: 'socks4'
  },
  {
    name: 'proxyscrape-socks5',
    url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all',
    format: 'lines',
    protocol: 'socks5'
  },
  {
    name: 'proxy-list-download-http',
    url: 'https://www.proxy-list.download/api/v1/get?type=http',
    format: 'lines',
    protocol: 'http'
  },
  {
    name: 'proxy-list-download-https',
    url: 'https://www.proxy-list.download/api/v1/get?type=https',
    format: 'lines',
    protocol: 'https'
  },
  {
    name: 'proxy-list-download-socks4',
    url: 'https://www.proxy-list.download/api/v1/get?type=socks4',
    format: 'lines',
    protocol: 'socks4'
  },
  {
    name: 'proxy-list-download-socks5',
    url: 'https://www.proxy-list.download/api/v1/get?type=socks5',
    format: 'lines',
    protocol: 'socks5'
  },
  {
    name: 'geonode',
    url: 'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
    format: 'geonode',
    protocol: 'http'
  },
  {
    name: 'thespeedx-http',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    format: 'lines',
    protocol: 'http'
  },
  {
    name: 'thespeedx-socks4',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    format: 'lines',
    protocol: 'socks4'
  },
  {
    name: 'thespeedx-socks5',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    format: 'lines',
    protocol: 'socks5'
  },
  {
    name: 'monosans-http',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    format: 'lines',
    protocol: 'http'
  },
  {
    name: 'monosans-socks4',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
    format: 'lines',
    protocol: 'socks4'
  },
  {
    name: 'monosans-socks5',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    format: 'lines',
    protocol: 'socks5'
  }
]

function dedupe(proxies: ScrapedProxy[]): ScrapedProxy[] {
  const seen = new Set<string>()
  return proxies.filter((proxy) => {
    const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface ScrapeOptions {
  sources?: string[]
  timeoutMs?: number
  fetchText?: FetchText
}

/** Harvest proxies from the selected (default: all) public sources. */
export async function scrapeProxies(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const fetchText = options.fetchText ?? defaultFetchText
  const timeoutMs = options.timeoutMs ?? 20000
  const wanted = options.sources
    ? PROXY_SOURCES.filter((source) => options.sources!.includes(source.name))
    : PROXY_SOURCES
  const proxies: ScrapedProxy[] = []
  const failures: ScrapeFailure[] = []
  await Promise.all(
    wanted.map(async (source) => {
      try {
        const text = await fetchText(source.url, timeoutMs)
        const parsed =
          source.format === 'geonode'
            ? parseGeonode(JSON.parse(text) as unknown, source.name)
            : parseLineList(text, source.protocol, source.name)
        proxies.push(...parsed)
        logger.info(`[proxyScraper] ${source.name}: ${parsed.length} entries`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed'
        failures.push({ source: source.name, error: message })
        logger.warn(`[proxyScraper] ${source.name} failed: ${message}`)
      }
    })
  )
  return { proxies: dedupe(proxies), failures }
}
