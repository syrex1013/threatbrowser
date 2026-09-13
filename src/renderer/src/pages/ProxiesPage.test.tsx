import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'

import { ProxiesPage } from '@/pages/ProxiesPage'

afterEach(() => cleanup())

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
      deleteProxy: vi.fn(async () => undefined),
      proxySources: vi.fn(async () => []),
      scrapeProxies: vi.fn(async () => ({ proxies: [], failures: [] })),
      checkProxies: vi.fn(async () => [])
    }
  }
})

describe('ProxiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scrapes sources and imports results into the pool', async () => {
    const user = userEvent.setup()
    const { ipc } = await import('@/lib/ipc')
    vi.mocked(ipc.proxySources).mockResolvedValueOnce([
      { name: 'src-a', protocol: 'http' },
      { name: 'src-b', protocol: 'socks5' }
    ])
    vi.mocked(ipc.scrapeProxies).mockResolvedValueOnce({
      proxies: [
        { host: '1.1.1.1', port: 8080, protocol: 'http', source: 'src-a' },
        { host: '2.2.2.2', port: 1080, protocol: 'socks5', source: 'src-b' }
      ],
      failures: []
    })

    render(
      <HashRouter>
        <ProxiesPage />
      </HashRouter>
    )

    await user.click(await screen.findByRole('button', { name: /Scrape \(2\)/ }))
    expect(ipc.scrapeProxies).toHaveBeenCalledWith(['src-a', 'src-b'])
    await user.click(await screen.findByRole('button', { name: 'Import 2 into pool' }))
    expect(ipc.createProxy).toHaveBeenCalledWith('http://1.1.1.1:8080')
    expect(ipc.createProxy).toHaveBeenCalledWith('socks5://2.2.2.2:1080')
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
