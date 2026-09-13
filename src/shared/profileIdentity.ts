import type { EnginePlatform, Profile, BrowserIdentity } from './profileSettings'

/**
 * Engine identity for a profile: the `--fingerprint-*` argument set that makes
 * the stealth engine coherent (platform, brand, UA-CH). Replaces the legacy
 * raw-flag workflow migrated out of `extraArgs` by `migrateProfileSettings`.
 */

const BRAND_FLAG: Record<BrowserIdentity, string> = {
  chrome: 'Chrome',
  chromium: 'Chromium',
  // Real Edge UAs carry the Edg/ token; the engine appends `{brand}/{version}`
  // to the UA string, so the full product name would be a mismatch.
  edge: 'Edg',
  opera: 'Opera',
  brave: 'Brave'
}

export type ProfileIdentity = {
  args: string[]
  platform: EnginePlatform
  brand: string | null
  brandVersion: string | null
}

/**
 * Build the engine identity arguments for a profile.
 *
 * - Platform pin keeps UA/platform/GPU consistent when spoofing another OS
 *   (the engine defaults to the host platform otherwise).
 * - Brand flags drive the UA-CH brand list on secure pages; the version
 *   defaults to the engine's Chromium major so brands stay plausible.
 */
export function profileIdentity(
  profile: Profile,
  chromiumVersion: string,
  platform: EnginePlatform
): ProfileIdentity {
  const args: string[] = []
  const engineHost = process.platform === 'darwin' ? 'macos' : 'windows'
  if (platform !== engineHost) args.push(`--fingerprint-platform=${platform}`)

  let brand: string | null = null
  let brandVersion: string | null = null
  if (profile.browserIdentity) {
    brand = BRAND_FLAG[profile.browserIdentity]
    brandVersion = profile.brandVersion ?? chromiumVersion.split('.')[0] ?? chromiumVersion
    args.push(`--fingerprint-brand=${brand}`)
    args.push(`--fingerprint-brand-version=${brandVersion}`)
  }
  return { args, platform, brand, brandVersion }
}
