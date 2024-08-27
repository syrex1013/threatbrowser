export interface Profile {
  id: number
  name: string
  useragent: string
  notes: string
  proxy: string
  proxyId?: number
  launched: boolean
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
