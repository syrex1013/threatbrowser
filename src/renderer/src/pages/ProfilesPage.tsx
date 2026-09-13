import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MoreHorizontal, Play, Plus, Square } from 'lucide-react'
import type { Profile, ProfileConfig } from '../../../shared/profileSettings'
import type { ProxyData } from '../types/types'
import { ipc } from '@/lib/ipc'
import { PROFILE_TEMPLATES } from '@/lib/profileTemplates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ProfileFormDialog } from '@/components/profile/ProfileFormDialog'

type ProfileClosedPayload = { id: number; cookies: string }

/**
 * Deterministic avatar hue per profile — the antidetect-manager convention
 * (AdsPower-style colored orbs) so operators recognize profiles by color.
 */
function avatarHue(id: number): number {
  return (Math.abs(Math.trunc(id)) * 137) % 360
}

function ProfileAvatar({ profile }: { profile: Profile }): React.JSX.Element {
  const hue = avatarHue(profile.id)
  return (
    <div
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-tv-control border font-display text-sm font-extrabold"
      style={{
        background: `hsl(${hue} 45% 92%)`,
        color: `hsl(${hue} 55% 30%)`,
        borderColor: `hsl(${hue} 40% 80%)`
      }}
    >
      {(profile.name.trim()[0] ?? '?').toUpperCase()}
    </div>
  )
}

