import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { ProxyData } from './types'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import logger from '../logger/logger'

let datadir = __dirname
if (!is.dev) {
  datadir = app.getPath('userData')
}
logger.info(`[proxyService] Data directory: ${datadir}`)

export async function testProxy(proxy: string) {
  logger.info(`[proxyService] Testing proxy: ${proxy}`)
  try {
    const proxydata = await parseProxy(proxy)

    const proxyUrl = `${proxydata.protocol}://${proxydata.username}:${proxydata.password}@${proxydata.host}:${proxydata.port}`

    // Create a HttpsProxyAgent instance using the proxy URL
    const agent = new HttpsProxyAgent(proxyUrl)

    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent // Adding custom agent with the proxy configuration
    })

    logger.info(`[proxyService] Proxy test response: ${response.status}`)
    return response.status === 200
  } catch (error) {
    logger.error(`[proxyService] Proxy test error: ${JSON.stringify(error)}`)
    return false
  }
}

export async function getProxyCountry(proxy: string) {
  logger.info(`[proxyService] Getting proxy country: ${proxy}`)
  try {
    const proxydata = await parseProxy(proxy)
    const response = await axios.get(`https://ipinfo.io/${proxydata.host}/json`)
    const data = response.data
    logger.info(`[proxyService] Proxy country: ${data.country}`)
    return data.country
  } catch (error) {
    logger.error(`[proxyService] Proxy country error: ${JSON.stringify(error)}`)
    return 'Unknown'
  }
}
export async function parseProxyCreate(proxy: string): Promise<ProxyData> {
  logger.info(`[proxyService] Parsing proxy and creating: ${proxy}`)
  const proxydata = await parseProxy(proxy)
  proxydata.name = `${proxydata.host}:${proxydata.port}`
  await CreateProxy(proxydata)
  return proxydata
}
export async function parseProxy(proxy: string): Promise<ProxyData> {
  logger.info(`[proxyService] Parsing proxy internal: ${proxy}`)
  const [protocol, address] = proxy.split('://')
  const [credentials, hostAndPort] = address.split('@')
  const [username, password] = credentials.split(':')
  const [host, port] = hostAndPort.split(':')

  const proxyObject = {
    name: '',
    protocol,
    host,
    port: parseInt(port, 10),
    username,
    password,
    id: Date.now(),
    status: 'UnChecked',
    country: 'Unknown'
  }
  logger.info(`[proxyService] Parsed proxy: ${JSON.stringify(proxyObject)}`)
  return proxyObject
}
export async function CreateProxy(ProxyData: ProxyData) {
  logger.info(`[proxyService] Creating proxy: ${JSON.stringify(ProxyData)}`)
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
    country: ProxyData.country
  }

  fs.writeFileSync(proxyPath, JSON.stringify(jsonProxy))
}

export async function DeleteProxy(ProxyID) {
  logger.info(`[proxyService] Deleting proxy: ${ProxyID}`)
  const proxiesDir = path.join(datadir, 'proxies')
  const proxyDir = path.join(proxiesDir, ProxyID.toString())
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
  logger.info(`[proxyService] Got proxies: ${JSON.stringify(proxies)}`)
  return proxies
}

export async function editProxy(ProxyID, ProxyData: ProxyData) {
  logger.info(
    `[proxyService] Editing proxy: ${ProxyID} with new data: ${JSON.stringify(ProxyData)}`
  )
  const proxiesDir = path.join(datadir, 'proxies')
  const proxyDir = path.join(proxiesDir, ProxyID.toString())
  const proxyPath = path.join(proxyDir, 'proxy.json')

  if (fs.existsSync(proxyPath)) {
    const jsonProxy: ProxyData = {
      name: ProxyData.name,
      protocol: ProxyData.protocol,
      host: ProxyData.host,
      port: ProxyData.port,
      username: ProxyData.username,
      password: ProxyData.password,
      id: ProxyData.id,
      status: ProxyData.status,
      country: ProxyData.country
    }
    fs.writeFileSync(proxyPath, JSON.stringify(jsonProxy))
  }
}
