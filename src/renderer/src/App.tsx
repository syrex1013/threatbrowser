import { Navigate, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { ProfilesPage } from './pages/ProfilesPage'
import { ProxiesPage } from './pages/ProxiesPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CookiesToolsPage } from './pages/CookiesToolsPage'
import { SettingsPage } from './pages/SettingsPage'

export function App(): React.ReactElement {
  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<ProfilesPage />} />
          <Route path="/proxies" element={<ProxiesPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/cookies" element={<CookiesToolsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  )
}
