import { useEffect, useMemo, useState } from 'react'

import { motion } from 'framer-motion'
import type { ProxyCheckResult, ProxyData, ScrapedProxy } from '../types/types'
import { ipc } from '@/lib/ipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProxyFormDialog } from '@/components/proxy/ProxyFormDialog'

function parseProxyLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

export function ProxiesPage(): React.JSX.Element {
  const [proxies, setProxies] = useState<ProxyData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkingIds, setCheckingIds] = useState<number[]>([])
  const [editing, setEditing] = useState<ProxyData | null>(null)
  const [sources, setSources] = useState<Array<{ name: string; protocol: string }>>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [scraping, setScraping] = useState(false)
  const [importing, setImporting] = useState(false)
  const [scraped, setScraped] = useState<ScrapedProxy[]>([])
  const [scrapeFailures, setScrapeFailures] = useState<Array<{ source: string; error: string }>>([])

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      const [loaded, available] = await Promise.all([ipc.loadProxies(), ipc.proxySources()])
      setProxies(loaded)
      setSources(available)
      setSelectedSources((prev) => (prev.length === 0 ? available.map((s) => s.name) : prev))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return proxies
    return proxies.filter((p) => `${p.name} ${p.host} ${p.protocol}`.toLowerCase().includes(q))
  }, [proxies, query])

  function applyCheckResult(p: ProxyData, result: ProxyCheckResult): ProxyData {
    return {
      ...p,
      status: result.alive ? 'Working' : 'Not Working',
      country: result.country ?? p.country,
      latencyMs: result.latencyMs,
      anonymity: result.anonymity,
      lastCheckedAt: Date.now()
    }
  }

  async function addBulk(): Promise<void> {
    const lines = parseProxyLines(bulkInput)
    if (lines.length === 0) return
    for (const line of lines) {
      await ipc.createProxy(line)
    }
    setBulkInput('')
    await refresh()
  }

  async function checkProxy(p: ProxyData): Promise<void> {
    setCheckingIds((prev) => [...prev, p.id])
    try {
      const [result] = await ipc.checkProxies([p])
      const updated = applyCheckResult(p, result)
      await ipc.editProxy(updated)
      setProxies((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
    } finally {
      setCheckingIds((prev) => prev.filter((id) => id !== p.id))
    }
  }

  async function checkAll(): Promise<void> {
    if (proxies.length === 0) return
    setCheckingAll(true)
    try {
      const results = await ipc.checkProxies(proxies, 10)
      const updated = proxies.map((p, index) => applyCheckResult(p, results[index]))
      for (const proxy of updated) {
        // eslint-disable-next-line no-await-in-loop
        await ipc.editProxy(proxy)
      }
      setProxies(updated)
    } finally {
      setCheckingAll(false)
    }
  }

  function toggleSource(name: string): void {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    )
  }

  async function scrape(): Promise<void> {
    setScraping(true)
    try {
      const result = await ipc.scrapeProxies(selectedSources)
      setScraped(result.proxies)
      setScrapeFailures(result.failures)
    } finally {
      setScraping(false)
    }
  }

  async function importScraped(): Promise<void> {
    if (scraped.length === 0) return
    setImporting(true)
    try {
      for (const entry of scraped) {
        // eslint-disable-next-line no-await-in-loop
        await ipc.createProxy(`${entry.protocol}://${entry.host}:${entry.port}`)
      }
      setScraped([])
      await refresh()
    } finally {
      setImporting(false)
    }
  }

  async function remove(p: ProxyData): Promise<void> {
    await ipc.deleteProxy(p)
    setProxies((prev) => prev.filter((x) => x.id !== p.id))
  }

  function statusVariant(status: string | undefined): 'success' | 'danger' | 'secondary' {
    if (status === 'Working') return 'success'
    if (status === 'Not Working') return 'danger'
    return 'secondary'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Proxies</h1>
          <p className="text-sm text-muted-foreground">
            Validate and manage the proxy pool. Profiles reference a proxy by id or override with a
            URL.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, host, protocol…"
            className="w-full sm:w-64"
            aria-label="Search proxies"
          />
          <Button
            variant="secondary"
            disabled={checkingAll || proxies.length === 0}
            onClick={() => void checkAll()}
          >
            {checkingAll ? 'Checking…' : 'Check all'}
          </Button>
        </div>
      </div>

      {/* Scrape free proxies */}
      <div className="rounded-none border border-tv-border bg-tv-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Scrape free proxies</div>
            <p className="text-xs text-muted-foreground">
              Harvest public lists (ProxyScrape, proxy-list.download, GeoNode, GitHub mirrors). Free
              proxies are unreliable — check before assigning to a profile.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedSources(sources.map((s) => s.name))}
            >
              All
            </Button>
            <Button
              disabled={scraping || selectedSources.length === 0}
              onClick={() => void scrape()}
            >
              {scraping ? 'Scraping…' : `Scrape (${selectedSources.length})`}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.map((source) => {
            const active = selectedSources.includes(source.name)
            return (
              <button
                key={source.name}
                type="button"
                onClick={() => toggleSource(source.name)}
                aria-pressed={active}
                className={`data-mono rounded-none border px-2 py-1 text-[11px] ${
                  active
                    ? 'border-tv-ink bg-tv-ink text-white'
                    : 'border-tv-border bg-white text-muted-foreground'
                }`}
              >
                {source.name} · {source.protocol}
              </button>
            )
          })}
        </div>
        {(scraped.length > 0 || scrapeFailures.length > 0) && (
          <div className="mt-3 border-t border-tv-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {scraped.length} harvested
                {scrapeFailures.length > 0 && ` · ${scrapeFailures.length} sources failed`}
              </div>
              <Button
                size="sm"
                disabled={importing || scraped.length === 0}
                onClick={() => void importScraped()}
              >
                {importing ? 'Importing…' : `Import ${scraped.length} into pool`}
              </Button>
            </div>
            {scrapeFailures.length > 0 && (
              <div className="data-mono mt-2 text-[11px] text-muted-foreground">
                {scrapeFailures.map((failure) => (
                  <div key={failure.source}>
                    {failure.source}: {failure.error}
                  </div>
                ))}
              </div>
            )}
            {scraped.length > 0 && (
              <div className="data-mono mt-2 max-h-32 overflow-y-auto text-[11px] text-muted-foreground">
                {scraped.slice(0, 50).map((entry) => (
                  <div key={`${entry.protocol}://${entry.host}:${entry.port}`}>
                    {entry.protocol}://{entry.host}:{entry.port} · {entry.source}
                  </div>
                ))}
                {scraped.length > 50 && <div>…and {scraped.length - 50} more</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk add */}
      <div className="rounded-none border border-tv-border bg-tv-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Bulk add</div>
            <p className="text-xs text-muted-foreground">
              One proxy per line — http, https, socks4, socks5 with optional credentials.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkInput('')}>
              Clear
            </Button>
            <Button onClick={() => void addBulk()}>Add</Button>
          </div>
        </div>
        <Textarea
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          className="mt-3 min-h-24 font-mono text-xs"
          placeholder="socks5://user:pass@1.2.3.4:1080"
          aria-label="Proxies to add, one per line"
        />
      </div>

      {/* Pool table */}
      <div className="overflow-hidden rounded-none border border-tv-border bg-white">
        <div
          role="row"
          className="grid grid-cols-[minmax(200px,2fr)_80px_80px_80px_110px_110px_210px] items-center gap-3 border-b border-tv-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-tv-ink-subtle"
        >
          <div role="columnheader">Proxy</div>
          <div role="columnheader">Protocol</div>
          <div role="columnheader">Country</div>
          <div role="columnheader">Latency</div>
          <div role="columnheader">Anonymity</div>
          <div role="columnheader">Status</div>
          <div role="columnheader" className="text-right">
            Actions
          </div>
        </div>
        {loading ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">Loading proxies…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No proxies yet. Scrape or paste lines above to fill the pool.
          </div>
        ) : (
          <div className="divide-y divide-tv-border">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[minmax(200px,2fr)_80px_80px_80px_110px_110px_210px] items-center gap-3 px-4 py-3 transition-colors duration-tv hover:bg-tv-surface-subtle"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="data-mono truncate text-muted-foreground/70">
                    {p.host}:{p.port}
                    {p.username ? ' · auth' : ''}
                  </div>
                </div>
                <div className="data-mono text-muted-foreground">{p.protocol}</div>
                <div className="text-sm text-muted-foreground">{p.country ?? '—'}</div>
                <div className="data-mono text-sm text-muted-foreground">
                  {p.latencyMs == null ? '—' : `${p.latencyMs} ms`}
                </div>
                <div className="data-mono text-sm text-muted-foreground">{p.anonymity ?? '—'}</div>
                <div>
                  <Badge variant={statusVariant(p.status)}>{p.status || 'Unchecked'}</Badge>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={checkingIds.includes(p.id)}
                    onClick={() => void checkProxy(p)}
                  >
                    {checkingIds.includes(p.id) ? '…' : 'Check'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void remove(p)}
                    aria-label={`Delete ${p.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ProxyFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        proxy={editing}
        onSubmit={async (updated) => {
          await ipc.editProxy(updated)
          setProxies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          setEditing(null)
        }}
      />
    </motion.div>
  )
}
