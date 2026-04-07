import { motion } from 'framer-motion'

export function SettingsPage(): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-2"
    >
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">Global app preferences (coming soon).</p>
    </motion.div>
  )
}

