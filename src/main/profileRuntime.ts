import type { Browser, Page } from 'puppeteer-core'
import logger from '../logger/logger'
import type { PermissionChoice, Profile } from '../shared/profileSettings'

/**
 * Per-page and per-browser wiring the stealth engine does not own: explicit
 * user-agent override, geolocation override, resource blocking, cache toggle
 * and origin permission rules. Canvas/WebGL/audio/font/GPU stealth stays in
 * the source-patched engine (binary flags); nothing here injects JS that a
 * detector could observe.
 */

const PERMISSION_SETTING: Record<PermissionChoice, 'granted' | 'denied' | 'prompt'> = {
  allow: 'granted',
  deny: 'denied',
  prompt: 'prompt'
}

/** Apply origin permission rules (allow/deny/prompt) at browser level. */
export async function configureProfilePermissions(
  browser: Browser,
  profile: Profile
): Promise<void> {
  const rules = profile.permissionRules ?? []
  if (rules.length === 0) return
  // The session stays attached: detaching the browser-target session resets
  // Browser.setPermission grants. It dies with the browser on close.
  const session = await browser.target().createCDPSession()
  for (const rule of rules) {
    for (const kind of ['geolocation', 'notifications'] as const) {
      const choice = rule[kind]
      if (!choice) continue
      await session.send('Browser.setPermission', {
        permission: { name: kind },
        setting: PERMISSION_SETTING[choice],
        origin: rule.origin
      })
    }
  }
}
function blockedResourceTypes(profile: Profile): Record<string, true> {
  const blocked: Record<string, true> = {}
  if (profile.resources?.blockImages) blocked.image = true
  if (profile.resources?.blockMedia) {
    blocked.media = true
    blocked.font = true
  }
  return blocked
}

const geoRefreshRegistered = new WeakSet<object>()

// Pages newProfilePage creates are configured synchronously after creation,
// but the targetcreated handler observes the same target first and would
// configure late (post-navigation-start: locale/geolocation miss the load).
// Single-threaded claim protocol: newProfilePage arms the claim before
// requesting the page, the handler consumes it synchronously at event time.
const pendingOwned = new WeakMap<object, number>()

/** Arm an ownership claim consumed by the next page target (see claimOwnedTarget). */
export function expectOwnedPage(browser: object): void {
  pendingOwned.set(browser, (pendingOwned.get(browser) ?? 0) + 1)
}

/** Consume an armed claim for target's browser; true when newProfilePage owns it. */
export function claimOwnedTarget(target: { browser(): object }): boolean {
  const browser = target.browser()
  const pending = pendingOwned.get(browser) ?? 0
  if (pending <= 0) return false
  if (pending === 1) pendingOwned.delete(browser)
  else pendingOwned.set(browser, pending - 1)
  return true
}

/** Wire UA, viewport, geolocation, resource blocking and cache for one page. */
export async function configureProfilePage(page: Page, profile: Profile): Promise<void> {
  if (profile.useragent) {
    await page.setUserAgent(profile.useragent)
  }
  // The engine honors timezone but not locale at the binary level, so enforce
  const locale =
    profile.locale || profile.fingerprint?.locale || profile.fingerprint?.languages?.[0]
  if (locale) {
    const base = locale.split('-')[0] ?? locale
    await page.setExtraHTTPHeaders({ 'Accept-Language': `${locale},${base};q=0.9` })
    await page.evaluateOnNewDocument(
      (primary: string, fallback: string) => {
        try {
          Object.defineProperty(Navigator.prototype, 'language', {
            get: () => primary,
            configurable: true
          })
          Object.defineProperty(Navigator.prototype, 'languages', {
            get: () => [primary, fallback],
            configurable: true
          })
        } catch {
          /* Non-configurable in this context: keep engine defaults. */
        }
      },
      locale,
      base
    )
  }
  const viewport = profile.fingerprint?.viewport
  if (viewport) {
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
      isMobile: viewport.isMobile ?? false,
      hasTouch: viewport.hasTouch ?? false
    })
  }
  const geo = profile.fingerprint?.geolocation
  if (geo) {
    // CDP carries accuracy; Page.setGeolocation drops it. Session stays
    // attached (detach resets target state) and dies with the page.
    // Re-apply on every main-frame commit: engine first-target init can land
    // after setup and clear the override before page scripts query it.
    const session = await page.createCDPSession()
    const override = {
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: geo.accuracy ?? 0
    }
    await session.send('Emulation.setGeolocationOverride', override)
    if (!geoRefreshRegistered.has(page)) {
      page.on('framenavigated', (frame) => {
        if (frame.parentFrame()) return
        void session.send('Emulation.setGeolocationOverride', override).catch(() => undefined)
      })
    }
  }
  const blocked = blockedResourceTypes(profile)
  if (Object.keys(blocked).length > 0) {
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (page.isClosed()) return
      if (blocked[request.resourceType()]) {
        void request.abort().catch(() => undefined)
      } else {
        void request.continue().catch(() => undefined)
      }
    })
  }
}

/** Open a new page with the profile wiring applied. */
export async function newProfilePage(browser: Browser, profile: Profile): Promise<Page> {
  expectOwnedPage(browser)
  const page = await browser.newPage()
  try {
    await configureProfilePage(page, profile)
  } catch (error) {
    await page.close().catch(() => undefined)
    logger.error(`[profileRuntime] Page setup failed for ${profile.id}`)
    throw error
  }
  return page
}
