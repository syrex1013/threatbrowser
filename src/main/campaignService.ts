import fs from 'fs'
import type { Browser, Page } from 'puppeteer-core'
import logger from '../logger/logger'
import type { Campaign, CampaignRun, CampaignRunEvent, CampaignStep } from './campaignTypes'
import { launchProfileForAutomation } from './profileService'

/**
 * Campaign engine: step execution over a profile's dedicated page, event
 * timeline, and persisted run state. Validation of user payloads lives in
 * campaignTypes.validateCampaign — this module owns scheduling and execution.
 */

const STEP_TIMEOUT_MS = 15000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface CampaignRunState {
  run: CampaignRun
  events: CampaignRunEvent[]
}

export class CampaignEngine {
  private readonly runs = new Map<string, CampaignRunState>()

  /** Non-terminal runs propagate stop requests to their profile id. */
  private stopTargets = new Map<string, number>()

  /** Marker thrown to unwind a run the user cancelled without failing it. */
  private cancelledRuns = new Set<string>()

  constructor(
    private readonly sendEvent: (
      channel: string,
      payload: { runId: string; event: CampaignRunEvent }
    ) => void
  ) {}

  listRuns(): CampaignRunSummary[] {
    return [...this.runs.values()].map((state) => ({
      id: state.run.id,
      campaignId: state.run.campaignId,
      status: state.run.status,
      startedAt: state.run.startedAt,
      finishedAt: state.run.finishedAt,
      error: state.run.error
    }))
  }

  getRun(runId: string): { run: CampaignRun; events: CampaignRunEvent[] } | null {
    const state = this.runs.get(runId)
    if (!state) return null
    return { run: state.run, events: state.events }
  }

  /** Runs a cycle of steps for one profile. Resolves by itself; state stays queryable. */
  async launchRun(payload: { campaign: Campaign; profileId: number }): Promise<string> {
    const runId = crypto.randomUUID()
    const run: CampaignRun = {
      id: runId,
      campaignId: payload.campaign.id,
      status: 'running',
      startedAt: Date.now(),
      logs: []
    }
    this.runs.set(runId, { run, events: [] })
    this.stopTargets.set(runId, payload.profileId)
    this.emit(runId, { ts: Date.now(), type: 'status', status: 'running' })
    // The caller invokes the cycle separately; launch only registers state.
    return runId
  }

  /** Execute all steps of a campaign on a profile (single cycle). */
  async executeSteps(
    runId: string,
    payload: { campaign: Campaign; profileId: number }
  ): Promise<void> {
    const state = this.runs.get(runId)
    if (!state) throw new Error(`Campaign run ${runId} not found`)
    let browser: Browser | null = null
    let page: Page | null = null
    try {
      const launch = await launchProfileForAutomation({ id: payload.profileId } as never)
      browser = launch.browser
      page = launch.page
      for (const [index, step] of payload.campaign.steps.entries()) {
        if (this.cancelledRuns.has(runId)) throw new CancelledError()
        this.emit(runId, { ts: Date.now(), type: 'stepStart', index, step })
        await this.step(page, runId, step)
        this.emit(runId, { ts: Date.now(), type: 'stepEnd', index, step })
      }
      this.finish(runId, 'succeeded')
    } catch (error) {
      if (error instanceof CancelledError || this.cancelledRuns.has(runId)) {
        this.finish(runId, 'cancelled')
      } else {
        state.run.error = error instanceof Error ? error.message : String(error)
        this.finish(runId, 'failed')
      }
    } finally {
      this.cancelledRuns.delete(runId)
      this.stopTargets.delete(runId)
      if (browser?.connected) await browser.close().catch(() => undefined)
    }
  }

  /** Request cancellation of a running campaign by runId. */
  stop(runId: string): boolean {
    const state = this.runs.get(runId)
    if (!state || state.run.status !== 'running') return false
    this.cancelledRuns.add(runId)
    state.run.logs.push({ ts: Date.now(), level: 'warn', message: 'Stop requested' })
    this.emit(runId, { ts: Date.now(), type: 'log', level: 'warn', message: 'Stop requested' })
    return true
  }

  private finish(runId: string, status: CampaignRun['status']): void {
    const state = this.runs.get(runId)
    if (!state) return
    state.run.status = status
    state.run.finishedAt = Date.now()
    this.emit(runId, { ts: Date.now(), type: 'status', status, error: state.run.error })
  }

