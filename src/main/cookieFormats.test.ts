import { describe, expect, it } from 'vitest'

import {
  cookiesToMozilla,
  cookiesToNetscape,
  parseCookiesJson,
  parseCookiesMozilla,
  parseCookiesNetscape
} from './cookieFormats'

describe('cookieFormats', () => {
  it('parses cookie JSON list (filters invalid)', () => {
    const input = JSON.stringify([
      { name: 'a', value: '1', domain: '.example.com', path: '/', secure: false },
      { name: 'b', value: '2' },
      { no: 'nope' }
    ])
    const parsed = parseCookiesJson(input)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('a')
    expect(parsed[1].name).toBe('b')
  })

  it('roundtrips Netscape format for name/value/domain', () => {
    const cookies = parseCookiesJson(
      JSON.stringify([
        { name: 'sid', value: 'xyz', domain: '.example.com', path: '/', secure: true }
      ])
    )
    const netscape = cookiesToNetscape(cookies)
    const back = parseCookiesNetscape(netscape)
    expect(back).toHaveLength(1)
    expect(back[0].name).toBe('sid')
    expect(back[0].value).toBe('xyz')
    expect(back[0].domain).toBe('.example.com')
  })

  it('roundtrips Mozilla JSON for name/value/domain/path/secure/httpOnly/expires', () => {
    const cookies = parseCookiesJson(
      JSON.stringify([
        {
          name: 'session',
          value: 'abc123',
          domain: '.example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          expires: 1893456000
        }
      ])
    )
    const mozilla = cookiesToMozilla(cookies)
    const back = parseCookiesMozilla(mozilla)
    expect(back).toHaveLength(1)
    expect(back[0].name).toBe('session')
    expect(back[0].value).toBe('abc123')
    expect(back[0].domain).toBe('.example.com')
    expect(back[0].path).toBe('/')
    expect(back[0].secure).toBe(true)
    expect(back[0].httpOnly).toBe(true)
    expect(back[0].expires).toBe(1893456000)
  })
})
