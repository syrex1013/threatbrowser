import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Globe, Monitor, Shield, Trash2, UserRound } from 'lucide-react'
import { applyConfigToProfile, type ProfileConfig } from '../../../shared/profileSettings'
import { ipc } from '@/lib/ipc'
import { PROFILE_TEMPLATES, TEMPLATE_UNSUPPORTED_NOTE } from '@/lib/profileTemplates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function ConfigChips({ config }: { config: ProfileConfig }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {config.platform && (
        <Badge variant="default" className="font-normal">
          {config.platform === 'macos'
            ? 'macOS'
            : config.platform === 'windows'
              ? 'Windows'
              : 'Linux'}
        </Badge>
      )}
      {config.humanize && (
        <Badge variant="outline" className="gap-1 font-normal">
          <UserRound className="h-3 w-3" />
          {config.humanPreset === 'careful' ? 'Careful' : 'Human'}
        </Badge>
      )}
      {config.geoip && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Globe className="h-3 w-3" />
          GeoIP
        </Badge>
      )}
      {config.width && config.height && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Monitor className="h-3 w-3" />
          {config.width}×{config.height}
        </Badge>
      )}
      {config.gpuRenderer && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Shield className="h-3 w-3" />
          {config.gpuRenderer.match(/Apple ([^,]+),/)?.[1] ?? 'Custom GPU'}
        </Badge>
      )}
      {config.cores && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Cpu className="h-3 w-3" />
          {config.cores} cores
        </Badge>
      )}
      {config.timezone && (
        <Badge variant="secondary" className="font-normal">
          {config.timezone}
        </Badge>
      )}
      {config.locale && (
        <Badge variant="secondary" className="font-normal">
          {config.locale}
        </Badge>
      )}
      {config.webrtcMode !== 'default' && (
        <Badge variant="secondary" className="font-normal">
          WebRTC {config.webrtcMode === 'disable' ? 'off' : 'proxy'}
        </Badge>
      )}
      {config.browserVersion && (
        <Badge variant="secondary" className="font-normal">
          v{config.browserVersion.split('.')[0]}
        </Badge>
      )}
      {config.extensions.length > 0 && (
        <Badge variant="secondary" className="font-normal">
          {config.extensions.length} ext
        </Badge>
      )}
      {config.extraArgs.length > 0 && (
        <Badge variant="secondary" className="font-normal">
          {config.extraArgs.length} flags
        </Badge>
      )}
    </div>
  )
}

export function ConfigsPage(): React.JSX.Element {
  const [configs, setConfigs] = useState<ProfileConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [newConfig, setNewConfig] = useState<ProfileConfig | null>(null)
  const [profileName, setProfileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setConfigs(await ipc.configsList())
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function newProfileFromConfig(): Promise<void> {
    if (!newConfig || !profileName.trim() || creating) return
    setCreating(true)
    setActionError('')
    try {
      const profile = applyConfigToProfile(
        {
          id: 0,
          name: profileName.trim(),
          useragent: '',
          notes: newConfig.description ?? '',
          proxy: '',
          launched: false
        },
        newConfig
      )
      const saved = await ipc.createProfile(profile)
      setCreated(`Profile "${saved.name}" created (id ${saved.id}).`)
      setNewConfig(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }

  async function remove(config: ProfileConfig): Promise<void> {
    if (!window.confirm(`Delete config "${config.name}"? Profiles keep their own settings.`)) return
    try {
      await ipc.deleteConfig(config.id)
      await load()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Configs</h1>
          <p className="text-sm text-muted-foreground">
            Named option-sets. Load them into any profile from the profile dialog, or start a new
            profile from one.
          </p>
        </div>
      </div>
      {created && (
        <p role="status" className="text-sm">
          {created}
        </p>
      )}
      {actionError && !newConfig && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

      {/* Built-in templates */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-bold">Built-in templates</h2>
          <span className="text-xs text-muted-foreground">
            {PROFILE_TEMPLATES.length} verified identities
          </span>
        </div>
        <div className="overflow-hidden rounded-none border border-tv-border bg-white">
          <div className="divide-y divide-tv-border">
            {PROFILE_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-tv hover:bg-tv-surface-subtle"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">{tpl.name}</span>
                    {tpl.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {tpl.description}
                      </span>
                    )}
                  </div>
                  <ConfigChips config={tpl} />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewConfig(tpl)
                    setProfileName(`${tpl.name} profile`)
                    setActionError('')
                  }}
                >
                  New profile from template
                </Button>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {TEMPLATE_UNSUPPORTED_NOTE}
        </p>
      </div>

      {/* User configs */}
      <div>
        <h2 className="font-display mb-2 text-sm font-bold">Your configs</h2>
        <div className="overflow-hidden rounded-none border border-tv-border bg-white">
          {loading ? (
            <div className="px-4 py-10 text-sm text-muted-foreground">Loading configs…</div>
          ) : loadError ? (
            <div role="alert" className="space-y-2 px-4 py-6 text-sm text-destructive">
              <p>{loadError}</p>
              <Button variant="outline" onClick={() => void load()}>
                Retry loading configs
              </Button>
            </div>
          ) : configs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No configs yet. Open a profile dialog, tune the options, then “Save as config”.
            </div>
          ) : (
            <div className="divide-y divide-tv-border">
              {configs.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-tv hover:bg-tv-surface-subtle"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <ConfigChips config={c} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setNewConfig(c)
                        setProfileName(`${c.name} profile`)
                        setActionError('')
                      }}
                    >
                      New profile from config
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete config ${c.name}`}
                      onClick={() => void remove(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={newConfig !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setNewConfig(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New profile from config</DialogTitle>
          </DialogHeader>
          <Label htmlFor="config-profile-name">Profile name</Label>
          <Input
            id="config-profile-name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setNewConfig(null)}>
              Cancel
            </Button>
            <Button
              disabled={creating || !profileName.trim()}
              onClick={() => void newProfileFromConfig()}
            >
              {creating ? 'Creating…' : 'Create profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
