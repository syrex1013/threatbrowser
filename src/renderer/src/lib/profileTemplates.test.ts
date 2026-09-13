import { describe, expect, it } from 'vitest'
import { PROFILE_TEMPLATES } from '@/lib/profileTemplates'

describe('PROFILE_TEMPLATES', () => {
  it('covers all three supported platforms', () => {
    const platforms = new Set(PROFILE_TEMPLATES.map((t) => t.platform))
    expect(platforms.has('windows')).toBe(true)
    expect(platforms.has('macos')).toBe(true)
    expect(platforms.has('linux')).toBe(true)
  })

  it('covers multiple Chromium-family browser identities', () => {
    const uas = PROFILE_TEMPLATES.map((t) => t.useragent ?? '')
    expect(uas.some((ua) => ua.includes('Edg/'))).toBe(true)
    expect(uas.some((ua) => ua.includes('OPR/'))).toBe(true)
    // Firefox/Safari engines are impossible on a Chromium engine.
    expect(uas.some((ua) => /Firefox|FxiOS/.test(ua))).toBe(false)
    expect(uas.some((ua) => /Safari\/\d+.*Version\//.test(ua) && !ua.includes('Chrome'))).toBe(
      false
    )
  })

  it('keeps every UA coherent with its platform token', () => {
    for (const t of PROFILE_TEMPLATES) {
      const ua = t.useragent ?? ''
      if (t.platform === 'windows') {
        expect(ua).toContain('Windows NT')
      } else if (t.platform === 'linux') {
        expect(ua).toContain('X11')
      } else {
        expect(ua).toContain('Macintosh')
      }
      expect(ua).toMatch(/Chrome\/\d+/)
      expect(ua).not.toContain('HeadlessChrome')
    }
  })

  it('uses unique names and stable negative ids', () => {
    const names = new Set(PROFILE_TEMPLATES.map((t) => t.name))
    expect(names.size).toBe(PROFILE_TEMPLATES.length)
    for (const t of PROFILE_TEMPLATES) expect(t.id).toBeLessThan(0)
  })
})
