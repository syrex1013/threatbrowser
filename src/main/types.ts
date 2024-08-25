export interface Profile {
  name: string
  useragent: string
  notes: string
  proxy: string
}

export interface ProxyData {
  protocol: string
  host: string
  port: number
  username: string
  password: string
  id: number
  status: string
}
