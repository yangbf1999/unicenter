import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, getStoredAppearance } = vi.hoisted(() => ({
  cookies: vi.fn(),
  getStoredAppearance: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/appearance/server', () => ({ getStoredAppearance }))

import themeConfig, { lockedThemeSettings } from '@configs/themeConfig'
import {
  getEffectiveSettings,
  getMode,
  getSettingsFromCookie,
  getSystemMode,
} from './serverHelpers'

const cookieValues: Record<string, string> = {}

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of Object.keys(cookieValues)) delete cookieValues[key]
  cookies.mockImplementation(async () => ({
    get: (name: string) => (Object.hasOwn(cookieValues, name) ? { value: cookieValues[name] } : undefined),
  }))
  getStoredAppearance.mockResolvedValue(null)
})

function setSettingsCookie(settings: Record<string, unknown>) {
  cookieValues[themeConfig.settingsCookieName] = JSON.stringify(settings)
}

describe('getEffectiveSettings', () => {
  it('adds the default product skin while preserving cookie-only settings', async () => {
    const cookie = { mode: 'light', loginBackground: { type: 'gradient' } }
    setSettingsCookie(cookie)

    await expect(getEffectiveSettings()).resolves.toEqual({
      ...cookie,
      ...lockedThemeSettings,
    })
  })

  it('lets stored appearance settings win over the cookie', async () => {
    setSettingsCookie({ mode: 'light', primaryColor: '#E57000', loginBackground: { type: 'image' } })
    getStoredAppearance.mockResolvedValue({ mode: 'system', primaryColor: '#FFD200', fontSize: 16 })

    await expect(getEffectiveSettings()).resolves.toEqual({
      loginBackground: { type: 'image' },
      fontSize: 16,
      ...lockedThemeSettings,
    })
  })

  it('normalises a saved vCenter skin on the first server frame', async () => {
    setSettingsCookie({ mode: 'dark', globalTheme: 'nebula', primaryColor: '#2563EB' })
    getStoredAppearance.mockResolvedValue({
      mode: 'light',
      globalTheme: 'vcenterClassic',
      primaryColor: '#0079B8',
    })

    await expect(getEffectiveSettings()).resolves.toEqual({
      ...lockedThemeSettings,
    })
  })
})

describe('mode helpers', () => {
  it('keeps dark mode when stored and cookie modes request other values', async () => {
    setSettingsCookie({ mode: 'light' })
    getStoredAppearance.mockResolvedValue({ mode: 'system' })

    await expect(getMode()).resolves.toBe('dark')
  })

  it('falls back to themeConfig.mode when neither source has a mode', async () => {
    setSettingsCookie({ primaryColor: '#FFD200' })

    await expect(getMode()).resolves.toBe(themeConfig.mode)
  })

  it("ignores the 'colorPref' cookie when resolving the fixed mode", async () => {
    setSettingsCookie({ mode: 'light' })
    cookieValues.colorPref = 'light'
    getStoredAppearance.mockResolvedValue({ mode: 'system' })

    await expect(getSystemMode()).resolves.toBe('dark')
  })

  it.each(['light', 'dark'])('normalises stored concrete mode %s to dark', async mode => {
    setSettingsCookie({ mode: 'system' })
    cookieValues.colorPref = mode === 'light' ? 'dark' : 'light'
    getStoredAppearance.mockResolvedValue({ mode })

    await expect(getSystemMode()).resolves.toBe('dark')
  })
})

describe('getSettingsFromCookie', () => {
  it('falls back to an empty object rather than 500-ing every page on a mangled cookie', async () => {
    cookieValues[themeConfig.settingsCookieName] = 'not json'

    await expect(getSettingsFromCookie()).resolves.toEqual({})
  })

  it('still renders the stored appearance when the cookie is unreadable', async () => {
    cookieValues[themeConfig.settingsCookieName] = '{"mode":'
    getStoredAppearance.mockResolvedValue({ mode: 'light', primaryColor: '#FFD200', fontSize: 16 })

    await expect(getEffectiveSettings()).resolves.toEqual({
      fontSize: 16,
      ...lockedThemeSettings,
    })
  })
})
