import { useMemo, useState } from 'react'
import type { Campaign, CampaignStep } from '../../../main/campaignTypes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'

type StepKind = CampaignStep['type']

const stepKinds: Array<{ kind: StepKind; label: string }> = [
  { kind: 'openUrl', label: 'Go to URL' },
  { kind: 'click', label: 'Click' },
  { kind: 'type', label: 'Input text' },
  { kind: 'scrollBy', label: 'Scroll by' },
  { kind: 'waitMs', label: 'Wait (ms)' },
  { kind: 'press', label: 'Press key' },
  { kind: 'eval', label: 'Custom script' },
  { kind: 'exportCookies', label: 'Export cookies (log count)' },
  { kind: 'closeProfile', label: 'Close browser' }
]

export function CampaignsPage(): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string>('')

  const [campaignName, setCampaignName] = useState('New campaign')
  const [startUrl, setStartUrl] = useState('https://example.com')
  const [clickSelector, setClickSelector] = useState('')
  const [typeSelector, setTypeSelector] = useState('')
  const [typeText, setTypeText] = useState('')
  const [waitMs, setWaitMs] = useState('1000')
  const [pressKey, setPressKey] = useState('Enter')
  const [scrollX, setScrollX] = useState('0')
  const [scrollY, setScrollY] = useState('800')
  const [customScript, setCustomScript] = useState('return document.title')

  const [selectedSteps, setSelectedSteps] = useState<StepKind[]>(['openUrl'])

  const steps = useMemo<CampaignStep[]>(() => {
    const out: CampaignStep[] = []
    for (const kind of selectedSteps) {
      switch (kind) {
        case 'openUrl':
          out.push({ type: 'openUrl', url: startUrl, waitUntil: 'domcontentloaded' })
          break
        case 'click':
          if (clickSelector.trim()) out.push({ type: 'click', selector: clickSelector.trim() })
          break
        case 'type':
          if (typeSelector.trim()) {
            out.push({ type: 'type', selector: typeSelector.trim(), text: typeText })
          }
          break
        case 'scrollBy':
          out.push({ type: 'scrollBy', x: Number(scrollX) || 0, y: Number(scrollY) || 0 })
          break
        case 'waitMs':
          out.push({ type: 'waitMs', ms: Number(waitMs) || 0 })
          break
        case 'press':
          if (pressKey.trim()) out.push({ type: 'press', key: pressKey.trim() })
          break
        case 'eval':
          if (customScript.trim()) out.push({ type: 'eval', script: customScript })
          break
        case 'exportCookies':
          out.push({ type: 'exportCookies' })
          break
        case 'closeProfile':
          out.push({ type: 'closeProfile' })
          break
      }
    }
    return out.length ? out : [{ type: 'openUrl', url: startUrl, waitUntil: 'domcontentloaded' }]
  }, [
    selectedSteps,
    startUrl,
    clickSelector,
    typeSelector,
    typeText,
    scrollX,
    scrollY,
    waitMs,
    pressKey,
    customScript
  ])

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

  function toggleStep(kind: StepKind): void {
    setSelectedSteps((prev) => {
      if (prev.includes(kind)) return prev.filter((k) => k !== kind)
      return [...prev, kind]
    })
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
          <CardDescription>Pick blocks, fill parameters, then run.</CardDescription>
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
            <div className="text-sm font-medium">Blocks</div>
            <div className="flex flex-wrap gap-2">
              {stepKinds.map((s) => (
                <Button
                  key={s.kind}
                  type="button"
                  size="sm"
                  variant={selectedSteps.includes(s.kind) ? 'secondary' : 'outline'}
                  onClick={() => toggleStep(s.kind)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Go to URL</Label>
              <Input value={startUrl} onChange={(e) => setStartUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Click selector</Label>
              <Input
                value={clickSelector}
                onChange={(e) => setClickSelector(e.target.value)}
                placeholder="#login"
              />
            </div>
            <div className="space-y-2">
              <Label>Input selector</Label>
              <Input
                value={typeSelector}
                onChange={(e) => setTypeSelector(e.target.value)}
                placeholder="input[name=email]"
              />
            </div>
            <div className="space-y-2">
              <Label>Input text</Label>
              <Input
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                placeholder="{{email}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Wait (ms)</Label>
              <Input value={waitMs} onChange={(e) => setWaitMs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Press key</Label>
              <Input
                value={pressKey}
                onChange={(e) => setPressKey(e.target.value)}
                placeholder="Enter"
              />
            </div>
            <div className="space-y-2">
              <Label>Scroll X</Label>
              <Input value={scrollX} onChange={(e) => setScrollX(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Scroll Y</Label>
              <Input value={scrollY} onChange={(e) => setScrollY(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custom script (eval)</Label>
            <Textarea
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              className="min-h-28 font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Tip: blocks are executed in the order you enable them (top-to-bottom in this list).
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
