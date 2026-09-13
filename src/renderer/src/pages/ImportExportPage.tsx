import { useState } from 'react'
import { motion } from 'framer-motion'
import { ipc } from '@/lib/ipc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ImportExportPage(): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function exportAll(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const path = await ipc.exportProfilesToFile([])
      setMessage(path ? `Exported all profiles to ${path}` : 'Export cancelled')
    } finally {
      setBusy(false)
    }
  }

  async function importFile(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await ipc.importProfilesFromFile()
      if (!result) {
        setMessage('Import cancelled')
        return
      }
      const skipped = result.skipped.length
        ? `\nSkipped (id exists): ${result.skipped.join('; ')}`
        : ''
      setMessage(`Imported ${result.imported} profile(s) from ${result.path}${skipped}`)
    } catch (error) {
      setMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="space-y-1">
        <div className="font-display text-xl font-extrabold tracking-tight">Import / Export</div>
        <div className="text-sm text-muted-foreground">
          Move profile settings and cookies between machines. Existing profile ids are never
          overwritten on import — collisions are skipped, not replaced.
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-tv-border py-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void exportAll()}>
              Export all profiles
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => void importFile()}>
              Import from file
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Bundle format: {'{ version: 1, profiles: Profile[] }'}. Cookies stored in a profile
            travel inside the bundle; cache, history and loaded extensions stay on the source
            machine.
          </div>
          {message && (
            <pre className="whitespace-pre-wrap rounded-tv-control border border-tv-border bg-tv-surface-subtle p-3 text-xs text-tv-ink">
              {message}
            </pre>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
