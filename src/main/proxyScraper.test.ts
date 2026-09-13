import { describe, expect, it, vi } from 'vitest'

vi.mock('../logger/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { parseGeonode, parseLineList, scrapeProxies } from './proxyScraper'

describe('parseLineList', () => {
  it('parses host:port lines and drops garbage', () => {
    const parsed = parseLineList(
      '1.2.3.4:8080\nbad line\n5.6.7.8:99999\n9.9.9.9:1080\r\n:80\nexample.com:3128\n',
      'http',
      'test'
    )
    expect(parsed).toEqual([
      { host: '1.2.3.4', port: 8080, protocol: 'http', source: 'test' },
      { host: '9.9.9.9', port: 1080, protocol: 'http', source: 'test' },
      { host: 'example.com', port: 3128, protocol: 'http', source: 'test' }
    ])
  })

  it('lowercases hosts', () => {
    expect(parseLineList('Example.COM:80\n', 'https', 't')).toEqual([
      { host: 'example.com', port: 80, protocol: 'https', source: 't' }
    ])
  })
})

describe('parseGeonode', () => {
  it('expands protocol lists and skips unknown protocols', () => {
    const payload = {
      data: [
        { ip: '1.1.1.1', port: '8080', protocols: ['http', 'socks5', 'weird'] },
        { ip: '2.2.2.2', port: 99999, protocols: ['http'] },
        { ip: 42, port: 80, protocols: ['http'] },
        'garbage'
      ]
    }
    expect(parseGeonode(payload, 'geonode')).toEqual([
      { host: '1.1.1.1', port: 8080, protocol: 'http', source: 'geonode' },
      { host: '1.1.1.1', port: 8080, protocol: 'socks5', source: 'geonode' }
    ])
  })

  it('returns empty for malformed payloads', () => {
    expect(parseGeonode(null, 'g')).toEqual([])
    expect(parseGeonode({}, 'g')).toEqual([])
    expect(parseGeonode({ data: 'nope' }, 'g')).toEqual([])
  })
})

describe('scrapeProxies', () => {
  it('dedupes across sources and reports per-source failures', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('fail')) throw new Error('boom')
      if (url.includes('geonode')) {
        return JSON.stringify({ data: [{ ip: '1.2.3.4', port: 8080, protocols: ['http'] }] })
      }
      return '1.2.3.4:8080\n5.6.7.8:3128\n'
    })
    const result = await scrapeProxies({
      sources: ['proxyscrape-http', 'proxy-list-download-http', 'geonode'],
      fetchText
    })
    expect(result.proxies).toEqual([
      { host: '1.2.3.4', port: 8080, protocol: 'http', source: 'proxyscrape-http' },
      { host: '5.6.7.8', port: 3128, protocol: 'http', source: 'proxyscrape-http' }
    ])
    expect(result.failures).toEqual([])
  })

  it('keeps going when a source fails', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.includes('proxyscrape')) throw new Error('boom')
      return '9.9.9.9:1080\n'
    })
    const result = await scrapeProxies({
      sources: ['proxyscrape-http', 'thespeedx-socks5'],
      fetchText
    })
    expect(result.proxies).toEqual([
      { host: '9.9.9.9', port: 1080, protocol: 'socks5', source: 'thespeedx-socks5' }
    ])
    expect(result.failures).toEqual([{ source: 'proxyscrape-http', error: 'boom' }])
  })

  it('ignores unknown source names', async () => {
    const fetchText = vi.fn(async () => '')
    const result = await scrapeProxies({ sources: ['nope'], fetchText })
    expect(result).toEqual({ proxies: [], failures: [] })
    expect(fetchText).not.toHaveBeenCalled()
  })
})
