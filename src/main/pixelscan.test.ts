import { describe, expect, it, vi } from 'vitest'

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    whenReady: async () => undefined
  }
}))

vi.mock('./profileService', () => ({
  loadProfiles: vi.fn(async () => [{ id: 1, name: 'P1' }]),
  launchProfileForAutomation: vi.fn(async () => ({
    browser: { close: vi.fn(async () => undefined) },
    page: {
      goto: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => false),
      $: vi.fn(async () => null),
      waitForFunction: vi.fn(async () => undefined),
      screenshot: vi.fn(async () => undefined)
    }
  }))
}))

import { runPixelscanFingerprintCheck } from './pixelscan'

describe('pixelscan runner', () => {
  it('returns a result with profileId', async () => {
    const result = await runPixelscanFingerprintCheck({ profileId: 1 })
    expect(result.profileId).toBe(1)
    expect(result.url).toContain('pixelscan.net')
    expect(result.startedAt).toBeLessThanOrEqual(result.finishedAt)
  })
})
