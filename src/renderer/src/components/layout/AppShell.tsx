import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Logs,
  Network,
  Settings,
  Shield,
  SlidersHorizontal,
  Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import appIcon from '../../../../../resources/icon.png'

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> }
type NavGroup = { title: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/', label: 'Profiles', icon: LayoutDashboard },
      { to: '/proxies', label: 'Proxies', icon: Network },
      { to: '/campaigns', label: 'Campaigns', icon: Workflow }
    ]
  },
  {
    title: 'Tools',
    items: [
      { to: '/cookies', label: 'Cookies', icon: KeyRound },
      { to: '/presets', label: 'Fingerprint presets', icon: Shield },
      { to: '/configs', label: 'Configs', icon: SlidersHorizontal },
      { to: '/automation', label: 'Automation', icon: Bot },
      { to: '/imports', label: 'Import / Export', icon: FolderKanban },
      { to: '/logs', label: 'Logs', icon: Logs }
    ]
  },
  {
    title: 'System',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }]
  }
]

const activeGroupFor = (pathname: string): string =>
  navGroups.find((g) =>
    g.items.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))
  )?.title ?? 'Workspace'

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const location = useLocation()
  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-foreground">
      <div className="grid h-full grid-cols-[232px_1fr]">
        {/* Console rail */}
        <aside className="flex h-full flex-col border-r border-tv-border bg-white">
          <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-tv-border px-4">
            <div className="size-8 overflow-hidden rounded-tv-control border border-tv-border">
              <img
                src={appIcon}
                alt="ThreatBrowser"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm font-extrabold tracking-tight text-tv-ink">
                ThreatBrowser
              </div>
              <div className="text-[11px] text-tv-ink-subtle">Operator console</div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <nav className="p-2" aria-label="Main navigation">
              {navGroups.map((group) => (
                <div key={group.title} className="mb-5">
                  <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tv-ink-subtle">
                    {group.title}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2.5 rounded-tv-control px-3 py-1.5 text-[13px] font-medium text-tv-ink transition-colors',
                            'hover:bg-tv-surface-muted hover:text-tv-ink',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            isActive &&
                              'bg-tv-red-soft text-tv-red hover:bg-tv-red-soft hover:text-tv-red'
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          <div className="shrink-0 border-t border-tv-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-1.5 rounded-full bg-tv-success"
              />
              <span className="text-[11px] font-medium text-tv-ink-subtle">
                Stealth engine ready
              </span>
            </div>
            <div className="data-mono mt-1 text-tv-ink-subtle/70">cloakbrowser · chromium</div>
          </div>
        </aside>

        {/* Content column */}
        <main className="flex min-w-0 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-tv-border bg-white px-5">
            <div className="font-display text-sm font-bold tracking-wide text-tv-ink-subtle">
              {activeGroupFor(location.pathname)}
            </div>
            <div className="data-mono text-tv-ink-subtle/70">local · no cloud</div>
          </header>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
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
