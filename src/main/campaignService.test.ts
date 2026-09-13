import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./profileService', () => ({
  launchProfileForAutomation: vi.fn()
}))
vi.mock('../logger/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    LOGGING_USING_IPC: false
  }
}))

import { CampaignEngine } from './campaignService'
import type { Browser, Page } from 'puppeteer-core'
import { launchProfileForAutomation } from './profileService'
import type { Campaign } from './campaignTypes'

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c1',
    name: 'Test',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    steps: [
      { type: 'openUrl', url: 'http://fixture.local/a' },
      { type: 'eval', script: 'window.__x = 41' }
    ],
    ...overrides
  }
}

type FakePage = {
  moveTo: number
  pageTitle: string
  pressed: string[]
  scrolled: Array<{ x: number; y: number }>
  typed: Array<{ selector: string; text: string; delay: number }>
  cookieCount: number
}

describe('CampaignEngine', () => {
  let page: FakePage & Page
  let events: Array<{ runId: string; event: { type: string } }>

  beforeEach(() => {
    events = []
    page = {
      moveTo: 0,
      pageTitle: 'Fixture',
      pressed: [],
      scrolled: [],
      typed: [],
      cookieCount: 7,
      goto: vi.fn(async (url: string) => {
        page.moveTo = url.includes('b') ? 2 : 1
      }),
      waitForSelector: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      browser: vi.fn(() => ({
        newPage: vi.fn(async () => ({
          close: vi.fn(async () => undefined),
          isClosed: () => false,
          goto: vi.fn(async () => undefined)
        })),
        pages: vi.fn(async () => [{ close: vi.fn(async () => undefined), isClosed: () => false }]),
        close: vi.fn(async () => undefined),
        connected: true,
        once: vi.fn(),
        on: vi.fn()
      })) as never,
      cookies: vi.fn(async () => Array.from({ length: page.cookieCount })),
      hover: vi.fn(async () => undefined),
      keyboard: { press: vi.fn(async (key: string) => page.pressed.push(key)) } as never,
      evaluate: vi.fn(async () => undefined),
      type: vi.fn(async (selector: string, text: string, { delay }: { delay: number }) =>
        page.typed.push({ selector, text, delay })
      ),
      screenshot: vi.fn(async () => undefined)
    } as unknown as FakePage & Page
  })

  function fakeLaunch() {
    vi.mocked(launchProfileForAutomation).mockResolvedValue({
      browser: page.browser() as Browser,
      page,
      profileData: { id: 7 } as never,
      profileDir: '/tmp/x'
    })
  }

  function engine(): CampaignEngine {
    return new CampaignEngine((channel, payload) => {
      void channel
      events.push(payload)
    })
  }

  it('runs steps in order and succeeds', async () => {
    fakeLaunch()
    const e = engine()
    const runId = await e.launchRun({ campaign: campaign(), profileId: 7 })
    await e.executeSteps(runId, { campaign: campaign(), profileId: 7 })
    expect(page)?.not.toBeNull()
    const run = e.getRun(runId)
    expect(run?.run.status).toBe('succeeded')
    expect(run?.run.finishedAt).toBeGreaterThan(0)
    expect(page.pageTitle).toBe('Fixture')
    // profileId passed through
    expect(launchProfileForAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }) as never
    )
  })

  it('reports failures with an error message', async () => {
    fakeLaunch()
    const broken = campaign({
      steps: [
        { type: 'openUrl', url: 'http://x' },
        { type: 'waitMs', ms: 0 }
      ]
    })
    vi.mocked(launchProfileForAutomation).mockRejectedValueOnce(new Error('launch boom'))
    const e = engine()
    const runId = await e.launchRun({ campaign: broken, profileId: 7 })
    await e.executeSteps(runId, { campaign: broken, profileId: 7 })
    const run = e.getRun(runId)
    expect(run?.run.status).toBe('failed')
    expect(run?.run.error).toMatch(/launch boom/)
  })

  it('suppresses failure paths on cancel and records cancelled status', async () => {
    fakeLaunch()
    const e = engine()
    const runId = await e.launchRun({ campaign: campaign(), profileId: 7 })
    e.stop(runId)
    await e.executeSteps(runId, { campaign: campaign(), profileId: 7 })
    expect(e.getRun(runId)?.run.status).toBe('cancelled')
  })

  it('stop does not affect finished runs', async () => {
    fakeLaunch()
    const e = engine()
    const runId = await e.launchRun({ campaign: campaign(), profileId: 7 })
    await e.executeSteps(runId, { campaign: campaign(), profileId: 7 })
    expect(e.stop(runId)).toBe(false)
  })

  it('supports openTab and closeTab steps without dying', async () => {
    fakeLaunch()
    const e = engine()
    const run = campaign({
      steps: [{ type: 'openTab', url: 'http://fixture.local/x' }, { type: 'closeTab' }]
    })
    const runId = await e.launchRun({ campaign: run, profileId: 7 })
    await e.executeSteps(runId, { campaign: run, profileId: 7 })
    expect(e.getRun(runId)?.run.status, e.getRun(runId)?.run.error).toBe('succeeded')
  })

  it('executes waitMs, press and type with jittered delay', async () => {
    fakeLaunch()
    const e = engine()
    const run = campaign({
      steps: [
        { type: 'waitMs', ms: 1 },
        { type: 'press', key: 'Enter' },
        { type: 'type', selector: '#name', text: 'abc', delayMs: 10 }
      ]
    })
    const runId = await e.launchRun({ campaign: run, profileId: 7 })
    await e.executeSteps(runId, { campaign: run, profileId: 7 })
    expect(e.getRun(runId)?.run.status, e.getRun(runId)?.run.error).toBe('succeeded')
    expect(page.pressed).toEqual(['Enter'])
    expect(page.typed).toHaveLength(1)
    expect(page.typed[0].text).toBe('abc')
    expect(page.typed[0].delay).toBeGreaterThan(0)
  })

  it('logs exportCookies count in event stream', async () => {
    fakeLaunch()
    const e = engine()
    const run = campaign({ steps: [{ type: 'exportCookies' }] })
    const runId = await e.launchRun({ campaign: run, profileId: 7 })
    await e.executeSteps(runId, { campaign: run, profileId: 7 })
    const cookieLog = events.filter((entry) => entry.event.type === 'log')
    expect(JSON.stringify(cookieLog)).toContain('cookies_count=7')
  })

  it('aggregates event timeline with step start and end', async () => {
    fakeLaunch()
    const e = engine()
    const runId = await e.launchRun({ campaign: campaign(), profileId: 7 })
    await e.executeSteps(runId, { campaign: campaign(), profileId: 7 })
    const kinds = events.filter((entry) => entry.runId === runId).map((entry) => entry.event.type)
    expect(kinds).toEqual(['status', 'stepStart', 'stepEnd', 'stepStart', 'stepEnd', 'status'])
  })

  it('runs openTab steps into a fresh tab', async () => {
    fakeLaunch()
    const e = engine()
    const newPageStub = { close: vi.fn(), isClosed: (): boolean => false }
    const browserStub = page.browser as unknown as {
      mockFn: () => { newPage: () => Promise<typeof newPageStub>; pages: () => Promise<unknown[]> }
    }
    void browserStub
    const run = campaign({ steps: [{ type: 'openTab', url: 'http://fixture.local/x' }] })
    const runId = await e.launchRun({ campaign: run, profileId: 7 })
    await e.executeSteps(runId, { campaign: run, profileId: 7 })
    expect(e.getRun(runId)?.run.status, e.getRun(runId)?.run.error).toBe('succeeded')
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })
})
