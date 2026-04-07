import { describe, expect, it, vi } from 'vitest'

import { ipc } from './ipc'

describe('ipc wrapper', () => {
  it('throws if window.electron is missing', async () => {
    const original = globalThis.window?.electron
    ;(globalThis as unknown as { window: Window }).window = (globalThis.window ??
      ({} as Window)) as Window
    // @ts-expect-error test override
    delete (globalThis.window as Window & { electron?: unknown }).electron

    await expect(ipc.loadProfiles()).rejects.toThrow(/Electron IPC is not available/i)
    ;(globalThis.window as Window & { electron?: unknown }).electron = original
  })

  it('invokes load-profiles channel', async () => {
    const invoke = vi.fn(async () => [{ id: 1 }])
    // @ts-expect-error test override
    globalThis.window = { electron: { ipcRenderer: { invoke } } } as unknown as Window

    await ipc.loadProfiles()

    expect(invoke).toHaveBeenCalledWith('load-profiles', '')
  })
})
