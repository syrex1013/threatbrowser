import path from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import type { Page } from 'puppeteer'
import logger from '../logger/logger'
import type { Profile } from './types'
import { loadProfiles, launchProfileForAutomation } from './profileService'

export type PixelscanResult = {
  url: string
  profileId: number
  startedAt: number
  finishedAt: number
  screenshotPath?: string
  verdictText?: string
  error?: string
}

function getDataDir(): string {
  return is.dev ? __dirname : app.getPath('userData')
}

async function clickFirstMatching(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const handle = await page.$(selector)
      if (!handle) continue
      await handle.click()
      return true
    } catch {
      // try next selector
    }
  }
  return false
}

async function clickButtonByText(page: Page, candidates: string[]): Promise<boolean> {
  try {
    return await page.evaluate((texts) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const t of texts) {
        const match = buttons.find(
          (b) => (b.textContent ?? '').trim().toLowerCase() === t.trim().toLowerCase()
        )
        if (match) {
          ;(match as HTMLButtonElement).click()
          return true
        }
      }
      return false
    }, candidates)
  } catch {
    return false
  }
}

async function extractText(page: Page, selectors: string[]): Promise<string | undefined> {
  for (const selector of selectors) {
    try {
      const el = await page.$(selector)
      if (!el) continue
      const text = await page.evaluate((node) => (node as HTMLElement).innerText, el)
      const normalized = String(text ?? '').trim()
      if (normalized) return normalized
    } catch {
      // try next selector
    }
  }
  return undefined
}

export async function runPixelscanFingerprintCheck(payload: {
  profileId?: number
}): Promise<PixelscanResult> {
  const startedAt = Date.now()
  const url = 'https://pixelscan.net/fingerprint-check'
  const profiles: Profile[] = await loadProfiles()
  const profile =
    typeof payload.profileId === 'number'
      ? profiles.find((p) => p.id === payload.profileId)
      : profiles[0]

  if (!profile) {
    return {
      url,
      profileId: payload.profileId ?? -1,
      startedAt,
      finishedAt: Date.now(),
      error: 'No profile available'
    }
  }

  try {
    const { page, browser } = await launchProfileForAutomation(profile)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })

      // Pixelscan UI changes occasionally; try to click by exact button text first,
      // then fall back to generic selectors.
      await clickButtonByText(page, ['Run scan', 'Run Scan', 'Start scan', 'Start Scan'])
      await clickFirstMatching(page, ['button[type="submit"]', 'button'])

      // Give the scan time to finish; we avoid waitForTimeout due to typings differences.
      await page
        .waitForFunction(() => document.readyState === 'complete', { timeout: 45000 })
        .catch(() => undefined)

      // Try to find any status/verdict label in common places.
      const verdictText =
        (await extractText(page, [
          '[data-testid*="verdict"]',
          '[data-testid*="result"]',
          '.verdict',
          '.result',
          'main',
          'body'
        ])) ?? undefined

      const screenshotsDir = path.join(getDataDir(), 'pixelscan')
      const screenshotPath = path.join(screenshotsDir, `${profile.id}-${Date.now()}.png`)
      await app.whenReady()
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)

      await browser.close().catch(() => undefined)
      return {
        url,
        profileId: profile.id,
        startedAt,
        finishedAt: Date.now(),
        screenshotPath,
        verdictText
      }
    } catch (error) {
      await browser.close().catch(() => undefined)
      throw error
    }
  } catch (error) {
    logger.error(`[pixelscan] run failed: ${String(error)}`)
    return {
      url,
      profileId: profile.id,
      startedAt,
      finishedAt: Date.now(),
      error: String(error)
    }
  }
}
