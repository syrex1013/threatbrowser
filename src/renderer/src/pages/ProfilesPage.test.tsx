import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'

import { ProfilesPage } from './ProfilesPage'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    loadProfiles: vi.fn(async () => [
      {
        id: 1,
        name: 'P1',
        useragent: 'UA',
        notes: '',
        proxy: '',
        launched: false
      }
    ]),
    loadProxies: vi.fn(async () => []),
    launchProfile: vi.fn(async () => undefined),
    deleteProfile: vi.fn(async () => undefined),
    editProfile: vi.fn(async () => undefined),
    createProfile: vi.fn(async () => undefined),
    onProfileClosed: vi.fn(() => () => undefined)
  }
}))

describe('ProfilesPage', () => {
  it('renders loaded profiles', async () => {
    render(
      <HashRouter>
        <ProfilesPage />
      </HashRouter>
    )

    await waitFor(() => expect(screen.getByText('P1')).toBeInTheDocument())
    expect(screen.getByText('Profiles')).toBeInTheDocument()
  })
})
