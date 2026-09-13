import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type CookieFormat = 'json' | 'netscape' | 'mozilla'

export function CookiesToolsPage(): React.JSX.Element {
  const [format, setFormat] = useState<CookieFormat>('json')
  const [profileId, setProfileId] = useState('')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [collectDomains, setCollectDomains] = useState('')
  const [collectBusy, setCollectBusy] = useState(false)
  const [collectResult, setCollectResult] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<{ id: number; domains: string[] } | null>(
    null
  )
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const numericProfileId = useMemo(() => {
    const n = Number(profileId.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
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

  async function collectCookies(unlock?: {
    id: number
    domains: string[]
    password: string
  }): Promise<void> {
    const id = unlock?.id ?? numericProfileId
    if (id === null || collectBusy) return
    const domains =
      unlock?.domains ??
      collectDomains
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    if (domains.length === 0) {
      setCollectResult('Enter at least one domain (one per line)')
      return
    }
    setCollectBusy(true)
    try {
      if (!unlock) {
        const profile = (await ipc.loadProfiles()).find((profile) => profile.id === id)
        if (!profile) throw new Error(`Profile ${id} not found`)
        if (profile.hasPassword) {
          setPasswordTarget({ id, domains })
          setPassword('')
          setPasswordError('')
          return
        }
      }
      const merged = (await ipc.collectCookies(id, domains, unlock?.password)) as Array<{
        name?: string
        domain?: string
      }>
      setCollectResult(`Collected ${merged.length} cookies`)
      setOutput(JSON.stringify(merged, null, 2))
      setPasswordTarget(null)
      setPassword('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setCollectResult(message)
      if (unlock) setPasswordError(message)
    } finally {
      setCollectBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Cookies tools</h1>
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
                <Button
                  size="sm"
                  variant={format === 'mozilla' ? 'secondary' : 'outline'}
                  onClick={() => setFormat('mozilla')}
                >
                  Mozilla
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

      <Card>
        <CardHeader>
          <CardTitle>Cookie collector</CardTitle>
          <CardDescription>
            Launch a profile, visit each domain, and harvest the session cookies into the profile
            store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Profile id</div>
              <Input
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="e.g. 17123456789"
              />
            </div>
            <Button
              disabled={collectBusy || numericProfileId === null}
              onClick={() => void collectCookies()}
            >
              {collectBusy ? 'Collecting…' : 'Collect'}
            </Button>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Domains (one per line)</div>
            <Textarea
              value={collectDomains}
              onChange={(e) => setCollectDomains(e.target.value)}
              placeholder={'https://example.com\nhttps://example.org'}
              className="min-h-20 font-mono text-xs"
            />
          </div>
          {collectResult && <p className="text-xs text-muted-foreground">{collectResult}</p>}
        </CardContent>
      </Card>
      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open && !collectBusy) {
            setPasswordTarget(null)
            setPassword('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock cookie collector</DialogTitle>
          </DialogHeader>
          <Label htmlFor="collector-password">Profile password</Label>
          <Input
            id="collector-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError && (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={collectBusy}
              onClick={() => {
                setPasswordTarget(null)
                setPassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={collectBusy}
              onClick={() => {
                if (passwordTarget) void collectCookies({ ...passwordTarget, password })
              }}
            >
              {collectBusy ? 'Collecting…' : 'Collect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
