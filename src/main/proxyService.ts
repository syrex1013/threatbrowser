import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { ProxyData } from './types'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { app } from 'electron'

const __dirname = app.getPath('userData')
console.log('User data:', __dirname)

export async function testProxy(proxy: string) {
  console.log('Testing proxy: ', proxy)
  try {
    const proxydata = await parseProxy(proxy)

    const proxyUrl = `${proxydata.protocol}://${proxydata.username}:${proxydata.password}@${proxydata.host}:${proxydata.port}`

    // Create a HttpsProxyAgent instance using the proxy URL
    const agent = new HttpsProxyAgent(proxyUrl)

    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: agent // Adding custom agent with the proxy configuration
    })

    console.log('Proxy Response:', response.data)
    return response.status === 200
  } catch (error) {
    console.error('Proxy Error:', error)
    return false
  }
}

export async function getProxyCountry(proxy: string) {
  console.log('Getting proxy country: ', proxy)
  try {
    const proxydata = await parseProxy(proxy)
    const response = await axios.get(`https://ipinfo.io/${proxydata.host}/json`)
    const data = response.data
    console.log('Proxy Country:', data.country)
    return data.country
  } catch (error) {
    console.error('Proxy Error:', error)
    return 'Unknown'
  }
}
export async function parseProxyCreate(proxy: string) {
  console.log('Parsing proxy: ', proxy)
  const proxydata = await parseProxy(proxy)
  proxydata.name = `${proxydata.host}:${proxydata.port}`
  console.log('New proxy name:', proxydata.name)
  CreateProxy(proxydata)
  return proxydata
}
export async function parseProxy(proxy: string): Promise<ProxyData> {
  const [protocol, address] = proxy.split('://')
  const [credentials, hostAndPort] = address.split('@')
  const [username, password] = credentials.split(':')
  const [host, port] = hostAndPort.split(':')

  return {
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
}
export async function CreateProxy(ProxyData: ProxyData) {
  console.log('Creating proxy')
  const proxiesDir = path.join(__dirname, 'proxies')
  console.log('Proxy data: ', ProxyData)
  if (!fs.existsSync(proxiesDir)) {
    fs.mkdirSync(proxiesDir)
  }
  const proxyDir = path.join(proxiesDir, ProxyData.id.toString())
  if (!fs.existsSync(proxyDir)) {
    fs.mkdirSync(proxyDir)
  }

  const proxyPath = path.join(proxyDir, 'proxy.json')
  console.log('Proxy path:', proxyPath)
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
  console.log('Deleting proxy: ', ProxyID)
  const proxiesDir = path.join(__dirname, 'proxies')
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
  console.log('Getting proxies:')
  const proxiesDir = path.join(__dirname, 'proxies')
  if (!fs.existsSync(proxiesDir)) {
    return []
  }
  const proxyDirs = fs.readdirSync(proxiesDir)
  const proxies = proxyDirs.map((dir) => {
    const proxyPath = path.join(proxiesDir, dir, 'proxy.json')
    const proxyData = fs.readFileSync(proxyPath)
    return JSON.parse(proxyData.toString())
  })
  console.dir(proxies)
  return proxies
}

export async function editProxy(ProxyID, ProxyData: ProxyData) {
  console.log('Editing proxy')
  const proxiesDir = path.join(__dirname, 'proxies')
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
    console.log('New proxy data:', jsonProxy)
    fs.writeFileSync(proxyPath, JSON.stringify(jsonProxy))
  }
}
