import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ipc } from '@/lib/ipc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function LogsPage(): React.JSX.Element {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const preRef = useRef<HTMLPreElement>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setLogs(await ipc.logsRead())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [logs])

  async function clear(): Promise<void> {
    if (!window.confirm('Clear the application log file?')) return
    await ipc.logsClear()
    await load()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="font-display text-xl font-extrabold tracking-tight">Logs</div>
          <div className="text-sm text-muted-foreground">
            Main-process log tail (userData/app.log).
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="destructive" disabled={loading} onClick={() => void clear()}>
            Clear
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-tv-border py-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">app.log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
          ) : logs ? (
            <pre
              ref={preRef}
              className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all px-4 py-3 font-mono text-xs leading-relaxed"
            >
              {logs}
            </pre>
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground">Log file is empty.</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
