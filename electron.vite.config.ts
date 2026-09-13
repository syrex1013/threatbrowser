import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      // ESM-only packages ("exports" without a require condition) must be
      // bundled into the CJS main output: cloakbrowser (stealth engine) and
      // socks-proxy-agent (proxy testing). Dual CJS/ESM peers stay external.
      externalizeDepsPlugin({ exclude: ['cloakbrowser', 'socks-proxy-agent'] })
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
