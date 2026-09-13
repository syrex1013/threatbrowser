import { createStore } from 'vuex'
import type { Profile } from '../../../shared/profileSettings'
import type { ProxyData } from '../types/types'
import logger from '../logger/logger' // Adjust the import path as necessary

const store = createStore({
  state() {
    return {
      profiles: [] as Profile[],
      proxies: [] as ProxyData[]
    }
  },
  mutations: {
    createProfile(state, profile: Profile) {
      logger.info(`[store-mutation] Creating profile: ${profile.id}`)
      state.profiles.push(profile)
    },
    launchProfile(state, profile: Profile) {
      logger.info(`[store-mutation] Launching profile: ${profile.id}`)
      const index = state.profiles.findIndex((p) => p.id === profile.id)
      if (index !== -1) {
        state.profiles[index].launched = true
      }
    },
    deleteProfile(state, profile: Profile) {
      logger.info(`[store-mutation] Deleting profile: ${profile.id}`)
      state.profiles = state.profiles.filter((p) => p.id !== profile.id)
    },
    editProfile(state, updatedProfile: Profile) {
      logger.info(`[store-mutation] Editing profile: ${updatedProfile.id}`)
      const index = state.profiles.findIndex((p) => p.id === updatedProfile.id)
      if (index !== -1) {
        state.profiles.splice(index, 1, updatedProfile)
      }
    },
    setProfiles(state, profiles: Profile[]) {
      logger.info(`[store-mutation] Setting profiles`)
      state.profiles = profiles
    },
    createProxy(state, proxy: ProxyData) {
      logger.info(`[store-mutation] Creating proxy: ${proxy.id}`)
      state.proxies.push(proxy)
    },
    deleteProxy(state, proxy: ProxyData) {
      logger.info(`[store-mutation] Deleting proxy: ${proxy.id}`)
      state.proxies = state.proxies.filter((proxy) => proxy.id !== proxy.id)
    },
    editProxy(state, updatedProxy: ProxyData) {
      logger.info(`[store-mutation] Editing proxy: ${updatedProxy.id}`)
      const index = state.proxies.findIndex((p) => p.id === updatedProxy.id)
      if (index !== -1) {
        state.proxies.splice(index, 1, updatedProxy)
      }
    },
    setProxies(state, proxies: ProxyData[]) {
      logger.info(`[store-mutation] Setting proxies`)
      state.proxies = proxies
    },
    updateProxyCountry(state, { proxyId, country }: { proxyId: number; country: string }) {
      logger.info(`[store-mutation] Updating country for proxy: ${proxyId} to ${country}`)
      const index = state.proxies.findIndex((proxy) => proxy.id === proxyId)
      if (index !== -1) {
        state.proxies[index].country = country
      }
    },
    updateProxyStatus(state, { proxyId, status }: { proxyId: number; status: string }) {
      logger.info(`[store-mutation] Updating status for proxy: ${proxyId} to ${status}`)
      const index = state.proxies.findIndex((proxy) => proxy.id === proxyId)
      if (index !== -1) {
        state.proxies[index].status = status
      }
    },
    updateProfileCookies(state, { profileId, cookies }) {
      logger.info(`[store-mutation] Updating cookies for profile: ${profileId}`)
      const index = state.profiles.findIndex((profile) => profile.id === profileId)
      if (index !== -1) {
        // Store cookies as a JSON string
        state.profiles[index].cookies =
          typeof cookies === 'string' ? cookies : JSON.stringify(cookies)
      }
    }
  },
  actions: {
    async fetchProfiles({ commit }) {
      logger.info('[store-action] Fetching profiles')
      try {
        const loadedProfiles = await window.electron.ipcRenderer.invoke('load-profiles', '')
        commit('setProfiles', loadedProfiles)
      } catch {
        logger.info('[store-action] Error loading profiles')
      }
    },
    async launchProfile({ commit }, profile: Profile) {
      logger.info(`[store-action] Launching profile: ${profile.id}`)
      await window.electron.ipcRenderer.invoke('launch-profile', profile, profile.password)
      commit('launchProfile', profile)
    },
    async deleteProfile({ commit }, profile: Profile) {
      logger.info(`[store-action] Deleting profile: ${profile.id}`)
      await window.electron.ipcRenderer.invoke('delete-profile', profile)
      commit('deleteProfile', profile)
    },
    async createProfile({ commit }, profile: Profile) {
      logger.info('[store-action] Creating profile')
      const created: Profile = await window.electron.ipcRenderer.invoke('create-profile', {
        ...profile,
        id: 0
      })
      commit('createProfile', created)
      return created
    },
    async editProfile({ commit }, input: Profile & { currentPassword?: string }) {
      const { currentPassword, ...updatedProfile } = input
      logger.info(`[store-action] Editing profile: ${updatedProfile.id}`)
      await window.electron.ipcRenderer.invoke('edit-profile', updatedProfile, currentPassword)
      commit('editProfile', { ...updatedProfile, password: undefined })
    },
    async fetchProxies({ commit }) {
      logger.info('[store-action] Fetching proxies')
      try {
        const loadedProxies = await window.electron.ipcRenderer.invoke('load-proxies', '')
        commit('setProxies', loadedProxies)
      } catch {
        logger.info('[store-action] Error loading proxies')
      }
    },
    deleteProxy({ commit }, proxy: ProxyData) {
      logger.info(`[store-action] Deleting proxy: ${proxy.id}`)
      window.electron.ipcRenderer.invoke('delete-proxy', proxy)
      commit('deleteProxy', proxy)
    },
    async createProxy({ commit }, proxyInput: ProxyData | string) {
      try {
        let proxy: ProxyData
        if (typeof proxyInput === 'string') {
          logger.info('[store-action] Creating proxy')
          proxy = await window.electron.ipcRenderer.invoke('create-proxy', proxyInput)
        } else {
          logger.info(`[store-action] Creating proxy from ProxyData object: ${proxyInput.id}`)
          proxy = proxyInput
          proxy = await window.electron.ipcRenderer.invoke('create-proxy', proxy)
        }
        commit('createProxy', proxy)
        return proxy.id
      } catch (error) {
        logger.info('[store-action] Error creating proxy')
        throw error
      }
    },
    editProxy({ commit }, updatedProxy: ProxyData) {
      logger.info(`[store-action] Editing proxy: ${updatedProxy.id}`)
      window.electron.ipcRenderer.invoke('edit-proxy', updatedProxy)
      commit('editProxy', updatedProxy)
    },
    async getProxyCountry({ commit }, { proxyId, proxy }: { proxyId: number; proxy: string }) {
      logger.info(`[store-action] Getting country for proxy: ${proxyId}`)
      try {
        const country = await window.electron.ipcRenderer.invoke('get-proxy-country', proxy)
        commit('updateProxyCountry', { proxyId, country })
        return country
      } catch (error) {
        logger.info(`[store-action] Error getting country for proxy ${proxyId}`)
        throw error
      }
    },
    async getProxyStatus({ commit }, { proxyId, proxy }: { proxyId: number; proxy: string }) {
      logger.info(`[store-action] Testing proxy: ${proxyId}`)
      try {
        // Invoke the 'test-proxy' IPC method with the proxy string
        const isWorking = await window.electron.ipcRenderer.invoke('test-proxy', proxy)

        // Determine the status based on the boolean result
        const status = isWorking ? 'Working' : 'Not working'

        // Commit the mutation to update the status in the Vuex state
        commit('updateProxyStatus', { proxyId, status })
        return status
      } catch (error) {
        logger.info(`[store-action] Error testing proxy ${proxyId}`)
        throw error
      }
    },
    async updateProfileCookies({ commit }, { profileId, cookies }) {
      logger.info(`[store-action] Updating cookies for profile: ${profileId}`)
      try {
        // Ensure cookies are in JSON string format
        const cookiesString = typeof cookies === 'string' ? cookies : JSON.stringify(cookies)

        // Commit the mutation to update the cookies in the Vuex state
        commit('updateProfileCookies', { profileId, cookies: cookiesString })
      } catch (error) {
        logger.info(`[store-action] Error updating cookies for profile ${profileId}`)
        throw error
      }
    }
  },
  getters: {
    getProfiles: (state) => state.profiles,
    getProfileByName: (state) => (name: string) => {
      return state.profiles.find((profile) => profile.name === name)
    },
    getProxies: (state) => state.proxies,
    getProxyById: (state) => (id: number) => {
      return state.proxies.find((proxy) => proxy.id === id)
    }
  }
})

export default store
