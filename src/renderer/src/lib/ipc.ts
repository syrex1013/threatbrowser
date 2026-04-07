import type { ElectronAPI } from '@electron-toolkit/preload'
import type { Profile, ProxyData } from '../types/types'

export interface IpcApi {
  loadProfiles(): Promise<Profile[]>
  createProfile(profile: Profile): Promise<void>
  editProfile(profile: Profile): Promise<void>
  deleteProfile(profile: Profile): Promise<void>
  launchProfile(profile: Profile): Promise<void>

  loadProxies(): Promise<ProxyData[]>
  createProxy(proxy: ProxyData | string): Promise<ProxyData>
  editProxy(proxy: ProxyData): Promise<void>
  deleteProxy(proxy: ProxyData): Promise<void>
  testProxy(proxyUrl: string): Promise<boolean>
  getProxyCountry(proxyUrl: string): Promise<string>

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
    await getElectron().ipcRenderer.invoke('create-profile', profile)
  },
  async editProfile(profile) {
    await getElectron().ipcRenderer.invoke('edit-profile', profile)
  },
  async deleteProfile(profile) {
    await getElectron().ipcRenderer.invoke('delete-profile', profile)
  },
  async launchProfile(profile) {
    await getElectron().ipcRenderer.invoke('launch-profile', profile)
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
  onProfileClosed(handler) {
    const wrapped = (_: unknown, payload: { id: number; cookies: string }) => handler(payload)
    getElectron().ipcRenderer.on('profile-closed', wrapped as never)
    return () => getElectron().ipcRenderer.removeListener('profile-closed', wrapped as never)
  }
}

