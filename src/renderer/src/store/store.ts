import { createStore } from 'vuex'
import { Profile, ProxyData } from '../types/types'
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
      logger.info(`[store-mutation] Creating profile: ${profile.name}`)
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
      logger.info(`[store-mutation] Editing profile: ${updatedProfile.name}`)
      const index = state.profiles.findIndex((p) => p.name === updatedProfile.name)
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
    }
  },
  actions: {
    async fetchProfiles({ commit }) {
      logger.info('[store-action] Fetching profiles')
      try {
        const loadedProfiles = await window.electron.ipcRenderer.invoke('load-profiles', '')
        commit('setProfiles', loadedProfiles)
      } catch (error) {
        logger.info(`[store-action] Error loading profiles: ${error}`)
      }
    },
    launchProfile({ commit }, profile: Profile) {
      logger.info(`[store-action] Launching profile: ${profile.id}`)
      window.electron.ipcRenderer.invoke('launch-profile', profile)
      commit('launchProfile', profile)
    },
    deleteProfile({ commit }, profile: Profile) {
      logger.info(`[store-action] Deleting profile: ${profile.id}`)
      window.electron.ipcRenderer.invoke('delete-profile', profile)
      commit('deleteProfile', profile)
    },
    createProfile({ commit }, profile: Profile) {
      logger.info(`[store-action] Creating profile: ${profile.name}`)
      window.electron.ipcRenderer.invoke('create-profile', profile)
      commit('createProfile', profile)
    },
    editProfile({ commit }, updatedProfile: Profile) {
      logger.info(`[store-action] Editing profile: ${updatedProfile.name}`)
      window.electron.ipcRenderer.invoke('edit-profile', updatedProfile)
      commit('editProfile', updatedProfile)
    },
    async fetchProxies({ commit }) {
      logger.info('[store-action] Fetching proxies')
      try {
        const loadedProxies = await window.electron.ipcRenderer.invoke('load-proxies', '')
        commit('setProxies', loadedProxies)
      } catch (error) {
        logger.info(`[store-action] Error loading proxies: ${error}`)
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
          logger.info(`[store-action] Parsing and creating proxy from string: ${proxyInput}`)
          proxy = await window.electron.ipcRenderer.invoke('create-proxy', proxyInput)
        } else {
          logger.info(`[store-action] Creating proxy from ProxyData object: ${proxyInput.id}`)
          proxy = proxyInput
          proxy = await window.electron.ipcRenderer.invoke('create-proxy', proxy)
        }
        commit('createProxy', proxy)
        return proxy.id
      } catch (error) {
        logger.info(`[store-action] Error creating proxy: ${error}`)
        throw error
      }
    },
    editProxy({ commit }, updatedProxy: ProxyData) {
      logger.info(`[store-action] Editing proxy: ${updatedProxy.id}`)
      window.electron.ipcRenderer.invoke('edit-proxy', updatedProxy)
      commit('editProxy', updatedProxy)
    },
    async getProxyCountry({ commit }, { proxyId, proxy }: { proxyId: number; proxy: string }) {
      logger.info(`[store-action] Getting country for proxy: ${proxy}`)
      try {
        const country = await window.electron.ipcRenderer.invoke('get-proxy-country', proxy)
        commit('updateProxyCountry', { proxyId, country })
        return country
      } catch (error) {
        logger.info(`[store-action] Error getting country for proxy ${proxyId}: ${error}`)
        throw error
      }
    },
    async getProxyStatus({ commit }, { proxyId, proxy }: { proxyId: number; proxy: string }) {
      logger.info(`[store-action] Testing proxy: ${proxy}`)
      try {
        // Invoke the 'test-proxy' IPC method with the proxy string
        const isWorking = await window.electron.ipcRenderer.invoke('test-proxy', proxy)

        // Determine the status based on the boolean result
        const status = isWorking ? 'Working' : 'Not working'

        // Commit the mutation to update the status in the Vuex state
        commit('updateProxyStatus', { proxyId, status })
        return status
      } catch (error) {
        logger.info(`[store-action] Error testing proxy ${proxyId}: ${error}`)
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
