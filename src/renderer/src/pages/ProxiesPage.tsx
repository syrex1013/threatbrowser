import { motion } from 'framer-motion'

export function ProxiesPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Proxies</div>
        <div className="text-sm text-muted-foreground">
          Manage proxies, validate status, and assign to profiles.
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        UI migration in progress.
      </div>
    </motion.div>
  )
}

