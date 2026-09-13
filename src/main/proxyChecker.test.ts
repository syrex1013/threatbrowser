// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'

vi.mock('../logger/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))
import {
  checkProxies,
  checkProxy,
  classifyAnonymity,
  createDefaultCheckerDeps,
  type CheckerDeps,
  type ProxyEcho
} from './proxyChecker'

function echo(headers: Record<string, string> = {}, origin = '9.9.9.9'): ProxyEcho {
  return { origin, headers }
}

describe('classifyAnonymity', () => {
  it('flags a leaked client IP as transparent', () => {
    expect(classifyAnonymity(echo({ via: 'proxy' }, '1.2.3.4, 9.9.9.9'), '1.2.3.4')).toBe(
      'transparent'
    )
  })

  it('flags proxy headers without an IP leak as anonymous', () => {
    expect(classifyAnonymity(echo({ 'x-forwarded-for': '9.9.9.9' }), '1.2.3.4')).toBe('anonymous')
    expect(classifyAnonymity(echo({ via: '1.1 proxy' }), '1.2.3.4')).toBe('anonymous')
  })

  it('calls a clean echo elite', () => {
    expect(classifyAnonymity(echo({}, '9.9.9.9'), '1.2.3.4')).toBe('elite')
  })

  it('returns unknown for an empty origin', () => {
    expect(classifyAnonymity(echo({}, ''), '1.2.3.4')).toBe('unknown')
  })
})

describe('checkProxy', () => {
  const target = { protocol: 'http', host: '9.9.9.9', port: 8080 }

  it('measures success with anonymity and country', async () => {
    const deps: CheckerDeps = {
      fetchDirect: async () => echo({}, '1.2.3.4'),
      fetchVia: async () => echo({}, '9.9.9.9'),
      geoLookup: async () => 'US'
    }
    const result = await checkProxy(target, deps)
    expect(result).toMatchObject({
      alive: true,
      anonymity: 'elite',
      country: 'US',
      exitIp: '9.9.9.9'
    })
    expect(typeof result.latencyMs).toBe('number')
  })

  it('marks failures dead with an error', async () => {
    const deps: CheckerDeps = {
      fetchDirect: async () => echo({}, '1.2.3.4'),
      fetchVia: async () => {
        throw new Error('timeout')
      },
      geoLookup: async () => null
    }
    const result = await checkProxy(target, deps)
    expect(result).toMatchObject({
      alive: false,
      anonymity: 'unknown',
      latencyMs: null,
      error: 'timeout'
    })
  })

  it('skips geo lookup on demand', async () => {
    const deps: CheckerDeps = {
      fetchDirect: async () => echo({}, '1.2.3.4'),
      fetchVia: async () => echo({ via: 'x' }, '9.9.9.9'),
      geoLookup: async () => {
        throw new Error('must not be called')
      }
    }
    const result = await checkProxy(target, deps, { skipGeo: true })
    expect(result).toMatchObject({ alive: true, anonymity: 'anonymous', country: null })
  })
})

describe('checkProxies', () => {
  it('checks concurrently and keeps input order', async () => {
    const seen: number[] = []
    const deps: CheckerDeps = {
      fetchDirect: async () => echo({}, '1.2.3.4'),
      fetchVia: async (proxy) => {
        seen.push(proxy.port)
        return echo({}, '9.9.9.9')
      },
      geoLookup: async () => null
    }
    const proxies = [8081, 8082, 8083].map((port) => ({ protocol: 'http', host: 'h', port }))
    const results = await checkProxies(proxies, deps, { concurrency: 3, skipGeo: true })
    expect(results.map((r) => r.proxy.port)).toEqual([8081, 8082, 8083])
    expect(results.every((r) => r.result.alive)).toBe(true)
    expect(seen).toHaveLength(3)
  })

  it('respects the concurrency limit', async () => {
    // Release gate: both workers must overlap before either proceeds, so the
    // peak is deterministic without wall-clock sleeps.
    const gate = Promise.withResolvers<void>()
    let active = 0
    let peak = 0
    const deps: CheckerDeps = {
      fetchDirect: async () => echo({}, '1.2.3.4'),
      fetchVia: async () => {
        active += 1
        peak = Math.max(peak, active)
        if (active === 2) gate.resolve()
        await gate.promise
        active -= 1
        return echo({}, '9.9.9.9')
      },
      geoLookup: async () => null
    }
    const proxies = Array.from({ length: 4 }, (_, i) => ({
      protocol: 'http',
      host: 'h',
      port: 9000 + i
    }))
    const results = await checkProxies(proxies, deps, { concurrency: 2, skipGeo: true })
    expect(peak).toBe(2)
    expect(results).toHaveLength(4)
  })
})

describe('checkProxy against a local echo server', () => {
  let server: http.Server
  let url = ''

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ origin: '127.0.0.1', headers: { host: req.headers.host ?? '' } }))
    })
    const listening = Promise.withResolvers<void>()
    server.listen(0, '127.0.0.1', listening.resolve)
    await listening.promise
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Echo server has no port')
    url = `http://127.0.0.1:${address.port}/echo`
  })

  afterAll(async () => {
    const closed = Promise.withResolvers<void>()
    server.close(() => closed.resolve())
    await closed.promise
  })

  it('fetches and normalizes a real HTTP echo', async () => {
    const deps = createDefaultCheckerDeps()
    const direct = await deps.fetchDirect(url, 5000)
    expect(direct.origin).toBe('127.0.0.1')
    expect(direct.headers.host).toContain('127.0.0.1')
  })
})
