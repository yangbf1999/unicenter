// Next Imports
import { cookies } from 'next/headers'

// Third-party Imports
import 'server-only'

// Config Imports
import themeConfig, { applyProductThemePolicy, lockedThemeSettings } from '@configs/themeConfig'

// Appearance Imports
import { getStoredAppearance } from '@/lib/appearance/server'

export const getSettingsFromCookie = async () => {
  const cookieStore = await cookies()
  const cookieName = themeConfig.settingsCookieName

  try {
    return JSON.parse(cookieStore.get(cookieName)?.value || '{}')
  } catch {
    // A cookie truncated or mangled on its way back would otherwise throw here,
    // during the render of every single page, leaving the user with a 500 and
    // no way out of it from the UI. Falling back to the defaults costs them
    // their local cache at worst, and what they saved is on the server anyway.
    return {}
  }
}

/**
 * The settings this render should use: what the user saved on the server wins
 * over the cookie, which stays as a local cache and as the only source for
 * anonymous pages (issue #696). Read this rather than the cookie whenever the
 * answer drives what gets painted, so a restored theme is right on the first
 * frame instead of swapping in after hydration.
 */
export const getEffectiveSettings = async () => {
  const settingsCookie = await getSettingsFromCookie()
  const stored = await getStoredAppearance()
  const resolved = stored ? { ...settingsCookie, ...stored } : settingsCookie

  return applyProductThemePolicy(resolved)
}

export const getMode = async () => {
  await getEffectiveSettings()

  return lockedThemeSettings.mode
}

export const getSystemMode = async () => {
  await getMode()

  return lockedThemeSettings.mode
}

export const getServerMode = async () => {
  await getSystemMode()

  return lockedThemeSettings.mode
}

export const getSkin = async () => {
  const settings = await getEffectiveSettings()

  return settings.skin || 'default'
}
