import { describe, expect, it } from 'vitest'

import { cookiesToNetscape, parseCookiesJson, parseCookiesNetscape } from './cookieFormats'

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
})
