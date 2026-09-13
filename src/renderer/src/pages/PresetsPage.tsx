import { useState } from 'react'
import { motion } from 'framer-motion'
import { PROFILE_TEMPLATES } from '@/lib/presets'
import { ipc } from '@/lib/ipc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '../../../shared/profileSettings'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PresetsPage(): React.JSX.Element {
  const [created, setCreated] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)

  async function createFromTemplate(): Promise<void> {
    const template = PROFILE_TEMPLATES.find((t) => t.id === templateId)
    if (!template || !profileName.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const profile: Profile = {
        id: 0,
        name: profileName.trim(),
        useragent: '',
        notes: template.notes ?? '',
        launched: false,
        proxy: '',
        width: template.width,
        height: template.height,
        humanize: template.humanize ?? false,
        humanPreset: template.humanPreset ?? 'default',
        tags: template.tags ?? []
      }
      const saved = await ipc.createProfile(profile)
      setCreated(template.id)
      setCreatedId(saved.id)
      setTemplateId(null)
      window.setTimeout(() => setCreated(null), 2500)
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="space-y-1">
        <div className="font-display text-xl font-extrabold tracking-tight">
          Fingerprint presets
        </div>
        <div className="text-sm text-muted-foreground">
          Start new profiles from curated templates. The stealth engine keeps OS, GPU, canvas and
          font identity of its host binary; templates tune window geometry, humanization and
          organization only.
        </div>
      </div>
      {createdId !== null && (
        <p role="status" className="text-sm">
          Created profile {createdId}.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILE_TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="flex-1 text-sm text-muted-foreground">{template.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {template.width && template.height ? (
                  <Badge variant="outline">
                    {template.width}×{template.height}
                  </Badge>
                ) : (
                  <Badge variant="outline">Native window</Badge>
                )}
                <Badge variant="outline">
                  {template.humanPreset === 'careful' ? 'Careful' : 'Default'} timing
                </Badge>
                <Badge variant="outline">{template.humanize ? 'Humanized' : 'Fast'}</Badge>
              </div>
              <Button
                variant={created === template.id ? 'secondary' : 'default'}
                onClick={() => {
                  setTemplateId(template.id)
                  setProfileName(template.name)
                  setError('')
                }}
              >
                {created === template.id ? 'Created ✓' : 'New profile from template'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog
        open={templateId !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setTemplateId(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New profile from template</DialogTitle>
          </DialogHeader>
          <Label htmlFor="preset-profile-name">Profile name</Label>
          <Input
            id="preset-profile-name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setTemplateId(null)}>
              Cancel
            </Button>
            <Button
              disabled={creating || !profileName.trim()}
              onClick={() => void createFromTemplate()}
            >
              {creating ? 'Creating…' : 'Create profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
