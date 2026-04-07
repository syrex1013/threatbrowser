import { useState } from 'react'
import type { Campaign } from '../../../main/campaignTypes'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { ipc } from '../lib/ipc'

export function CampaignsPage(): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string>('')

  const demoCampaign: Campaign = {
    id: 'demo',
    name: 'Demo: open start URL',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [{ type: 'openUrl', url: 'https://example.com', waitUntil: 'domcontentloaded' }]
  }

  async function runCampaign(): Promise<void> {
    setRunning(true)
    try {
      const result = await ipc.campaignsRun({
        campaign: demoCampaign,
        profileId: profileId.trim() ? Number(profileId) : undefined
      })
      setRunId(result.runId)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Automate profile launches and scripted steps (v1 runner in progress).
          </p>
        </div>
        {runId ? <Badge variant="secondary">Last run: {runId}</Badge> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run a demo campaign</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Optional profile id</div>
            <Input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="e.g. 17123456789"
            />
          </div>
          <Button disabled={running} onClick={() => void runCampaign()}>
            {running ? 'Running…' : 'Run demo'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
