import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Profile, ProxyData } from '../types/types'

type ProfileClosedPayload = { id: number; cookies: string }

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [proxies, setProxies] = useState<ProxyData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let mounted = true

    async function load(): Promise<void> {
      setLoading(true)
      try {
        const [loadedProfiles, loadedProxies] = await Promise.all([
          window.electron.ipcRenderer.invoke('load-profiles', ''),
          window.electron.ipcRenderer.invoke('load-proxies', '')
        ])
        if (!mounted) return
        setProfiles((loadedProfiles ?? []) as Profile[])
        setProxies((loadedProxies ?? []) as ProxyData[])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    const handler = (_: unknown, payload: ProfileClosedPayload): void => {
      setProfiles((prev) =>
        prev.map((p) => (p.id === payload.id ? { ...p, cookies: payload.cookies } : p))
      )
      void load()
    }
    window.electron.ipcRenderer.on('profile-closed', handler as never)

    return () => {
      mounted = false
      window.electron.ipcRenderer.removeListener('profile-closed', handler as never)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => p.name.toLowerCase().includes(q))
  }, [profiles, query])

  function proxyLabel(proxyId?: number): string {
    const proxy = proxies.find((p) => p.id === proxyId)
    return proxy?.name ?? 'None'
  }

  async function launchProfile(profile: Profile): Promise<void> {
    await window.electron.ipcRenderer.invoke('launch-profile', profile)
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, launched: true } : p)))
  }

  async function deleteProfile(profile: Profile): Promise<void> {
    await window.electron.ipcRenderer.invoke('delete-profile', profile)
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold">Profiles</div>
          <div className="text-sm text-muted-foreground">
            Create and launch isolated browser profiles with proxy and fingerprint settings.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search profiles…"
            className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            New profile
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1.6fr_0.8fr_0.9fr_180px] gap-3 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
          <div>Name</div>
          <div>Status</div>
          <div>Proxy</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No profiles found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1.6fr_0.8fr_0.9fr_180px] items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.useragent}</div>
                </div>
                <div className="text-sm">
                  <span
                    className={
                      p.launched ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {p.launched ? 'Launched' : 'Not launched'}
                  </span>
                </div>
                <div className="truncate text-sm">{proxyLabel(p.proxyId)}</div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => void launchProfile(p)}
                    className="h-8 rounded-md bg-emerald-600/90 px-2 text-xs font-medium text-white hover:bg-emerald-600"
                  >
                    Launch
                  </button>
                  <button className="h-8 rounded-md border border-border px-2 text-xs font-medium hover:bg-accent">
                    Edit
                  </button>
                  <button
                    onClick={() => void deleteProfile(p)}
                    className="h-8 rounded-md border border-border px-2 text-xs font-medium hover:bg-accent"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

