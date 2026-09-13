import { Navigate, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { ProfilesPage } from './pages/ProfilesPage'
import { ProxiesPage } from './pages/ProxiesPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CookiesToolsPage } from './pages/CookiesToolsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PresetsPage } from './pages/PresetsPage'
import { ImportExportPage } from './pages/ImportExportPage'
import { LogsPage } from './pages/LogsPage'
import { ConfigsPage } from './pages/ConfigsPage'
import { AutomationPage } from './pages/AutomationPage'

export function App(): React.ReactElement {
  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<ProfilesPage />} />
          <Route path="/proxies" element={<ProxiesPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/cookies" element={<CookiesToolsPage />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/configs" element={<ConfigsPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/imports" element={<ImportExportPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  )
}
