import { useEffect, useMemo, useState } from 'react'

import type { Profile, ProxyData } from '../../types/types'
import { ipc } from '../../lib/ipc'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  profile: Profile | null
  proxies: ProxyData[]
  onSubmit: (profile: Profile) => Promise<void>
}

function parseNumberOrUndefined(v: string): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function ProfileFormDialog({
  open,
  onOpenChange,
  mode,
  profile,
  proxies,
  onSubmit
}: Props): React.JSX.Element {
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(profile?.name ?? '')
  const [useragent, setUseragent] = useState(profile?.useragent ?? '')
  const [notes, setNotes] = useState(profile?.notes ?? '')
  const [startUrl, setStartUrl] = useState(profile?.startUrl ?? '')
  const [proxyId, setProxyId] = useState<number | undefined>(profile?.proxyId)
  const [proxyUrlOverride, setProxyUrlOverride] = useState(profile?.proxy ?? '')
  const [cookiesInput, setCookiesInput] = useState(profile?.cookies ?? '')
  const [cookiesFormat, setCookiesFormat] = useState<'json' | 'netscape'>('json')

  const [timezone, setTimezone] = useState(profile?.fingerprint?.timezone ?? '')
  const [locale, setLocale] = useState(profile?.fingerprint?.locale ?? '')
  const [languages, setLanguages] = useState((profile?.fingerprint?.languages ?? []).join(','))
  const [platform, setPlatform] = useState(profile?.fingerprint?.platform ?? '')
  const [hardwareConcurrency, setHardwareConcurrency] = useState(
    profile?.fingerprint?.hardwareConcurrency?.toString() ?? ''
  )
  const [deviceMemory, setDeviceMemory] = useState(
    profile?.fingerprint?.deviceMemory?.toString() ?? ''
  )
  const [viewportWidth, setViewportWidth] = useState(
    profile?.fingerprint?.viewport?.width?.toString() ?? ''
  )
  const [viewportHeight, setViewportHeight] = useState(
    profile?.fingerprint?.viewport?.height?.toString() ?? ''
  )
  const [geoLat, setGeoLat] = useState(
    profile?.fingerprint?.geolocation?.latitude?.toString() ?? ''
  )
  const [geoLng, setGeoLng] = useState(
    profile?.fingerprint?.geolocation?.longitude?.toString() ?? ''
  )
  const [webrtcDisable, setWebrtcDisable] = useState(
    profile?.fingerprint?.webrtc?.mode === 'disable'
  )
  const [webglVendor, setWebglVendor] = useState(profile?.fingerprint?.webgl?.vendor ?? '')
  const [webglRenderer, setWebglRenderer] = useState(profile?.fingerprint?.webgl?.renderer ?? '')

  useEffect(() => {
    if (!open) return
    // reset to the latest initial profile when opening
    setName(profile?.name ?? '')
    setUseragent(profile?.useragent ?? '')
    setNotes(profile?.notes ?? '')
    setStartUrl(profile?.startUrl ?? '')
    setProxyId(profile?.proxyId)
    setProxyUrlOverride(profile?.proxy ?? '')
    setCookiesInput(profile?.cookies ?? '')
    setTimezone(profile?.fingerprint?.timezone ?? '')
    setLocale(profile?.fingerprint?.locale ?? '')
    setLanguages((profile?.fingerprint?.languages ?? []).join(','))
    setPlatform(profile?.fingerprint?.platform ?? '')
    setHardwareConcurrency(profile?.fingerprint?.hardwareConcurrency?.toString() ?? '')
    setDeviceMemory(profile?.fingerprint?.deviceMemory?.toString() ?? '')
    setViewportWidth(profile?.fingerprint?.viewport?.width?.toString() ?? '')
    setViewportHeight(profile?.fingerprint?.viewport?.height?.toString() ?? '')
    setGeoLat(profile?.fingerprint?.geolocation?.latitude?.toString() ?? '')
    setGeoLng(profile?.fingerprint?.geolocation?.longitude?.toString() ?? '')
    setWebrtcDisable(profile?.fingerprint?.webrtc?.mode === 'disable')
    setWebglVendor(profile?.fingerprint?.webgl?.vendor ?? '')
    setWebglRenderer(profile?.fingerprint?.webgl?.renderer ?? '')
  }, [open, profile])

  const selectedProxy = useMemo(() => proxies.find((p) => p.id === proxyId), [proxies, proxyId])

  async function save(): Promise<void> {
    if (!name.trim()) return
    if (!useragent.trim()) return

    setSaving(true)
    try {
      const normalizedLanguages = languages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const vpW = parseNumberOrUndefined(viewportWidth)
      const vpH = parseNumberOrUndefined(viewportHeight)
      const lat = parseNumberOrUndefined(geoLat)
      const lng = parseNumberOrUndefined(geoLng)

      const cookiesJson = cookiesInput.trim()
        ? await ipc.cookiesImport({ contents: cookiesInput.trim(), format: cookiesFormat })
        : undefined

      const nextProfile: Profile = {
        id: profile?.id ?? Date.now(),
        name: name.trim(),
        useragent: useragent.trim(),
        notes,
        launched: profile?.launched ?? false,
        proxyId,
        proxy:
          proxyUrlOverride.trim() ||
          (selectedProxy
            ? `${selectedProxy.protocol}://${selectedProxy.username}:${selectedProxy.password}@${selectedProxy.host}:${selectedProxy.port}`
            : ''),
        cookies: cookiesJson,
        startUrl: startUrl.trim() || undefined,
        fingerprint: {
          timezone: timezone.trim() || undefined,
          locale: locale.trim() || undefined,
          languages: normalizedLanguages.length ? normalizedLanguages : undefined,
          platform: platform.trim() || undefined,
          hardwareConcurrency: parseNumberOrUndefined(hardwareConcurrency),
          deviceMemory: parseNumberOrUndefined(deviceMemory),
          viewport: vpW && vpH ? { width: vpW, height: vpH } : undefined,
          geolocation:
            lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : undefined,
          webrtc: { mode: webrtcDisable ? 'disable' : 'default' },
          webgl:
            webglVendor || webglRenderer
              ? { vendor: webglVendor || undefined, renderer: webglRenderer || undefined }
              : undefined
        }
      }

      if (mode === 'edit') await ipc.editProfile(nextProfile)
      else await ipc.createProfile(nextProfile)

      await onSubmit(nextProfile)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit profile' : 'New profile'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Profile name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-ua">User agent</Label>
              <Input
                id="profile-ua"
                value={useragent}
                onChange={(e) => setUseragent(e.target.value)}
                placeholder="UA string"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-start">Start URL (optional)</Label>
              <Input
                id="profile-start"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-notes">Notes</Label>
              <Textarea
                id="profile-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes…"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cookies import</Label>
                <Badge variant="outline">JSON or Netscape</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={cookiesFormat === 'json' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setCookiesFormat('json')}
                >
                  JSON
                </Button>
                <Button
                  type="button"
                  variant={cookiesFormat === 'netscape' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setCookiesFormat('netscape')}
                >
                  Netscape
                </Button>
              </div>
              <Textarea
                value={cookiesInput}
                onChange={(e) => setCookiesInput(e.target.value)}
                placeholder="Paste cookies contents here…"
                className="min-h-28 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Europe/Berlin"
              />
            </div>
            <div className="space-y-2">
              <Label>Locale</Label>
              <Input
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                placeholder="e.g. en-US"
              />
            </div>
            <div className="space-y-2">
              <Label>Languages</Label>
              <Input
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="e.g. en-US,en"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Viewport width</Label>
                <Input
                  value={viewportWidth}
                  onChange={(e) => setViewportWidth(e.target.value)}
                  placeholder="1365"
                />
              </div>
              <div className="space-y-2">
                <Label>Viewport height</Label>
                <Input
                  value={viewportHeight}
                  onChange={(e) => setViewportHeight(e.target.value)}
                  placeholder="768"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Geolocation lat</Label>
                <Input
                  value={geoLat}
                  onChange={(e) => setGeoLat(e.target.value)}
                  placeholder="52.52"
                />
              </div>
              <div className="space-y-2">
                <Label>Geolocation lng</Label>
                <Input
                  value={geoLng}
                  onChange={(e) => setGeoLng(e.target.value)}
                  placeholder="13.405"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="Win32"
                />
              </div>
              <div className="space-y-2">
                <Label>Hardware concurrency</Label>
                <Input
                  value={hardwareConcurrency}
                  onChange={(e) => setHardwareConcurrency(e.target.value)}
                  placeholder="8"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Device memory (GB)</Label>
                <Input
                  value={deviceMemory}
                  onChange={(e) => setDeviceMemory(e.target.value)}
                  placeholder="8"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant={webrtcDisable ? 'destructive' : 'outline'}
                  onClick={() => setWebrtcDisable((v) => !v)}
                >
                  WebRTC {webrtcDisable ? 'Disabled' : 'Default'}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>WebGL vendor</Label>
                <Input
                  value={webglVendor}
                  onChange={(e) => setWebglVendor(e.target.value)}
                  placeholder="Google Inc."
                />
              </div>
              <div className="space-y-2">
                <Label>WebGL renderer</Label>
                <Input
                  value={webglRenderer}
                  onChange={(e) => setWebglRenderer(e.target.value)}
                  placeholder="ANGLE (…)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Proxy</Label>
              <Input
                value={proxyUrlOverride}
                onChange={(e) => setProxyUrlOverride(e.target.value)}
                placeholder="protocol://username:password@ip:port (optional override)"
              />
              <div className="text-xs text-muted-foreground">
                If set, this overrides the selected proxy id.
              </div>
              <div className="flex flex-wrap gap-2">
                {proxies.slice(0, 6).map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={p.id === proxyId ? 'secondary' : 'outline'}
                    onClick={() => setProxyId(p.id)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
