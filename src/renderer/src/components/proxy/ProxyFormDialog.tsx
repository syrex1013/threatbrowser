import { useEffect, useState } from 'react'

import type { ProxyData } from '../../types/types'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proxy: ProxyData | null
  onSubmit: (proxy: ProxyData) => Promise<void>
}

export function ProxyFormDialog({ open, onOpenChange, proxy, onSubmit }: Props): React.JSX.Element {
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(proxy?.name ?? '')
  const [host, setHost] = useState(proxy?.host ?? '')
  const [port, setPort] = useState(proxy?.port?.toString() ?? '')
  const [username, setUsername] = useState(proxy?.username ?? '')
  const [password, setPassword] = useState(proxy?.password ?? '')

  useEffect(() => {
    if (!open) return
    setName(proxy?.name ?? '')
    setHost(proxy?.host ?? '')
    setPort(proxy?.port?.toString() ?? '')
    setUsername(proxy?.username ?? '')
    setPassword(proxy?.password ?? '')
  }, [open, proxy])

  async function save(): Promise<void> {
    if (!proxy) return
    const parsedPort = Number(port)
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) return
    if (!host.trim()) return

    setSaving(true)
    try {
      await onSubmit({
        ...proxy,
        name: name.trim() || proxy.name,
        host: host.trim(),
        port: parsedPort,
        username: username.trim(),
        password: password
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit proxy</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Proxy name"
            />
          </div>
          <div className="space-y-2">
            <Label>Host</Label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="1.2.3.4" />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="1080" />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
