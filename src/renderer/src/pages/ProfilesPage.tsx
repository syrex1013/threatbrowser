import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Profile, ProxyData } from '../types/types'
import { ipc } from '../lib/ipc'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ProfileFormDialog } from '../components/profile/ProfileFormDialog'

type ProfileClosedPayload = { id: number; cookies: string }

export function ProfilesPage(): React.JSX.Element {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [proxies, setProxies] = useState<ProxyData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let mounted = true

    async function load(): Promise<void> {
      setLoading(true)
      try {
        const [loadedProfiles, loadedProxies] = await Promise.all([
          ipc.loadProfiles(),
          ipc.loadProxies()
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
    await ipc.launchProfile(profile)
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, launched: true } : p)))
  }

  async function deleteProfile(profile: Profile): Promise<void> {
    await ipc.deleteProfile(profile)
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
  }

  async function saveProfile(profile: Profile): Promise<void> {
    const isEdit = profiles.some((p) => p.id === profile.id)
    if (isEdit) {
      await ipc.editProfile(profile)
    } else {
      await ipc.createProfile(profile)
    }
    const [loadedProfiles, loadedProxies] = await Promise.all([
      ipc.loadProfiles(),
      ipc.loadProxies()
    ])
    setProfiles(loadedProfiles)
    setProxies(loadedProxies)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold">Profiles</div>
          <div className="text-sm text-muted-foreground">
            Create and launch isolated browser profiles with proxy and fingerprint settings.
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search profiles…"
            className="w-full sm:w-64"
          />
          <Button onClick={() => setCreateOpen(true)}>New profile</Button>
        </div>
      </div>

      <ProfileFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        profile={null}
        proxies={proxies}
        onSubmit={async (p) => {
          await saveProfile(p)
          setCreateOpen(false)
        }}
      />
      <ProfileFormDialog
        open={editProfile !== null}
        onOpenChange={(open) => {
          if (!open) setEditProfile(null)
        }}
        mode="edit"
        profile={editProfile}
        proxies={proxies}
        onSubmit={async (p) => {
          await saveProfile(p)
          setEditProfile(null)
        }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 py-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Profile list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1.6fr_0.8fr_0.9fr_200px] gap-3 px-4 py-3 text-xs font-medium text-muted-foreground">
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
                  className="grid grid-cols-[1.6fr_0.8fr_0.9fr_200px] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.useragent}</div>
                  </div>
                  <div>
                    <Badge variant={p.launched ? 'success' : 'danger'}>
                      {p.launched ? 'Launched' : 'Not launched'}
                    </Badge>
                  </div>
                  <div className="truncate text-sm">{proxyLabel(p.proxyId)}</div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => void launchProfile(p)}>
                      Launch
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditProfile(p)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void deleteProfile(p)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
