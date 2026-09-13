export type Resolution = { label: string; width?: number; height?: number }

export const RESOLUTIONS: Resolution[] = [
  { label: 'Native' },
  { label: '1366 × 768', width: 1366, height: 768 },
  { label: '1440 × 900', width: 1440, height: 900 },
  { label: '1536 × 864', width: 1536, height: 864 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '2560 × 1440', width: 2560, height: 1440 }
]

export type ProfileTemplate = {
  id: string
  name: string
  description: string
  width?: number
  height?: number
  humanize?: boolean
  humanPreset?: 'default' | 'careful'
  tags?: string[]
  notes?: string
}

// Curated profile templates mirroring the "start from a preset" flows of the
// major antidetect managers. The stealth engine keeps the OS/platform,
// GPU and canvas identity of the host binary; templates only tune window
// geometry, humanization and organization, which the engine applies honestly.
export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'standard',
    name: 'Standard desktop',
    description: 'Natural window, default human timing. Everyday multi-account work.',
    humanize: true
  },
  {
    id: 'careful',
    name: 'Careful operation',
    description: 'Slower, more cautious human timing for sensitive targets.',
    humanize: true,
    humanPreset: 'careful'
  },
  {
    id: 'wide',
    name: 'Full HD workspace',
    description: '1920 × 1080 window with humanized interactions.',
    width: 1920,
    height: 1080,
    humanize: true
  },
  {
    id: 'minimal',
    name: 'Minimal footprint',
    description: '1366 × 768 window, no humanization, fastest automation.',
    width: 1366,
    height: 768,
    humanize: false
  }
]
