export type ProxyAnonymity = 'elite' | 'anonymous' | 'transparent' | 'unknown'

export interface ProxyData {
  name: string
  protocol: string
  host: string
  port: number
  username: string
  password: string
  id: number
  status: string
  country: string
  proxyId?: number
  latencyMs?: number | null
  anonymity?: ProxyAnonymity
  lastCheckedAt?: number
}

export interface ScrapedProxy {
  host: string
  port: number
  protocol: string
  source: string
}

export interface ProxyCheckResult {
  alive: boolean
  latencyMs: number | null
  anonymity: ProxyAnonymity
  exitIp: string | null
  country: string | null
  error?: string
}
