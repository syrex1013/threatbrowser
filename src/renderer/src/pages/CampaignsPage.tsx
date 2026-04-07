import { useMemo, useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import type { Campaign, CampaignStep } from '../../../main/campaignTypes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'

type StepKind = CampaignStep['type']

const blockPalette: Array<{ kind: StepKind; label: string; description?: string }> = [
  { kind: 'openUrl', label: 'Go to URL', description: 'Navigate current tab to URL' },
  { kind: 'click', label: 'Click', description: 'Click an element by selector' },
  { kind: 'type', label: 'Input text', description: 'Type text into an input' },
  { kind: 'scrollBy', label: 'Scroll', description: 'Scroll by X/Y pixels' },
  { kind: 'waitMs', label: 'Wait', description: 'Pause execution' },
  { kind: 'press', label: 'Press key', description: 'Keyboard press' },
  { kind: 'eval', label: 'Eval', description: 'Run custom JS in page context' },
  { kind: 'exportCookies', label: 'Export cookies', description: 'Log cookies count (v1)' },
  { kind: 'closeProfile', label: 'Close browser', description: 'Close profile window' }
]

type BlockId = string

type Block =
  | {
      id: BlockId
      type: 'openUrl'
      url: string
      waitUntil?: 'domcontentloaded' | 'load' | 'networkidle0' | 'networkidle2'
    }
  | { id: BlockId; type: 'click'; selector: string }
  | { id: BlockId; type: 'type'; selector: string; text: string; delayMs?: number }
  | { id: BlockId; type: 'scrollBy'; x: number; y: number }
  | { id: BlockId; type: 'waitMs'; ms: number }
  | { id: BlockId; type: 'press'; key: string }
  | { id: BlockId; type: 'eval'; script: string }
  | { id: BlockId; type: 'exportCookies' }
  | { id: BlockId; type: 'closeProfile' }

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function blockToStep(block: Block): CampaignStep {
  // Drop id before sending to main
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = block
  return rest as CampaignStep
}

export function CampaignsPage(): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string>('')

  const [campaignName, setCampaignName] = useState('New campaign')
  const [blocks, setBlocks] = useState<Block[]>([
    { id: newId(), type: 'openUrl', url: 'https://example.com', waitUntil: 'domcontentloaded' }
  ])

  const steps = useMemo<CampaignStep[]>(() => blocks.map(blockToStep), [blocks])

  const campaign = useMemo<Campaign>(() => {
    return {
      id: `local-${Date.now()}`,
      name: campaignName.trim() || 'Campaign',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps
    }
  }, [campaignName, steps])

  function addBlock(kind: StepKind): void {
    const id = newId()
    setBlocks((prev) => {
      switch (kind) {
        case 'openUrl':
          return [
            ...prev,
            { id, type: 'openUrl', url: 'https://example.com', waitUntil: 'domcontentloaded' }
          ]
        case 'click':
          return [...prev, { id, type: 'click', selector: '' }]
        case 'type':
          return [...prev, { id, type: 'type', selector: '', text: '' }]
        case 'scrollBy':
          return [...prev, { id, type: 'scrollBy', x: 0, y: 800 }]
        case 'waitMs':
          return [...prev, { id, type: 'waitMs', ms: 1000 }]
        case 'press':
          return [...prev, { id, type: 'press', key: 'Enter' }]
        case 'eval':
          return [...prev, { id, type: 'eval', script: 'return document.title' }]
        case 'exportCookies':
          return [...prev, { id, type: 'exportCookies' }]
        case 'closeProfile':
          return [...prev, { id, type: 'closeProfile' }]
        default:
          return prev
      }
    })
  }

  function removeBlock(id: BlockId): void {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  function moveBlock(id: BlockId, direction: -1 | 1): void {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      const next = idx + direction
      if (next < 0 || next >= prev.length) return prev
      const copy = [...prev]
      const tmp = copy[idx]
      copy[idx] = copy[next]
      copy[next] = tmp
      return copy
    })
  }

  function updateBlock(id: BlockId, patch: Partial<Block>): void {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)))
  }

  async function runCampaign(): Promise<void> {
    setRunning(true)
    try {
      const result = await ipc.campaignsRun({
        campaign,
        profileId: profileId.trim() ? Number(profileId) : undefined
      })
      setRunId(result.runId)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Build programmable campaigns from stackable blocks and run them on a profile.
          </p>
        </div>
        {runId ? <Badge variant="secondary">Last run: {runId}</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign builder</CardTitle>
          <CardDescription>
            Stack blocks like Scratch: add, reorder, configure, run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Campaign name</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Optional profile id</Label>
              <Input
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="e.g. 17123456789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div className="text-sm font-medium">Blocks palette</div>
              <Badge variant="outline">{blocks.length} blocks</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {blockPalette.map((s) => (
                <Button
                  key={s.kind}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addBlock(s.kind)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Block stack</div>
            <div className="space-y-2">
              {blocks.map((b, idx) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-border bg-card/40 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm font-medium">
                        {blockPalette.find((p) => p.kind === b.type)?.label ?? b.type}
                      </div>
                      <Badge variant="outline">#{idx + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={idx === 0}
                        onClick={() => moveBlock(b.id, -1)}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={idx === blocks.length - 1}
                        onClick={() => moveBlock(b.id, 1)}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeBlock(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {b.type === 'openUrl' ? (
                      <div className="space-y-1 md:col-span-2">
                        <Label>URL</Label>
                        <Input
                          value={b.url}
                          onChange={(e) => updateBlock(b.id, { url: e.target.value })}
                        />
                      </div>
                    ) : null}

                    {b.type === 'click' ? (
                      <div className="space-y-1 md:col-span-2">
                        <Label>Selector</Label>
                        <Input
                          value={b.selector}
                          onChange={(e) => updateBlock(b.id, { selector: e.target.value })}
                          placeholder="#login"
                        />
                      </div>
                    ) : null}

                    {b.type === 'type' ? (
                      <>
                        <div className="space-y-1">
                          <Label>Selector</Label>
                          <Input
                            value={b.selector}
                            onChange={(e) => updateBlock(b.id, { selector: e.target.value })}
                            placeholder="input[name=email]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Text</Label>
                          <Input
                            value={b.text}
                            onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                            placeholder="{{email}}"
                          />
                        </div>
                      </>
                    ) : null}

                    {b.type === 'waitMs' ? (
                      <div className="space-y-1">
                        <Label>Milliseconds</Label>
                        <Input
                          value={String(b.ms)}
                          onChange={(e) => updateBlock(b.id, { ms: Number(e.target.value) || 0 })}
                        />
                      </div>
                    ) : null}

                    {b.type === 'press' ? (
                      <div className="space-y-1">
                        <Label>Key</Label>
                        <Input
                          value={b.key}
                          onChange={(e) => updateBlock(b.id, { key: e.target.value })}
                          placeholder="Enter"
                        />
                      </div>
                    ) : null}

                    {b.type === 'scrollBy' ? (
                      <>
                        <div className="space-y-1">
                          <Label>Scroll X</Label>
                          <Input
                            value={String(b.x)}
                            onChange={(e) => updateBlock(b.id, { x: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Scroll Y</Label>
                          <Input
                            value={String(b.y)}
                            onChange={(e) => updateBlock(b.id, { y: Number(e.target.value) || 0 })}
                          />
                        </div>
                      </>
                    ) : null}

                    {b.type === 'eval' ? (
                      <div className="space-y-1 md:col-span-2">
                        <Label>Script</Label>
                        <Textarea
                          value={b.script}
                          onChange={(e) => updateBlock(b.id, { script: e.target.value })}
                          className="min-h-24 font-mono text-xs"
                        />
                      </div>
                    ) : null}

                    {b.type === 'exportCookies' || b.type === 'closeProfile' ? (
                      <div className="text-xs text-muted-foreground md:col-span-2">
                        No parameters.
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Blocks execute top-to-bottom. Use Up/Down to reorder.
            </div>
            <Button disabled={running} onClick={() => void runCampaign()}>
              {running ? 'Running…' : 'Run campaign'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
