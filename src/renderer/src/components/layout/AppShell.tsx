import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', label: 'Profiles' },
  { to: '/proxies', label: 'Proxies' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/settings', label: 'Settings' }
] as const

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const location = useLocation()
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="grid h-full grid-cols-[260px_1fr]">
        <aside className="border-r border-border/60 bg-card/40 backdrop-blur">
          <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
            <div className="size-8 rounded-lg bg-primary/15" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">ThreatBrowser</div>
              <div className="text-xs text-muted-foreground">Multi-account workspace</div>
            </div>
          </div>

          <nav className="p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground'
                  )
                }
              >
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-border/60 px-4">
            <div className="text-sm text-muted-foreground">Workspace</div>
            <div className="text-xs text-muted-foreground">Electron • Puppeteer</div>
          </header>

          <div className="h-[calc(100%-3.5rem)] min-w-0 overflow-auto p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
