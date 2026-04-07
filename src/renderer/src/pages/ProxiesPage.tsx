import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export function ProxiesPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Proxies</CardTitle>
          <CardDescription>
            Manage proxies, validate status, and assign to profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          UI migration in progress.
        </CardContent>
      </Card>
    </motion.div>
  )
}
