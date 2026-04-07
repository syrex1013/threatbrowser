import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'

type CookieFormat = 'json' | 'netscape'

export function CookiesToolsPage(): React.JSX.Element {
  const [format, setFormat] = useState<CookieFormat>('json')
  const [profileId, setProfileId] = useState('')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)

  const numericProfileId = useMemo(() => {
    const n = Number(profileId.trim())
    return Number.isFinite(n) ? n : null
  }, [profileId])

  async function normalize(): Promise<void> {
    setBusy(true)
    try {
      const normalized = await ipc.cookiesImport({ contents: input, format })
      setOutput(normalized)
    } finally {
      setBusy(false)
    }
  }

  async function exportFromProfile(): Promise<void> {
    if (numericProfileId === null) return
    setBusy(true)
    try {
      // profile cookies are stored as JSON in profile.json; for now we just use the stored cookies blob
      // by asking main to convert JSON→netscape if needed.
      const profiles = await ipc.loadProfiles()
      const profile = profiles.find((p) => p.id === numericProfileId)
      const cookies = profile?.cookies ?? '[]'
      const converted = await ipc.cookiesExport({ cookies, format })
      setOutput(converted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Cookies tools</h1>
          <p className="text-sm text-muted-foreground">
            Normalize cookies input and convert between JSON and Netscape formats.
          </p>
        </div>
        <Badge variant="outline">IPC-backed</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convert / normalize</CardTitle>
          <CardDescription>
            Paste cookies and normalize to a JSON array compatible with Puppeteer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Format</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={format === 'json' ? 'secondary' : 'outline'}
                  onClick={() => setFormat('json')}
                >
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant={format === 'netscape' ? 'secondary' : 'outline'}
                  onClick={() => setFormat('netscape')}
                >
                  Netscape
                </Button>
              </div>
            </div>

            <div className="ml-auto flex gap-2">
              <Button disabled={busy || input.trim().length === 0} onClick={() => void normalize()}>
                {busy ? 'Working…' : 'Normalize'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Input</div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-56 font-mono text-xs"
                placeholder="Paste cookies here…"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Output</div>
              <Textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="min-h-56 font-mono text-xs"
                placeholder="Normalized output…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export from profile</CardTitle>
          <CardDescription>
            Reads the current stored cookie blob from a profile and converts it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Profile id</div>
            <Input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="e.g. 17123456789"
            />
          </div>
          <Button
            disabled={busy || numericProfileId === null}
            onClick={() => void exportFromProfile()}
          >
            Export
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
