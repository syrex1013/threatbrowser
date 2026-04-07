/// <reference types="vite/client" />
/// <reference types="vite-plugin-terminal/client" />
declare module '*.vue' {
  const component: unknown
  export default component
}

declare global {
  interface Window {
    electron: import('@electron-toolkit/preload').ElectronAPI
    api: unknown
  }
}

export {}
