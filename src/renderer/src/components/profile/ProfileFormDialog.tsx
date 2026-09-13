import { useEffect, useMemo, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import { RESOLUTIONS } from '@/lib/presets'
import type { ProxyData } from '@/types/types'
import {
  applyConfigToProfile,
  profileToConfig,
  type Profile,
  type ProfileConfig
} from '../../../../shared/profileSettings'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  profile: Profile | null
  proxies: ProxyData[]
  configs: ProfileConfig[]
  configsError?: string
  onConfigsChanged?: () => Promise<void>
  onSubmit: (profile: Profile) => Promise<void>
}

/** Premade Apple GPU identities — verified engine override flags. */
const GPU_PRESETS = ['M1', 'M2', 'M2 Pro', 'M3', 'M3 Max', 'M4', 'M4 Pro'] as const
const CORE_PRESETS = ['8', '10', '12', '14', '16']

function rendererForChip(chip: string): string {
  return `ANGLE (Apple, ANGLE Metal Renderer: Apple ${chip}, Unspecified Version)`
}

function chipFromRenderer(renderer: string | undefined): string | null {
  if (!renderer) return null
  const match = renderer.match(/ANGLE \(Apple, ANGLE Metal Renderer: Apple ([^,]+),/)
  return match ? match[1] : null
}

function settingsState(config: Omit<ProfileConfig, 'id'>): Record<string, unknown> {
  const knownChip = chipFromRenderer(config.gpuRenderer)
  const presetChip =
    knownChip &&
    (GPU_PRESETS as readonly string[]).includes(knownChip) &&
    rendererForChip(knownChip) === config.gpuRenderer
      ? knownChip
      : null
  const cores = config.cores === undefined ? '' : String(config.cores)
  return {
    config,
    useragent: config.useragent ?? '',
    startPages: (config.startPages ?? []).join('\n'),
    folder: config.folder ?? '',
    timezone: config.timezone,
    locale: config.locale,
    browserVersion: config.browserVersion,
    extensionsText: config.extensions.join('\n'),
    humanize: config.humanize,
    geoip: config.geoip,
    humanPreset: config.humanPreset,
    width: config.width,
    height: config.height,
    extraArgsText: config.extraArgs.join('\n'),
    geoLat: config.geolocation?.latitude.toString() ?? '',
    geoLng: config.geolocation?.longitude.toString() ?? '',
    webrtcMode: config.webrtcMode,
    gpuChoice: presetChip ?? (config.gpuRenderer || config.gpuVendor ? 'custom' : 'native'),
    gpuCustom: presetChip ? '' : (config.gpuRenderer ?? ''),
    coresChoice: cores ? (CORE_PRESETS.includes(cores) ? cores : 'custom') : 'native',
    coresCustom: cores && !CORE_PRESETS.includes(cores) ? cores : ''
  }
}

function initial(profile: Profile | null): Record<string, unknown> {
  const source: Profile = profile ?? {
    id: 0,
    name: '',
    useragent: '',
    notes: '',
    proxy: '',
    launched: false
  }
  return {
    ...settingsState(profileToConfig(source, '')),
    name: source.name,
    notes: source.notes,
    pinnedTag: source.pinnedTag ?? '',
    password: '',
    proxyId: source.proxyId,
    proxyUrlOverride: source.proxy,
    cookiesInput: source.cookies ?? '',
    tagsText: (source.tags ?? []).join(', '),
    seed: source.seed
  }
}

function configFromState(state: Record<string, unknown>): ProfileConfig {
  const config = state.config as Omit<ProfileConfig, 'id'>
  const latitude = (state.geoLat as string).trim()
  const longitude = (state.geoLng as string).trim()
  if (Boolean(latitude) !== Boolean(longitude)) {
    throw new Error('Latitude and longitude must be entered together')
  }
  const geolocation =
    latitude && longitude
      ? { ...config.geolocation, latitude: Number(latitude), longitude: Number(longitude) }
      : undefined
  if (
    geolocation &&
    (!Number.isFinite(geolocation.latitude) || !Number.isFinite(geolocation.longitude))
  ) {
    throw new Error('Latitude and longitude must be finite numbers')
  }
  const gpuChoice = state.gpuChoice as string
  const gpuRenderer =
    gpuChoice === 'native'
      ? undefined
      : gpuChoice === 'custom'
        ? (state.gpuCustom as string).trim() || undefined
        : rendererForChip(gpuChoice)
  const coresChoice = state.coresChoice as string
  const coresText = coresChoice === 'custom' ? (state.coresCustom as string).trim() : coresChoice
  const cores = coresChoice === 'native' ? undefined : Number(coresText)
  if (cores !== undefined && (!coresText || !Number.isInteger(cores))) {
    throw new Error('Cores must be a whole number')
  }
  return {
    ...config,
    id: 0,
    useragent: (state.useragent as string).trim(),
    humanize: Boolean(state.humanize),
    humanPreset: state.humanPreset === 'careful' ? 'careful' : 'default',
    geoip: Boolean(state.geoip),
    timezone: (state.timezone as string).trim(),
    locale: (state.locale as string).trim(),
    width: state.width as number | undefined,
    height: state.height as number | undefined,
    webrtcMode: state.webrtcMode as ProfileConfig['webrtcMode'],
    gpuRenderer,
    gpuVendor:
      gpuChoice === 'native'
        ? undefined
        : gpuChoice === 'custom' || gpuRenderer === config.gpuRenderer
          ? config.gpuVendor
          : 'Google Inc. (Apple)',
    cores,
    geolocation,
    browserVersion: (state.browserVersion as string).trim(),
    startPages: (state.startPages as string)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    folder: (state.folder as string).trim() || undefined,
    extensions: (state.extensionsText as string)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    extraArgs: (state.extraArgsText as string)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

/** Section eyebrow: small-caps label over a hairline. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {title}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  )
}

function ToggleRow({
  label,
  description,
  active,
  onToggle,
  children
}: {
  label: string
  description: string
  active: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={active ? 'secondary' : 'outline'}
          aria-pressed={active}
          onClick={onToggle}
          className="shrink-0"
        >
          {active ? 'On' : 'Off'}
        </Button>
      </div>
      {children}
    </div>
  )
}

export function ProfileFormDialog({
  open,
  onOpenChange,
  mode,
  profile,
  proxies,
  configs,
  configsError,
  onConfigsChanged,
  onSubmit
}: Props): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [state, setState] = useState<Record<string, unknown>>(() => initial(profile))
  const [cookiesFormat, setCookiesFormat] = useState<'json' | 'netscape' | 'mozilla'>('json')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [configNameOpen, setConfigNameOpen] = useState(false)
  const [configName, setConfigName] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  const patch = (field: string, value: unknown): void => {
    setState((prev) => ({ ...prev, [field]: value }))
  }

  const regenerate = async (): Promise<void> => {
    if (!profile) return
    setRegenerating(true)
    try {
      const updated = await ipc.regenerateFingerprint(profile.id, currentPassword)
      patch('seed', updated.seed)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setRegenerating(false)
    }
  }

  /** Apply a saved config to the current form state. */
  const applyConfig = (config: ProfileConfig): void => {
    const source: Profile = profile ?? {
      id: 0,
      name: '',
      useragent: '',
      notes: '',
      proxy: '',
      launched: false
    }
    const mapped = applyConfigToProfile(source, config)
    setState((prev) => ({ ...prev, ...settingsState(profileToConfig(mapped, '')) }))
  }

  /** Capture the current form state as a named config. */
  const saveAsConfig = async (): Promise<void> => {
    if (!configName.trim() || configsError || configSaving) return
    setConfigSaving(true)
    setError('')
    try {
      const source: Profile = profile ?? {
        id: 0,
        name: '',
        useragent: '',
        notes: '',
        proxy: '',
        launched: false
      }
      const mapped = applyConfigToProfile(source, configFromState(state))
      await ipc.saveConfig({ id: 0, ...profileToConfig(mapped, configName.trim()) })
      setConfigNameOpen(false)
      setConfigName('')
      await onConfigsChanged?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setConfigSaving(false)
    }
  }

  useEffect(() => {
    if (open) {
      setState(initial(profile))
      setCurrentPassword('')
      setError('')
      setConfigNameOpen(false)
    } else {
      setConfigNameOpen(false)
      setCurrentPassword('')
      setState((prev) => ({ ...prev, password: '' }))
    }
  }, [open, profile])

  const selectedProxy = useMemo(
    () => proxies.find((p) => p.id === (state.proxyId as number | undefined)),
    [proxies, state.proxyId]
  )

  async function save(): Promise<void> {
    if (!(state.name as string).trim() || saving || regenerating) return

    setSaving(true)
    setError('')
    try {
      const config = configFromState(state)
      const startPages = config.startPages ?? []
      if (startPages.length > 20) {
        setError('At most 20 start pages are allowed')
        return
      }
      for (const url of startPages) {
        try {
          new URL(url)
        } catch {
          setError(`Start page is not a valid URL: ${url}`)
          return
        }
      }
      const cookiesInput = (state.cookiesInput as string).trim()
      const cookiesJson = cookiesInput
        ? await ipc.cookiesImport({ contents: cookiesInput, format: cookiesFormat })
        : undefined
      const tags = (state.tagsText as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const nextProfile = applyConfigToProfile(
        {
          ...profile,
          id: profile?.id ?? 0,
          name: (state.name as string).trim(),
          useragent: '',
          notes: (state.notes as string) ?? '',
          launched: profile?.launched ?? false,
          proxyId: (state.proxyId as number | undefined) ?? undefined,
          proxy:
            ((state.proxyUrlOverride as string) || '').trim() ||
            (selectedProxy
              ? `${selectedProxy.protocol}://${encodeURIComponent(selectedProxy.username)}:${encodeURIComponent(selectedProxy.password)}@${selectedProxy.host}:${selectedProxy.port}`
              : ''),
          cookies: cookiesJson,
          pinnedTag: ((state.pinnedTag as string) || '').trim() || undefined,
          password: (state.password as string) || undefined,
          tags,
          seed: state.seed as number | undefined
        },
        config
      )
      let saved: Profile
      if (mode === 'edit') {
        await ipc.editProfile(nextProfile, currentPassword)
        saved = {
          ...nextProfile,
          password: undefined,
          hasPassword: Boolean(nextProfile.password) || profile?.hasPassword
        }
      } else {
        saved = await ipc.createProfile(nextProfile)
      }

      await onSubmit(saved)
      onOpenChange(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === 'edit' ? 'Edit profile' : 'New profile'}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-7 overflow-y-auto pr-1">
          {/* Config */}
          <Section title="Config">
            {configsError && (
              <p role="alert" className="text-sm text-destructive">
                {configsError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="profile-config" className="text-sm font-medium">
                Load saved config
              </label>
              <select
                id="profile-config"
                className="h-[3rem] rounded-tv-control border border-tv-border-strong bg-white px-3 text-sm text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                disabled={Boolean(configsError)}
                value=""
                onChange={(e) => {
                  const config = configs.find((c) => String(c.id) === e.target.value)
                  if (config) applyConfig(config)
                }}
              >
                <option value="">Choose a config…</option>
                {configs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="ml-auto"
                disabled={Boolean(configsError) || configSaving}
                onClick={() => setConfigNameOpen(true)}
              >
                Save as config
              </Button>
            </div>
          </Section>

          {/* Identity */}
          <Section title="Identity">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={state.name as string}
                  onChange={(e) => patch('name', e.target.value)}
                  placeholder="Profile name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-tags">Tags (comma separated)</Label>
                <Input
                  id="profile-tags"
                  value={state.tagsText as string}
                  onChange={(e) => patch('tagsText', e.target.value)}
                  placeholder="facebook, work, client-a"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-ua">User agent</Label>
                <Input
                  id="profile-ua"
                  className="font-mono text-xs"
                  value={state.useragent as string}
                  onChange={(e) => patch('useragent', e.target.value)}
                  placeholder="Leave empty for the engine's own consistent UA"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="profile-start">Start pages (one URL per line)</Label>
                <Textarea
                  id="profile-start"
                  value={state.startPages as string}
                  onChange={(e) => patch('startPages', e.target.value)}
                  placeholder={'https://example.com\nhttps://example.org'}
                  className="min-h-16 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Each line opens as its own tab at launch. At most 20 URLs.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-notes">Notes</Label>
                <Input
                  id="profile-notes"
                  value={state.notes as string}
                  onChange={(e) => patch('notes', e.target.value)}
                  placeholder="Internal notes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-folder">Folder</Label>
                <Input
                  id="profile-folder"
                  value={state.folder as string}
                  onChange={(e) => patch('folder', e.target.value)}
                  placeholder="Work"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-pinned">Pinned tag</Label>
                <select
                  id="profile-pinned"
                  className="h-[3rem] w-full rounded-tv-control border border-tv-border-strong bg-white px-3 text-sm text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  value={state.pinnedTag as string}
                  onChange={(e) => patch('pinnedTag', e.target.value)}
                >
                  <option value="">None</option>
                  {(state.tagsText as string)
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  One tag shown as a filled badge; pick from the tags you entered.
                </p>
              </div>
              {mode === 'edit' && (
                <div className="space-y-2">
                  <Label htmlFor="profile-current-password">Current password</Label>
                  <Input
                    id="profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Required for protected edits and regeneration"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="profile-password">
                  {mode === 'edit' ? 'Replacement password (optional)' : 'Profile password'}
                </Label>
                <Input
                  id="profile-password"
                  type="password"
                  value={state.password as string}
                  onChange={(e) => patch('password', e.target.value)}
                  placeholder={
                    profile?.hasPassword
                      ? 'Leave blank to keep current'
                      : 'Gates launch and editing'
                  }
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Gates launch and editing. Does not encrypt the profile folder on disk.
                </p>
              </div>
            </div>
          </Section>

          {/* Stealth engine */}
          <Section title="Stealth engine">
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                label="Humanize"
                description="Natural mouse curves, typing cadence and scroll physics."
                active={Boolean(state.humanize)}
                onToggle={() => patch('humanize', !state.humanize)}
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={state.humanPreset !== 'careful' ? 'secondary' : 'outline'}
                    onClick={() => patch('humanPreset', 'default')}
                  >
                    Default timing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={state.humanPreset === 'careful' ? 'secondary' : 'outline'}
                    onClick={() => patch('humanPreset', 'careful')}
                  >
                    Careful timing
                  </Button>
                </div>
              </ToggleRow>
              <ToggleRow
                label="GeoIP alignment"
                description="Match timezone and locale to the egress IP geography (proxy or direct)."
                active={Boolean(state.geoip)}
                onToggle={() => patch('geoip', !state.geoip)}
              />
              <div className="space-y-2">
                <Label>Window resolution</Label>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTIONS.map((r) => {
                    const active =
                      r.width === undefined
                        ? state.width === undefined && state.height === undefined
                        : state.width === r.width && state.height === r.height
                    return (
                      <Button
                        key={r.label}
                        type="button"
                        size="sm"
                        variant={active ? 'secondary' : 'outline'}
                        onClick={() => {
                          patch('width', r.width)
                          patch('height', r.height)
                        }}
                      >
                        {r.label}
                      </Button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sizes the real window so outer and screen metrics stay coherent.
                </p>
              </div>
              <div className="space-y-2">
                <Label>WebRTC</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['default', 'Default'],
                      ['proxyOnly', 'Proxy-only'],
                      ['disable', 'Disabled'],
                      ['ip', 'Proxy IP'],
                      ['real', 'Real']
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={state.webrtcMode === value ? 'secondary' : 'outline'}
                      onClick={() => patch('webrtcMode', value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Proxy-only keeps WebRTC on the exit IP; Proxy IP spoofs the public IP to the proxy
                  exit (requires a proxy); Disabled blocks host candidates; Real exposes the true
                  host.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-timezone">Timezone</Label>
                <Input
                  id="profile-timezone"
                  value={state.timezone as string}
                  onChange={(e) => patch('timezone', e.target.value)}
                  placeholder="Europe/Berlin (empty = GeoIP)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-locale">Locale</Label>
                <Input
                  id="profile-locale"
                  value={state.locale as string}
                  onChange={(e) => patch('locale', e.target.value)}
                  placeholder="en-US (empty = GeoIP)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-geo-lat">Geolocation lat</Label>
                <Input
                  id="profile-geo-lat"
                  value={state.geoLat as string}
                  onChange={(e) => patch('geoLat', e.target.value)}
                  placeholder="52.52"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-geo-lng">Geolocation lng</Label>
                <Input
                  id="profile-geo-lng"
                  value={state.geoLng as string}
                  onChange={(e) => patch('geoLng', e.target.value)}
                  placeholder="13.405"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-browser-version">Browser version pin (optional)</Label>
                <Input
                  id="profile-browser-version"
                  className="font-mono text-xs"
                  value={state.browserVersion as string}
                  onChange={(e) => patch('browserVersion', e.target.value)}
                  placeholder="151.0.7922.108.3"
                />
              </div>
              {mode === 'edit' && (
                <div className="space-y-2">
                  <Label>Fingerprint seed</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={String(state.seed ?? '')}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={regenerating || saving}
                      onClick={() => void regenerate()}
                    >
                      {regenerating ? 'Regenerating…' : 'Regenerate'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pins canvas/WebGL/audio noise across launches. Requires the profile to be
                    stopped.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Advanced hardware */}
          <Section title="Advanced hardware">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-gpu">GPU renderer</Label>
                <select
                  id="profile-gpu"
                  className="h-[3rem] w-full rounded-tv-control border border-tv-border-strong bg-white px-3 text-sm text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  value={state.gpuChoice as string}
                  onChange={(e) => patch('gpuChoice', e.target.value)}
                >
                  <option value="native">Native engine default</option>
                  {GPU_PRESETS.map((chip) => (
                    <option key={chip} value={chip}>
                      Apple {chip}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {(state.gpuChoice as string) === 'custom' && (
                  <Input
                    className="font-mono text-xs"
                    value={state.gpuCustom as string}
                    onChange={(e) => patch('gpuCustom', e.target.value)}
                    placeholder="ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)"
                    aria-label="Custom GPU renderer string"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Premade identities are coherent chip strings; custom accepts any renderer.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-cores">CPU cores</Label>
                <select
                  id="profile-cores"
                  className="h-[3rem] w-full rounded-tv-control border border-tv-border-strong bg-white px-3 text-sm text-tv-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  value={state.coresChoice as string}
                  onChange={(e) => patch('coresChoice', e.target.value)}
                >
                  <option value="native">Native (this machine)</option>
                  {CORE_PRESETS.map((n) => (
                    <option key={n} value={n}>
                      {n} cores
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {(state.coresChoice as string) === 'custom' && (
                  <Input
                    className="font-mono text-xs"
                    inputMode="numeric"
                    value={state.coresCustom as string}
                    onChange={(e) => patch('coresCustom', e.target.value)}
                    placeholder="12"
                    aria-label="Custom core count"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Match the cores the chosen GPU chip ships with to stay coherent.
                </p>
              </div>
            </div>
          </Section>

          {/* Network */}
          <Section title="Network">
            <div className="space-y-2">
              <Label htmlFor="profile-proxy">Proxy</Label>
              <Input
                id="profile-proxy"
                className="font-mono text-xs"
                value={state.proxyUrlOverride as string}
                onChange={(e) => patch('proxyUrlOverride', e.target.value)}
                placeholder="protocol://username:password@ip:port (overrides the saved proxy)"
              />
              {proxies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {proxies.slice(0, 8).map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={
                        p.id === (state.proxyId as number | undefined) ? 'secondary' : 'outline'
                      }
                      onClick={() => patch('proxyId', p.id)}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Advanced */}
          <Section title="Advanced">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-extensions">Extension folders (one path per line)</Label>
                <Textarea
                  id="profile-extensions"
                  value={state.extensionsText as string}
                  onChange={(e) => patch('extensionsText', e.target.value)}
                  placeholder={'/path/to/extension-1\n/path/to/extension-2'}
                  className="min-h-20 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Folders must contain a manifest.json; invalid paths are skipped at launch.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-extra-args">Extra Chromium flags (one per line)</Label>
                <Textarea
                  id="profile-extra-args"
                  value={state.extraArgsText as string}
                  onChange={(e) => patch('extraArgsText', e.target.value)}
                  placeholder={'--disable-features=SomeFeature'}
                  className="min-h-20 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Passed to the stealth engine launch. A flag here overrides the engine default of
                  the same key.
                </p>
              </div>
            </div>
          </Section>

          {/* Cookies */}
          <Section title="Cookies">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cookiesFormat === 'json' ? 'secondary' : 'outline'}
                  onClick={() => setCookiesFormat('json')}
                >
                  JSON
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cookiesFormat === 'netscape' ? 'secondary' : 'outline'}
                  onClick={() => setCookiesFormat('netscape')}
                >
                  Netscape
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cookiesFormat === 'mozilla' ? 'secondary' : 'outline'}
                  onClick={() => setCookiesFormat('mozilla')}
                >
                  Mozilla
                </Button>
                <span className="text-xs text-muted-foreground">
                  Paste cookie contents to restore a session.
                </span>
              </div>
              <Textarea
                value={state.cookiesInput as string}
                onChange={(e) => patch('cookiesInput', e.target.value)}
                placeholder="Paste cookies contents here…"
                className="min-h-24 font-mono text-xs"
                aria-label="Cookies to import"
              />
            </div>
          </Section>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || regenerating || !(state.name as string).trim()}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <Dialog open={configNameOpen} onOpenChange={setConfigNameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as config</DialogTitle>
          </DialogHeader>
          <Label htmlFor="config-name">Config name</Label>
          <Input
            id="config-name"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigNameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={configSaving || !configName.trim() || Boolean(configsError)}
              onClick={() => void saveAsConfig()}
            >
              {configSaving ? 'Saving…' : 'Save config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
