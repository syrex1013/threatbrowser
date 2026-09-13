import type { Profile } from '../shared/profileSettings'

export type StoredProfile = Omit<Profile, 'password' | 'hasPassword'> & { passwordHash?: string }

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
