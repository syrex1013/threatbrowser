import type { ElectronAPI } from '@electron-toolkit/preload'
import type { EnginePlatform, Profile, ProfileConfig } from '../../../shared/profileSettings'
import type { ProxyCheckResult, ProxyData, ScrapedProxy } from '../types/types'

export type CookieFormat = 'json' | 'netscape' | 'mozilla'

export interface AutomationSettingsState {
  enabled: boolean
  port: number
  token: string
  running: boolean
}
export interface IpcApi {
  loadProfiles(): Promise<Profile[]>
  createProfile(profile: Profile): Promise<Profile>
  editProfile(profile: Profile, currentPassword?: string): Promise<void>
  deleteProfile(profile: Profile): Promise<void>
  launchProfile(profile: Profile, password?: string): Promise<void>
  stopProfile(profileId: number): Promise<void>
  regenerateFingerprint(profileId: number, password?: string): Promise<Profile>
  engineInfo(payload: {
    browserVersion?: string
  }): Promise<{ platform: EnginePlatform; chromiumVersion: string | null }>

  verifyProfilePassword(profileId: number, password: string): Promise<boolean>
  bulkCreateProfiles(
    config: ProfileConfig,
    count: number,
    prefix: string
  ): Promise<{ profiles: Profile[]; error?: string }>
  collectCookies(profileId: number, domains: string[], password?: string): Promise<unknown>
  launchOneTimeProfile(payload: {
    profileId: number
    password?: string
  }): Promise<{ launched: true }>

  exportProfiles(ids: number[]): Promise<string>
  exportProfilesToFile(ids: number[]): Promise<string | null>
  importProfilesFromFile(): Promise<{ path: string; imported: number; skipped: string[] } | null>

  logsRead(): Promise<string>
  logsClear(): Promise<void>

  configsList(): Promise<ProfileConfig[]>
  saveConfig(config: ProfileConfig): Promise<ProfileConfig>
  deleteConfig(id: number): Promise<void>

  automationGetSettings(): Promise<AutomationSettingsState>
  automationSetSettings(next: {
    enabled?: boolean
    port?: number
    token?: string
  }): Promise<AutomationSettingsState>

  loadProxies(): Promise<ProxyData[]>
  createProxy(proxy: ProxyData | string): Promise<ProxyData>
  editProxy(proxy: ProxyData): Promise<void>
  deleteProxy(proxy: ProxyData): Promise<void>
  testProxy(proxyUrl: string): Promise<boolean>
  getProxyCountry(proxyUrl: string): Promise<string>
  proxySources(): Promise<Array<{ name: string; protocol: string }>>
  scrapeProxies(
    sources?: string[]
  ): Promise<{ proxies: ScrapedProxy[]; failures: Array<{ source: string; error: string }> }>
  checkProxies(proxies: ProxyData[], concurrency?: number): Promise<ProxyCheckResult[]>

  pixelscanFingerprintCheck(payload: { profileId?: number; password?: string }): Promise<unknown>

  cookiesExport(payload: { cookies: string; format?: CookieFormat }): Promise<string>
  cookiesImport(payload: { contents: string; format?: CookieFormat }): Promise<string>
  exportProfileCookies(payload: { profileId: number; format?: CookieFormat }): Promise<string>

  campaignsRun(payload: { campaign: unknown; profileIds?: number[] }): Promise<{ runIds: string[] }>
  campaignsRunGet(payload: { runId: string }): Promise<{ run: unknown; events: unknown[] } | null>
  campaignsList(): Promise<unknown[]>
  campaignsSave(campaign: unknown): Promise<unknown>
  campaignsGet(id: string): Promise<unknown>
  campaignsDelete(id: string): Promise<void>
  campaignsStop(runId: string): Promise<boolean>
  onCampaignRunEvent(handler: (payload: { runId: string; event: unknown }) => void): () => void

  onProfileClosed(handler: (payload: { id: number; cookies: string }) => void): () => void
}

function getElectron(): ElectronAPI {
  if (!window.electron?.ipcRenderer) {
    throw new Error('Electron IPC is not available in renderer')
  }
  return window.electron
}

