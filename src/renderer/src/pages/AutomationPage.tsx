import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { ipc, type AutomationSettingsState } from '@/lib/ipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function CopyButton({ text, label }: { text: string; label: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function Snippet({ title, code }: { title: string; code: string }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-tv-ink-subtle">
          {title}
        </span>
        <CopyButton text={code} label={`Copy ${title}`} />
      </div>
      <pre className="overflow-x-auto rounded-tv-control border border-tv-border bg-tv-surface-subtle px-3 py-2.5 font-mono text-xs leading-relaxed text-tv-ink">
        {code}
      </pre>
    </div>
  )
}

export function AutomationPage(): React.JSX.Element {
  const [settings, setSettings] = useState<AutomationSettingsState | null>(null)
  const [portInput, setPortInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const current = await ipc.automationGetSettings()
    setSettings(current)
    setPortInput(String(current.port))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function apply(next: { enabled?: boolean; port?: number }): Promise<void> {
    setBusy(true)
    try {
      setSettings(await ipc.automationSetSettings(next))
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function regenerateToken(): Promise<void> {
    if (!window.confirm('Regenerate the API token? Existing clients stop working.')) return
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    setBusy(true)
    try {
      setSettings(await ipc.automationSetSettings({ token }))
    } finally {
      setBusy(false)
    }
  }

  if (!settings) {
    return <div className="py-10 text-sm text-muted-foreground">Loading automation settings…</div>
  }

  const base = `http://127.0.0.1:${settings.port}`
  const auth = `-H "X-API-Token: ${settings.token}"`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground">
            Local API for driving profiles from scripts, and per-profile framework endpoints via the
            CLI.
          </p>
        </div>
        <Badge variant={settings.running ? 'success' : 'secondary'}>
          {settings.running ? `Listening on 127.0.0.1:${settings.port}` : 'Server off'}
        </Badge>
      </div>

      {/* Local API settings */}
      <div className="rounded-none border border-tv-border bg-tv-surface-subtle p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="automation-port">Port</Label>
            <div className="flex items-center gap-2">
              <Input
                id="automation-port"
                className="w-24 font-mono text-xs"
                inputMode="numeric"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || Number(portInput) === settings.port}
                onClick={() => void apply({ port: Number(portInput) })}
              >
                Apply
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>API token</Label>
            <div className="flex items-center gap-2">
              <code className="data-mono max-w-[280px] truncate rounded-tv-control border border-tv-border bg-white px-2.5 py-1.5 text-tv-ink">
                {settings.token}
              </code>
              <CopyButton text={settings.token} label="Copy API token" />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void regenerateToken()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>
          <div className="ml-auto">
            <Button
              disabled={busy}
              variant={settings.enabled ? 'destructive' : 'default'}
              onClick={() => void apply({ enabled: !settings.enabled })}
            >
              {settings.enabled ? 'Stop server' : 'Start server'}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Binds to 127.0.0.1 only. Every request needs the <code>X-API-Token</code> header; tokens
          are stored locally and never leave this machine.
        </p>
      </div>

      {/* Endpoints */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-none border border-tv-border bg-tv-surface-subtle p-4">
          <div>
            <h2 className="font-display text-sm font-bold">HTTP endpoints</h2>
            <p className="text-xs text-muted-foreground">
              Profile CRUD and lifecycle over the local API.
            </p>
          </div>
          <Snippet title="Health" code={`curl ${base}/health ${auth}`} />
          <Snippet title="List profiles" code={`curl ${base}/profiles ${auth}`} />
          <Snippet
            title="Create profile"
            code={`curl -X POST ${base}/profiles ${auth} \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "API profile", "humanize": true}'`}
          />
          <Snippet
            title="Start / stop a profile"
            code={`curl -X POST ${base}/profiles/1/start ${auth}\ncurl -X POST ${base}/profiles/1/stop ${auth}`}
          />
        </div>

        <div className="space-y-4 rounded-none border border-tv-border bg-tv-surface-subtle p-4">
          <div>
            <h2 className="font-display text-sm font-bold">Framework endpoints (CLI)</h2>
            <p className="text-xs text-muted-foreground">
              Drive any profile with Puppeteer, Playwright or Selenium through the bundled CLI; it
              prints the endpoint to connect to.
            </p>
          </div>
          <Snippet
            title="Puppeteer"
            code={`npx threatbrowser launch --profile 1 --framework puppeteer\n# connect: puppeteer.connect({ browserURL: '<printed endpoint>' })`}
          />
          <Snippet
            title="Playwright"
            code={`npx threatbrowser launch --profile 1 --framework playwright --headless`}
          />
          <Snippet
            title="Selenium"
            code={`npx threatbrowser launch --profile 1 --framework selenium --port 9222\n# attach RemoteWebDriver to http://127.0.0.1:9222`}
          />
          <Snippet
            title="Binary management"
            code={`npx threatbrowser install | info | update | clear-cache`}
          />
        </div>
      </div>
    </motion.div>
  )
}
