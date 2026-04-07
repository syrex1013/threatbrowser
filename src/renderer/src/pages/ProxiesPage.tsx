import { useEffect, useMemo, useState } from 'react'

import { motion } from 'framer-motion'
import type { ProxyData } from '../types/types'
import { ipc } from '../lib/ipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProxyFormDialog } from '@/components/proxy/ProxyFormDialog'

function proxyToUrl(p: ProxyData): string {
  const creds = p.username ? `${p.username}:${p.password ?? ''}@` : ''
  return `${p.protocol}://${creds}${p.host}:${p.port}`
}

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
  const [editing, setEditing] = useState<ProxyData | null>(null)

  async function refresh(): Promise<void> {
    setLoading(true)
    try {
      setProxies(await ipc.loadProxies())
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
    const url = proxyToUrl(p)
    const [country, ok] = await Promise.all([ipc.getProxyCountry(url), ipc.testProxy(url)])
    const status = ok ? 'Working' : 'Not Working'
    const updated: ProxyData = { ...p, country, status }
    await ipc.editProxy(updated)
    setProxies((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
  }

  async function checkAll(): Promise<void> {
    setCheckingAll(true)
    try {
      for (const p of proxies) {
        // eslint-disable-next-line no-await-in-loop
        await checkProxy(p)
      }
    } finally {
      setCheckingAll(false)
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
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Proxies</h1>
          <p className="text-sm text-muted-foreground">
            Add, validate, and manage proxy pools. Profiles can reference proxies by id or override
            with a URL.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search proxies…"
            className="w-full sm:w-64"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bulk add</CardTitle>
            <CardDescription>
              One proxy per line. Format: `http://user:pass@host:port` (also supports
              https/socks4/socks5).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="min-h-36 font-mono text-xs"
              placeholder="socks5://user:pass@1.2.3.4:1080"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkInput('')}>
                Clear
              </Button>
              <Button onClick={() => void addBulk()}>Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>List</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${filtered.length} proxies`}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_200px] gap-3 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
              <div>Name</div>
              <div>Country</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No proxies.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1.3fr_0.8fr_0.7fr_200px] items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {proxyToUrl(p)}
                      </div>
                    </div>
                    <div className="text-sm">{p.country ?? 'Unknown'}</div>
                    <div>
                      <Badge variant={statusVariant(p.status)}>{p.status || 'Unchecked'}</Badge>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void checkProxy(p)}>
                        Check
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void remove(p)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
