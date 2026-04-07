import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Logs,
  Network,
  Settings,
  Shield,
  Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import appIcon from '@resources/icon.png'

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
      { to: '/imports', label: 'Import / Export', icon: FolderKanban },
      { to: '/logs', label: 'Logs', icon: Logs }
    ]
  },
  {
    title: 'System',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }]
  }
]

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const location = useLocation()
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="grid h-full grid-cols-[260px_1fr]">
        <aside className="border-r border-border/60 bg-card/40 backdrop-blur">
          <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
            <div className="size-8 overflow-hidden rounded-lg ring-1 ring-border/60 shadow-sm">
              <img
                src={appIcon}
                alt="ThreatBrowser"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">ThreatBrowser</div>
              <div className="text-xs text-muted-foreground">Multi-account workspace</div>
            </div>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => (window.location.hash = '#/')}>
                    Profiles
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => (window.location.hash = '#/proxies')}>
                    Proxies
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => (window.location.hash = '#/campaigns')}>
                    Campaigns
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ScrollArea className="h-[calc(100%-3.5rem)]">
            <nav className="p-2">
              {navGroups.map((group) => (
                <div key={group.title} className="mb-4">
                  <div className="px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
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
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        <main className="min-w-0 overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-border/60 px-4">
            <div className="text-sm text-muted-foreground">Workspace</div>
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