export function ProfilesPage(): React.JSX.Element {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [proxies, setProxies] = useState<ProxyData[]>([])
  const [configs, setConfigs] = useState<ProfileConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busyCheck, setBusyCheck] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkConfigId, setBulkConfigId] = useState('')
  const [bulkCount, setBulkCount] = useState('5')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const [configsError, setConfigsError] = useState('')
  const [pageError, setPageError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [passwordAction, setPasswordAction] = useState<{
    profile: Profile
    action: 'launch' | 'one-time' | 'check'
  } | null>(null)
  const [actionPassword, setActionPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [loadedProfiles, loadedProxies, loadedConfigs] = await Promise.allSettled([
        ipc.loadProfiles(),
        ipc.loadProxies(),
        ipc.configsList()
      ])
      if (loadedProfiles.status === 'fulfilled') setProfiles(loadedProfiles.value)
      if (loadedProxies.status === 'fulfilled') setProxies(loadedProxies.value)
      const failure = [loadedProfiles, loadedProxies].find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') setPageError(String(failure.reason))
      if (loadedConfigs.status === 'fulfilled') {
        setConfigs([...PROFILE_TEMPLATES, ...loadedConfigs.value])
        setConfigsError('')
      } else {
        setConfigsError(String(loadedConfigs.reason))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const handler = (_: unknown, payload: ProfileClosedPayload): void => {
      setProfiles((prev) =>
        prev.map((p) => (p.id === payload.id ? { ...p, cookies: payload.cookies } : p))
      )
      void load()
    }
    const unsub = ipc.onProfileClosed((payload) => handler(undefined, payload))
    return () => {
      unsub()
    }
  }, [load])

  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const p of profiles) for (const t of p.tags ?? []) if (t) seen.add(t)
    return [...seen].sort()
  }, [profiles])

  const allFolders = useMemo(() => {
    const seen = new Set<string>()
    for (const p of profiles) if (p.folder) seen.add(p.folder)
    return [...seen].sort()
  }, [profiles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return profiles.filter((p) => {
      if (activeFolder && p.folder !== activeFolder) return false
      const tagMatch =
        activeTags.length === 0 || activeTags.every((t) => (p.tags ?? []).includes(t))
      if (!tagMatch) return false
      if (!q) return true
      const haystack = [p.name, p.useragent, (p.tags ?? []).join(' ')].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [profiles, query, activeTags, activeFolder])

  const runningCount = profiles.filter((p) => p.launched).length
  const proxiedCount = profiles.filter((p) => Boolean(p.proxy)).length

  function toggleTag(tag: string): void {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function toggleSelected(id: number): void {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function proxyLabel(proxyId?: number): string {
    const proxy = proxies.find((p) => p.id === proxyId)
    return proxy?.name ?? 'Direct'
  }

  async function runProfileAction(
    profile: Profile,
    action: 'launch' | 'one-time' | 'check',
    password?: string
  ): Promise<void> {
    if (passwordBusy) return
    if (profile.hasPassword && password === undefined) {
      setPasswordAction({ profile, action })
      setActionPassword('')
      setPasswordError('')
      return
    }
    setPasswordBusy(true)
    setPasswordError('')
    setPageError('')
    try {
      if (action === 'launch') await ipc.launchProfile(profile, password)
      else if (action === 'one-time')
        await ipc.launchOneTimeProfile({ profileId: profile.id, password })
      else {
        setBusyCheck(profile.id)
        const result = (await ipc.pixelscanFingerprintCheck({
          profileId: profile.id,
          password
        })) as {
          error?: string
          verdictText?: string
          screenshotPath?: string
        }
        if (result.error) throw new Error(result.error)
        window.alert(
          (result.verdictText ?? '').slice(0, 500) ||
            `Scan finished${result.screenshotPath ? ` (screenshot: ${result.screenshotPath})` : ''}`
        )
      }
      setPasswordAction(null)
      setActionPassword('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (password !== undefined) setPasswordError(message)
      else setPageError(message)
    } finally {
      setBusyCheck(null)
      setPasswordBusy(false)
      await load()
    }
  }

  async function stopProfile(profile: Profile): Promise<void> {
    await ipc.stopProfile(profile.id)
    await load()
  }

  async function deleteProfile(profile: Profile): Promise<void> {
    await ipc.deleteProfile(profile)
    setSelected((prev) => prev.filter((id) => id !== profile.id))
    await load()
  }

  async function duplicateProfile(profile: Profile): Promise<void> {
    const copy: Profile = {
      ...profile,
      password: undefined,
      hasPassword: false,
      id: 0,
      name: `${profile.name} copy`,
      launched: false
    }
    const created = await ipc.createProfile(copy)
    setSelected([created.id])
    await load()
  }

  async function exportSelected(): Promise<void> {
    setBusyAction(true)
    try {
      const path = await ipc.exportProfilesToFile(selected)
      if (path) window.alert(`Exported ${selected.length || 'all'} profile(s) to ${path}`)
    } finally {
      setBusyAction(false)
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!window.confirm(`Delete ${selected.length} selected profile(s)?`)) return
    setBusyAction(true)
    try {
      for (const id of selected) {
        const p = profiles.find((x) => x.id === id)
        if (p) await ipc.deleteProfile(p)
      }
      setSelected([])
      await load()
    } finally {
      setBusyAction(false)
    }
  }

  async function stopSelected(): Promise<void> {
    setBusyAction(true)
    try {
      for (const id of selected) await ipc.stopProfile(id)
      await load()
    } finally {
      setBusyAction(false)
    }
  }

  async function submitBulk(): Promise<void> {
    const config = configs.find((c) => String(c.id) === bulkConfigId)
    if (!config) {
      window.alert('Choose a config/template to replicate')
      return
    }
    const count = Number(bulkCount)
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      window.alert('Count must be an integer between 1 and 100')
      return
    }
    const prefix = bulkPrefix.trim()
    if (!prefix) {
      window.alert('Prefix is required')
      return
    }
    setBulkBusy(true)
    try {
      const result = await ipc.bulkCreateProfiles(config, count, prefix)
      const ids = result.profiles.map((profile) => profile.id)
      setSelected(ids)
      setBulkResult(
        `Created ${ids.length} profile(s)${ids.length ? `: ${ids.join(', ')}` : ''}.${result.error ? ` ${result.error} Successful profiles were retained; do not repeat the full request.` : ''}`
      )
      setBulkOpen(false)
      setBulkConfigId('')
      setBulkCount('5')
      setBulkPrefix('')
    } catch (error) {
      setBulkResult(error instanceof Error ? error.message : String(error))
    } finally {
      await load()
      setBulkBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Isolated stealth-engine browser profiles, isolated on this machine.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, tag, user agent…"
            className="w-full sm:w-72"
            aria-label="Search profiles"
          />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New profile
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            Bulk create…
          </Button>
        </div>
      </div>
      {pageError && (
        <p role="alert" className="text-sm text-destructive">
          {pageError}
        </p>
      )}
      {configsError && (
        <p role="alert" className="text-sm text-destructive">
          Configs unavailable: {configsError}
        </p>
      )}
      {bulkResult && (
        <p role="status" className="text-sm">
          {bulkResult}
        </p>
      )}

      {/* Ops strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-none border border-tv-border bg-tv-surface-subtle px-4 py-2.5 text-xs text-tv-ink-subtle">
        <span>
          <strong className="font-semibold text-foreground">{profiles.length}</strong> total
        </span>
        <span>
          <strong className="font-semibold text-tv-red">{runningCount}</strong> running
        </span>
        <span>
          <strong className="font-semibold text-foreground">{proxiedCount}</strong> proxied
        </span>
        {allFolders.length > 0 && (
          <label className="ml-auto flex items-center gap-2">
            <span className="text-tv-ink-subtle">Folder</span>
            <select
              value={activeFolder}
              onChange={(e) => setActiveFolder(e.target.value)}
              className="h-7 rounded-tv-control border border-tv-border-strong bg-white px-2 text-xs text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Filter by folder"
            >
              <option value="">All folders</option>
              {allFolders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="data-mono text-tv-ink-subtle/70">
          seed · canvas/webgl · persistent per profile
        </span>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag)
            return (
              <Button
                key={tag}
                size="sm"
                variant={active ? 'secondary' : 'outline'}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Button>
            )
          })}
          {activeTags.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveTags([])}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-none border-2 border-tv-red bg-tv-red-soft px-4 py-2">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void stopSelected()}
            >
              Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction}
              onClick={() => void exportSelected()}
            >
              Export
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busyAction}
              onClick={() => void deleteSelected()}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      <ProfileFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        profile={null}
        proxies={proxies}
        configs={configs}
        configsError={configsError}
        onConfigsChanged={load}
        onSubmit={load}
      />
      <ProfileFormDialog
        open={editProfile !== null}
        onOpenChange={(open) => {
          if (!open) setEditProfile(null)
        }}
        mode="edit"
        profile={editProfile}
        proxies={proxies}
        configs={configs}
        configsError={configsError}
        onConfigsChanged={load}
        onSubmit={load}
      />

      {/* Profile table */}
      <div className="overflow-hidden rounded-none border border-tv-border bg-white">
        <div
          role="row"
          className="grid grid-cols-[28px_minmax(220px,2fr)_110px_minmax(120px,1fr)_minmax(180px,1.4fr)_190px] items-center gap-3 border-b border-tv-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-tv-ink-subtle"
        >
          <div />
          <div role="columnheader">Profile</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Network</div>
          <div role="columnheader">Fingerprint</div>
          <div role="columnheader" className="text-right">
            Actions
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">Loading profiles…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {profiles.length === 0
                ? 'No profiles yet. Create your first isolated browser to get started.'
                : 'No profiles match the current search or filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-tv-border">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[28px_minmax(220px,2fr)_110px_minmax(120px,1fr)_minmax(180px,1.4fr)_190px] items-center gap-3 px-4 py-3 transition-colors duration-tv hover:bg-tv-surface-subtle"
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${p.name}`}
                  checked={selected.includes(p.id)}
                  onChange={() => toggleSelected(p.id)}
                  className="size-4 accent-tv-red"
                />
                <div className="flex min-w-0 items-center gap-3">
                  <ProfileAvatar profile={p} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      {p.pinnedTag && (
                        <Badge variant="primary" className="shrink-0 font-normal">
                          {p.pinnedTag}
                        </Badge>
                      )}
                      {p.folder && (
                        <span className="truncate rounded-tv-pill border border-tv-border-strong px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-tv-ink-subtle">
                          {p.folder}
                        </span>
                      )}
                      {(p.tags ?? []).length > 0 && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {(p.tags ?? []).join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className="data-mono truncate text-muted-foreground/70">
                      {p.useragent || 'engine default UA'}
                    </div>
                  </div>
                </div>
                <div>
                  {p.launched ? (
                    <Badge variant="primary" className="gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-block size-1.5 rounded-full bg-white"
                      />
                      Running
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal text-tv-ink-subtle">
                      Stopped
                    </Badge>
                  )}
                </div>
                <div className="min-w-0 truncate text-sm text-muted-foreground">
                  {proxyLabel(p.proxyId)}
                </div>
                <div className="data-mono min-w-0 truncate text-muted-foreground/80">
                  {p.width && p.height ? `${p.width}×${p.height}` : 'native'}
                  {p.humanize ? ` · ${p.humanPreset === 'careful' ? 'careful' : 'human'}` : ''}
                  {p.geoip ? ' · geoip' : ''}
                  {p.browserVersion ? ` · v${p.browserVersion.split('.')[0]}` : ''}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {p.launched ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => void stopProfile(p)}
                    >
                      <Square className="mr-1 h-3.5 w-3.5" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => void runProfileAction(p, 'launch')}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" />
                      Launch
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => setEditProfile(p)}
                  >
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        aria-label={`More actions for ${p.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={busyCheck !== null}
                        onSelect={() => void duplicateProfile(p)}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busyCheck !== null}
                        onSelect={() => void runProfileAction(p, 'one-time')}
                      >
                        Launch one-time
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busyCheck !== null}
                        onSelect={() => void runProfileAction(p, 'check')}
                      >
                        {busyCheck === p.id ? 'Checking fingerprint…' : 'Fingerprint check'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busyCheck !== null}
                        onSelect={() =>
                          void ipc.exportProfilesToFile([p.id]).then((path) => {
                            if (path) window.alert(`Exported profile to ${path}`)
                          })
                        }
                      >
                        Export profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={busyCheck !== null}
                        onSelect={() => void deleteProfile(p)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={passwordAction !== null}
        onOpenChange={(open) => {
          if (!open && !passwordBusy) {
            setPasswordAction(null)
            setActionPassword('')
            setPasswordError('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock {passwordAction?.profile.name}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="action-password">Profile password</Label>
          <Input
            id="action-password"
            type="password"
            autoComplete="current-password"
            value={actionPassword}
            onChange={(e) => setActionPassword(e.target.value)}
          />
          {passwordError && (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={passwordBusy}
              onClick={() => {
                setPasswordAction(null)
                setActionPassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={passwordBusy}
              onClick={() => {
                if (passwordAction)
                  void runProfileAction(
                    passwordAction.profile,
                    passwordAction.action,
                    actionPassword
                  )
              }}
            >
              {passwordBusy ? 'Working…' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Bulk create from config</DialogTitle>
          </DialogHeader>
          {configsError && (
            <p role="alert" className="text-sm text-destructive">
              Configs unavailable: {configsError}
            </p>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-config">Config / template</Label>
              <select
                id="bulk-config"
                className="h-[3rem] w-full rounded-tv-control border border-tv-border-strong bg-white px-3 text-sm text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                value={bulkConfigId}
                disabled={Boolean(configsError)}
                onChange={(e) => setBulkConfigId(e.target.value)}
              >
                <option value="">Choose a config…</option>
                {configs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-count">Count</Label>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-prefix">Name prefix</Label>
              <Input
                id="bulk-prefix"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                placeholder="AD"
              />
              <p className="text-xs text-muted-foreground">
                Profiles are named <span className="font-mono">AD 1…AD N</span>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button disabled={bulkBusy || Boolean(configsError)} onClick={() => void submitBulk()}>
              {bulkBusy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
