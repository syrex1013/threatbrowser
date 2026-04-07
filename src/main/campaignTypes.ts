export type CampaignId = string

export interface Campaign {
  id: CampaignId
  name: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  tags?: string[]
  concurrency?: number
  steps: CampaignStep[]
}

export type CampaignStep =
  | { type: 'openUrl'; url: string; waitUntil?: 'domcontentloaded' | 'load' | 'networkidle0' | 'networkidle2' }
  | { type: 'waitMs'; ms: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string; delayMs?: number }
  | { type: 'press'; key: string }
  | { type: 'scrollBy'; x: number; y: number }
  | { type: 'eval'; script: string }
  | { type: 'exportCookies' }
  | { type: 'closeProfile' }

export interface CampaignRun {
  id: string
  campaignId: CampaignId
  startedAt: number
  finishedAt?: number
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  error?: string
  logs: Array<{ ts: number; level: 'info' | 'warn' | 'error'; message: string }>
}

export function validateCampaign(campaign: Campaign): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []

  if (!campaign.id) errors.push('id is required')
  if (!campaign.name) errors.push('name is required')
  if (!Array.isArray(campaign.steps) || campaign.steps.length === 0) errors.push('steps must be non-empty')

  for (const [idx, step] of (campaign.steps ?? []).entries()) {
    if (!step || typeof step !== 'object') {
      errors.push(`step[${idx}] is invalid`)
      continue
    }
    switch (step.type) {
      case 'openUrl':
        if (!step.url) errors.push(`step[${idx}].url is required`)
        break
      case 'waitMs':
        if (!Number.isFinite(step.ms) || step.ms < 0) errors.push(`step[${idx}].ms must be >= 0`)
        break
      case 'click':
      case 'press':
        if (!(step as any).selector && step.type === 'click') errors.push(`step[${idx}].selector is required`)
        if (!(step as any).key && step.type === 'press') errors.push(`step[${idx}].key is required`)
        break
      case 'type':
        if (!step.selector) errors.push(`step[${idx}].selector is required`)
        if (typeof step.text !== 'string') errors.push(`step[${idx}].text is required`)
        break
      case 'scrollBy':
        if (!Number.isFinite(step.x) || !Number.isFinite(step.y)) errors.push(`step[${idx}] x/y must be numbers`)
        break
      case 'eval':
        if (!step.script) errors.push(`step[${idx}].script is required`)
        break
      case 'exportCookies':
      case 'closeProfile':
        break
      default:
        errors.push(`step[${idx}].type is unsupported`)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export type CampaignRunStatus = CampaignRun['status']

export type CampaignRunEvent =
  | { ts: number; type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { ts: number; type: 'stepStart'; index: number; step: CampaignStep }
  | { ts: number; type: 'stepEnd'; index: number; step: CampaignStep }
  | { ts: number; type: 'status'; status: CampaignRunStatus; error?: string }

