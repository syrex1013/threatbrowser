import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'

import { ProxiesPage } from '@/pages/ProxiesPage'

vi.mock('@/lib/ipc', () => {
  return {
    ipc: {
      loadProxies: vi.fn(async () => []),
      createProxy: vi.fn(async () => ({
        id: 1,
        name: 'Proxy 1',
        protocol: 'http',
        host: '1.2.3.4',
        port: 8080,
        username: 'u',
        password: 'p',
        status: 'Unchecked',
        country: 'Unknown'
      })),
      getProxyCountry: vi.fn(async () => 'US'),
      testProxy: vi.fn(async () => true),
      editProxy: vi.fn(async () => undefined),
      deleteProxy: vi.fn(async () => undefined)
    }
  }
})

describe('ProxiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders and allows adding bulk proxies', async () => {
    const user = userEvent.setup()

    render(
      <HashRouter>
        <ProxiesPage />
      </HashRouter>
    )

    expect(await screen.findByText('Proxies')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('socks5://user:pass@1.2.3.4:1080')
    await user.type(textarea, 'http://u:p@1.2.3.4:8080')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // We should eventually refresh list; base assertion is that createProxy was called.
    const { ipc } = await import('@/lib/ipc')
    expect(ipc.createProxy).toHaveBeenCalled()
  })
})