export const ipc: IpcApi = {
  async loadProfiles() {
    return (await getElectron().ipcRenderer.invoke('load-profiles', '')) as Profile[]
  },
  async createProfile(profile) {
    return (await getElectron().ipcRenderer.invoke('create-profile', profile)) as Profile
  },
  async editProfile(profile, currentPassword) {
    await getElectron().ipcRenderer.invoke('edit-profile', profile, currentPassword)
  },
  async deleteProfile(profile) {
    await getElectron().ipcRenderer.invoke('delete-profile', profile)
  },
  async launchProfile(profile, password) {
    await getElectron().ipcRenderer.invoke('launch-profile', profile, password)
  },
  async stopProfile(profileId) {
    await getElectron().ipcRenderer.invoke('profile:stop', profileId)
  },
  async verifyProfilePassword(profileId, password) {
    return (await getElectron().ipcRenderer.invoke(
      'profile:verify-password',
      profileId,
      password
    )) as boolean
  },
  async bulkCreateProfiles(config, count, prefix) {
    return (await getElectron().ipcRenderer.invoke(
      'profiles:bulk-create',
      config,
      count,
      prefix
    )) as { profiles: Profile[]; error?: string }
  },
  async collectCookies(profileId, domains, password) {
    return await getElectron().ipcRenderer.invoke('cookies:collect', profileId, domains, password)
  },
  async launchOneTimeProfile(payload) {
    return (await getElectron().ipcRenderer.invoke('profile:launch-one-time', payload)) as {
      launched: true
    }
  },
  async regenerateFingerprint(profileId, password) {
    return (await getElectron().ipcRenderer.invoke(
      'profile:regenerate-fingerprint',
      profileId,
      password
    )) as Profile
  },
  async engineInfo(payload) {
    return await getElectron().ipcRenderer.invoke('profiles:engine-info', payload)
  },
  async exportProfiles(ids) {
    return (await getElectron().ipcRenderer.invoke('profiles:export', ids)) as string
  },
  async exportProfilesToFile(ids) {
    return (await getElectron().ipcRenderer.invoke('profiles:export-file', ids)) as string | null
  },
  async importProfilesFromFile() {
    return (await getElectron().ipcRenderer.invoke('profiles:import-file')) as {
      path: string
      imported: number
      skipped: string[]
    } | null
  },
  async logsRead() {
    return (await getElectron().ipcRenderer.invoke('logs:read')) as string
  },
  async logsClear() {
    await getElectron().ipcRenderer.invoke('logs:clear')
  },
  async configsList() {
    return (await getElectron().ipcRenderer.invoke('configs:list')) as ProfileConfig[]
  },
  async saveConfig(config) {
    return (await getElectron().ipcRenderer.invoke('configs:save', config)) as ProfileConfig
  },
  async deleteConfig(id) {
    await getElectron().ipcRenderer.invoke('configs:delete', id)
  },
  async automationGetSettings() {
    return (await getElectron().ipcRenderer.invoke(
      'automation:settings:get'
    )) as AutomationSettingsState
  },
  async automationSetSettings(next) {
    return (await getElectron().ipcRenderer.invoke(
      'automation:settings:set',
      next
    )) as AutomationSettingsState
  },
  async loadProxies() {
    return (await getElectron().ipcRenderer.invoke('load-proxies', '')) as ProxyData[]
  },
  async createProxy(proxy) {
    return (await getElectron().ipcRenderer.invoke('create-proxy', proxy)) as ProxyData
  },
  async editProxy(proxy) {
    await getElectron().ipcRenderer.invoke('edit-proxy', proxy)
  },
  async deleteProxy(proxy) {
    await getElectron().ipcRenderer.invoke('delete-proxy', proxy)
  },
  async testProxy(proxyUrl) {
    return (await getElectron().ipcRenderer.invoke('test-proxy', proxyUrl)) as boolean
  },
  async getProxyCountry(proxyUrl) {
    return (await getElectron().ipcRenderer.invoke('get-proxy-country', proxyUrl)) as string
  },
  async proxySources() {
    return (await getElectron().ipcRenderer.invoke('proxies:sources')) as Array<{
      name: string
      protocol: string
    }>
  },
  async scrapeProxies(sources) {
    return (await getElectron().ipcRenderer.invoke('proxies:scrape', { sources })) as {
      proxies: ScrapedProxy[]
      failures: Array<{ source: string; error: string }>
    }
  },
  async checkProxies(proxies, concurrency) {
    return (await getElectron().ipcRenderer.invoke('proxies:check', {
      proxies,
      concurrency
    })) as ProxyCheckResult[]
  },
  async pixelscanFingerprintCheck(payload) {
    return (await getElectron().ipcRenderer.invoke(
      'pixelscan:fingerprint-check',
      payload
    )) as unknown
  },
  async cookiesExport(payload) {
    return (await getElectron().ipcRenderer.invoke('cookies:export', payload)) as string
  },
  async cookiesImport(payload) {
    return (await getElectron().ipcRenderer.invoke('cookies:import', payload)) as string
  },
  async exportProfileCookies(payload) {
    return (await getElectron().ipcRenderer.invoke('profile:cookies:export', payload)) as string
  },
  async campaignsRun(payload) {
    return (await getElectron().ipcRenderer.invoke('campaigns:run', payload)) as {
      runIds: string[]
    }
  },
  async campaignsRunGet(payload) {
    return (await getElectron().ipcRenderer.invoke('campaigns:run:get', payload)) as {
      run: unknown
      events: unknown[]
    } | null
  },
  async campaignsList() {
    return (await getElectron().ipcRenderer.invoke('campaigns:list')) as unknown[]
  },
  async campaignsSave(campaign) {
    return (await getElectron().ipcRenderer.invoke('campaigns:save', campaign)) as unknown
  },
  async campaignsGet(id) {
    return (await getElectron().ipcRenderer.invoke('campaigns:get', id)) as unknown
  },
  async campaignsDelete(id) {
    await getElectron().ipcRenderer.invoke('campaigns:delete', id)
  },
  async campaignsStop(runId) {
    return (await getElectron().ipcRenderer.invoke('campaigns:stop', runId)) as boolean
  },
  onCampaignRunEvent(handler) {
    const wrapped = (_: unknown, payload: { runId: string; event: unknown }) => handler(payload)
    getElectron().ipcRenderer.on('campaigns:run:event', wrapped as never)
    return () => getElectron().ipcRenderer.removeListener('campaigns:run:event', wrapped as never)
  },
  onProfileClosed(handler) {
    const wrapped = (_: unknown, payload: { id: number; cookies: string }) => handler(payload)
    getElectron().ipcRenderer.on('profile-closed', wrapped as never)
    return () => getElectron().ipcRenderer.removeListener('profile-closed', wrapped as never)
  }
}
