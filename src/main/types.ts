export interface Profile {
  id: number
  name: string
  useragent: string
  notes: string
  proxy: string
  proxyId?: number
  launched: boolean
  cookies?: string
  fingerprint?: Fingerprint
  startUrl?: string
  tags?: string[]
}

export interface Fingerprint {
  timezone?: string
  locale?: string
  languages?: string[]
  platform?: string
  hardwareConcurrency?: number
  deviceMemory?: number
  viewport?: {
    width: number
    height: number
    deviceScaleFactor?: number
  }
  geolocation?: {
    latitude: number
    longitude: number
    accuracy?: number
  }
  webrtc?: {
    mode: 'default' | 'disable'
  }
  webgl?: {
    vendor?: string
    renderer?: string
  }
}

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
}
