import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { ProxyData } from './types'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'

const datadir = process.env.THREATBROWSER_DATA_DIR || (is.dev ? __dirname : app.getPath('userData'))
fs.mkdirSync(datadir, { recursive: true })

export async function testProxy(proxy: string) {
  logger.info('[proxyService] Testing proxy')
  try {
    const proxydata = await parseProxy(proxy)

    const proxyUrl = toProxyUrl(proxydata)
    const agent = createAgent(proxydata.protocol, proxyUrl)

    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent // Adding custom agent with the proxy configuration
    })

    logger.info(`[proxyService] Proxy test response: ${response.status}`)
    return response.status === 200
  } catch (error) {
    logger.error('[proxyService] Proxy test failed')
    return false
  }
}

export async function getProxyCountry(proxy: string) {
  logger.info('[proxyService] Getting proxy country')
  try {
    const proxydata = await parseProxy(proxy)
    const response = await axios.get(`https://ipinfo.io/${proxydata.host}/json`)
    const data = response.data
    logger.info(`[proxyService] Proxy country: ${data.country}`)
    return data.country
  } catch (error) {
    logger.error('[proxyService] Proxy country lookup failed')
    return 'Unknown'
  }
}
async function parseProxy(proxy: string): Promise<ProxyData> {
  const parsed = new URL(proxy)
  const protocol = parsed.protocol.replace(':', '').toLowerCase()
  const host = parsed.hostname
  const port = parsed.port ? parseInt(parsed.port, 10) : NaN

  if (!host || !Number.isFinite(port)) {
    throw new Error('Invalid proxy: host/port required')
  }

  const username = decodeURIComponent(parsed.username ?? '')
  const password = decodeURIComponent(parsed.password ?? '')

  const proxyObject = {
    name: '',
    protocol,
    host,
    port,
    username,
    password,
    id: Date.now(),
    status: 'UnChecked',
    country: 'Unknown'
  }
  return proxyObject
}

function toProxyUrl(proxy: ProxyData): string {
  const scheme = proxy.protocol.toLowerCase()
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : proxy.username
        ? `${encodeURIComponent(proxy.username)}@`
        : ''
  return `${scheme}://${auth}${proxy.host}:${proxy.port}`
}

function createAgent(
  protocol: string,
  proxyUrl: string
): HttpsProxyAgent<string> | SocksProxyAgent {
  const scheme = protocol.toLowerCase()
  if (scheme === 'socks4' || scheme === 'socks5' || scheme === 'socks') {
    return new SocksProxyAgent(proxyUrl)
  }
  // http/https proxies
  return new HttpsProxyAgent(proxyUrl)
}
export async function CreateProxy(ProxyData: ProxyData | string): Promise<ProxyData> {
  if (typeof ProxyData === 'string') {
    ProxyData = await parseProxy(ProxyData)
    //generate unique name
    ProxyData.name = `Proxy ${ProxyData.id}`
  }
  logger.info(`[proxyService] Creating proxy ${ProxyData.id}`)
  const proxiesDir = path.join(datadir, 'proxies')
  if (!fs.existsSync(proxiesDir)) {
    fs.mkdirSync(proxiesDir)
  }
  const proxyDir = path.join(proxiesDir, ProxyData.id.toString())
  if (!fs.existsSync(proxyDir)) {
    fs.mkdirSync(proxyDir)
  }

  const proxyPath = path.join(proxyDir, 'proxy.json')
  const jsonProxy: ProxyData = {
    name: ProxyData.name,
    protocol: ProxyData.protocol,
    host: ProxyData.host,
    port: ProxyData.port,
    username: ProxyData.username,
    password: ProxyData.password,
    id: ProxyData.id,
    status: ProxyData.status,
    country: ProxyData.country,
    latencyMs: ProxyData.latencyMs ?? null,
    anonymity: ProxyData.anonymity,
    lastCheckedAt: ProxyData.lastCheckedAt
  }

  fs.writeFileSync(proxyPath, JSON.stringify(jsonProxy))
  return jsonProxy
}

export async function DeleteProxy(proxy: ProxyData) {
  logger.info(`[proxyService] Deleting proxy: ${proxy.id}`)
  const proxiesDir = path.join(datadir, 'proxies')
  const proxyDir = path.join(proxiesDir, proxy.id.toString())
  const proxyPath = path.join(proxyDir, 'proxy.json')

  if (fs.existsSync(proxyPath)) {
    fs.unlinkSync(proxyPath)
  }
  if (fs.existsSync(proxyDir)) {
    fs.rmdirSync(proxyDir)
  }
}

export async function GetProxies(): Promise<ProxyData[]> {
  logger.info(`[proxyService] Getting proxies`)
  const proxiesDir = path.join(datadir, 'proxies')
  if (!fs.existsSync(proxiesDir)) {
    logger.warn(`[proxyService] No proxies found`)
    return []
  }
  const proxyDirs = fs.readdirSync(proxiesDir)
  const proxies = proxyDirs.map((dir) => {
    const proxyPath = path.join(proxiesDir, dir, 'proxy.json')
    const proxyData = fs.readFileSync(proxyPath)
    return JSON.parse(proxyData.toString())
  })
  logger.info(`[proxyService] Loaded ${proxies.length} proxies`)
  return proxies
}

export async function editProxy(editProxyData: ProxyData) {
  logger.info(`[proxyService] Editing proxy ${editProxyData.id}`)
  const proxiesDir = path.join(datadir, 'proxies')
  const proxyDir = path.join(proxiesDir, editProxyData.id.toString())
  const proxyPath = path.join(proxyDir, 'proxy.json')

  if (fs.existsSync(proxyPath)) {
    const jsonProxy: ProxyData = {
      name: editProxyData.name,
      protocol: editProxyData.protocol,
      host: editProxyData.host,
      port: editProxyData.port,
      username: editProxyData.username,
      password: editProxyData.password,
      id: editProxyData.id,
      status: editProxyData.status,
      country: editProxyData.country,
      latencyMs: editProxyData.latencyMs ?? null,
      anonymity: editProxyData.anonymity,
      lastCheckedAt: editProxyData.lastCheckedAt
    }
    fs.writeFileSync(proxyPath, JSON.stringify(jsonProxy))
  }
}