  private emit(runId: string, event: CampaignRunEvent): void {
    const state = this.runs.get(runId)
    if (!state) return
    state.events.push(event)
    this.sendEvent('campaigns:run:event', { runId, event })
  }

  private async step(page: Page, runId: string, step: CampaignStep): Promise<void> {
    switch (step.type) {
      case 'openUrl':
        await page.goto(step.url, { waitUntil: step.waitUntil ?? 'domcontentloaded' })
        return
      case 'waitMs':
        await sleep(step.ms)
        return
      case 'openTab': {
        const tab = await page.browser().newPage()
        if (step.url) {
          try {
            await tab.goto(step.url, { waitUntil: step.waitUntil ?? 'domcontentloaded' })
          } catch (error) {
            await tab.close().catch(() => undefined)
            throw error
          }
        }
        return
      }
      case 'closeTab': {
        const tabs =
          (await page
            .browser()
            .pages()
            .catch(() => [])) ?? []
        const last = tabs[tabs.length - 1]
        if (tabs.length > 1 && last && !last.isClosed()) await last.close().catch(() => undefined)
        return
      }
      case 'click':
        await page.waitForSelector(step.selector, { timeout: STEP_TIMEOUT_MS })
        await page.click(step.selector)
        return
      case 'hover':
        await page.waitForSelector(step.selector, { timeout: STEP_TIMEOUT_MS })
        await page.hover(step.selector)
        return
      case 'type': {
        await page.waitForSelector(step.selector, { timeout: STEP_TIMEOUT_MS })
        // Human-like cadence: per-character delay randomized ±30%.
        await page.type(step.selector, step.text, { delay: jitterTypeDelay(step.delayMs ?? 40) })
        return
      }
      case 'press':
        await page.keyboard.press(step.key as never)
        return
      case 'scrollBy':
        await page.evaluate(({ x, y }) => window.scrollBy(x, y), { x: step.x, y: step.y })
        return
      case 'scrollTo':
        await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: step.x, y: step.y })
        return
      case 'waitForSelector':
        await page.waitForSelector(step.selector, { timeout: step.timeout ?? STEP_TIMEOUT_MS })
        return
      case 'screenshot':
        await page.screenshot({ path: step.path || undefined })
        return
      case 'eval':
        await page.evaluate(`(() => { ${step.script}; })()`)
        return
      case 'exportCookies': {
        const cookies = await page.cookies()
        this.emit(runId, {
          ts: Date.now(),
          type: 'log',
          level: 'info',
          message: `cookies_count=${cookies.length}`
        })
        return
      }
      case 'closeProfile':
        await page.browser().close()
        return
      default:
        throw new Error('Unsupported step type')
    }
  }
}

class CancelledError extends Error {
  constructor() {
    super('Campaign run cancelled')
  }
}

function jitterTypeDelay(baseMs: number): number {
  const sway = Math.max(1, Math.floor(baseMs * 0.3))
  return baseMs - sway + Math.floor(Math.random() * (sway * 2 + 1))
}

export interface CampaignRunSummary {
  id: string
  campaignId: string
  status: CampaignRun['status']
  startedAt: number
  finishedAt?: number
  error?: string
}

/** Store that keeps campaigns and run metadata across launches. */
export class CampaignStore {
  private campaigns = new Map<string, Campaign>()

  constructor(private readonly file: string) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { campaigns?: Campaign[] }
      if (Array.isArray(parsed.campaigns)) {
        for (const campaign of parsed.campaigns) this.campaigns.set(campaign.id, campaign)
      }
    } catch {
      /* fresh store */
    }
  }

  save(campaign: Campaign): Campaign {
    this.campaigns.set(campaign.id, campaign)
    this.flush()
    return campaign
  }

  remove(id: string): boolean {
    const deleted = this.campaigns.delete(id)
    if (deleted) this.flush()
    return deleted
  }

  list(): Campaign[] {
    return [...this.campaigns.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): Campaign | undefined {
    return this.campaigns.get(id)
  }

  private flush(): void {
    fs.writeFileSync(this.file, JSON.stringify({ version: 1, campaigns: this.list() }, null, 2))
    logger.info(`[campaignService] saved ${this.campaigns.size} campaigns`)
  }
}
