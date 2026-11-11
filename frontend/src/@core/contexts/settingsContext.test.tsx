import { useContext, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

const { saveAppearance, updateSettingsCookie, useObjectCookie } = vi.hoisted(() => ({
  saveAppearance: vi.fn(),
  updateSettingsCookie: vi.fn(),
  useObjectCookie: vi.fn(),
}))

vi.mock('@/lib/appearance/client', () => ({ saveAppearance }))
vi.mock('@core/hooks/useObjectCookie', () => ({ useObjectCookie }))

import themeConfig, { lockedThemeSettings } from '@configs/themeConfig'

import { SettingsContext, SettingsProvider } from './settingsContext'

type ProviderProps = {
  canPersistAppearance?: boolean
  hasStoredAppearance?: boolean
  initialSettings?: Record<string, unknown>
  mode?: string
  appearanceOwner?: string
}

let cookieValue: Record<string, unknown> | undefined

function renderSettings(props: ProviderProps = {}) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <SettingsProvider {...props}>{children}</SettingsProvider>
  )

  return renderHook(() => useContext(SettingsContext), { wrapper })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  saveAppearance.mockResolvedValue(true)
  cookieValue = undefined
  useObjectCookie.mockImplementation((_key: string, fallback: Record<string, unknown>) => [
    cookieValue ?? fallback,
    updateSettingsCookie,
  ])
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('SettingsProvider defaults', () => {
  it('uses Nebula dark without persisting defaults for a new user', () => {
    const { result } = renderSettings({ canPersistAppearance: true })

    expect(result.current.settings).toEqual(
      expect.objectContaining({
        mode: 'dark',
        globalTheme: 'nebula',
        primaryColor: lockedThemeSettings.primaryColor,
      }),
    )
    expect(saveAppearance).not.toHaveBeenCalled()
    expect(updateSettingsCookie).not.toHaveBeenCalled()
  })

  it.each(['#E57000', '#FFD200'])('overrides saved legacy theme colour %s', primaryColor => {
    const { result } = renderSettings({
      initialSettings: { mode: 'light', globalTheme: 'default', primaryColor, fontSize: 16 },
      hasStoredAppearance: true,
    })

    expect(result.current.settings).toEqual(
      expect.objectContaining({ ...lockedThemeSettings, fontSize: 16 }),
    )
  })

  it('overrides a previous browser theme while preserving non-theme settings', () => {
    cookieValue = { mode: 'system', globalTheme: 'nord', primaryColor: '#E57000', fontSize: 16 }
    const { result } = renderSettings()

    expect(result.current.settings).toEqual(
      expect.objectContaining({ ...lockedThemeSettings, fontSize: 16 }),
    )
  })

  it('exposes server settings layered over shipped defaults', () => {
    const { result } = renderSettings({
      initialSettings: { mode: 'dark', fontSize: 16 },
      hasStoredAppearance: true,
    })

    expect(result.current.settings.mode).toBe('dark')
    expect(result.current.settings.fontSize).toBe(16)
    expect(result.current.settings.primaryColor).toBe(lockedThemeSettings.primaryColor)
    expect(result.current.settings.primaryColor).toBeDefined()
  })

  it('resetSettings restores the shipped defaults', () => {
    const { result } = renderSettings({
      initialSettings: { mode: 'dark', primaryColor: '#FFD200', fontSize: 18 },
      hasStoredAppearance: true,
    })

    act(() => result.current.resetSettings())

    expect(result.current.settings).toEqual(
      expect.objectContaining({
        mode: themeConfig.mode,
        globalTheme: lockedThemeSettings.globalTheme,
        primaryColor: lockedThemeSettings.primaryColor,
        fontSize: 14,
        uiScale: 100,
        refreshInterval: 30,
        loginBackground: {
          type: 'gradient',
          gradient: 'default',
          imageUrl: null,
          overlay: true,
          overlayOpacity: 0.5,
          blur: 0,
          particles: false,
        },
      }),
    )
    expect(updateSettingsCookie).toHaveBeenCalledWith(
      expect.objectContaining({ ...lockedThemeSettings, fontSize: 14, uiScale: 100 }),
    )
  })
})

describe('appearance persistence', () => {
  it('writes the cookie and saves a mutable appearance setting after 600 ms', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ fontSize: 16 }))

    expect(updateSettingsCookie).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 16, ...lockedThemeSettings }),
    )
    expect(saveAppearance).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 16 }),
      { keepalive: false },
    )
  })

  it('ignores runtime attempts to switch away from the product theme', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({
      mode: 'light',
      globalTheme: 'default',
      primaryColor: '#E57000',
    }))
    act(() => vi.advanceTimersByTime(600))

    expect(result.current.settings).toEqual(expect.objectContaining(lockedThemeSettings))
    expect(updateSettingsCookie).not.toHaveBeenCalled()
    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('blocks a vCenter switch while persisting a mutable field from the same update', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({
      mode: 'light',
      globalTheme: 'vcenterClassic',
      primaryColor: '#0079B8',
      semiDark: false,
    }))
    act(() => vi.advanceTimersByTime(600))

    expect(result.current.settings).toEqual(expect.objectContaining({
      ...lockedThemeSettings,
      semiDark: false,
    }))
    expect(saveAppearance).toHaveBeenCalledWith(
      { semiDark: false },
      { keepalive: false },
    )
  })

  it('persists only non-theme keys from a mixed update', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ mode: 'light', primaryColor: '#E57000', fontSize: 16 }))
    act(() => vi.advanceTimersByTime(600))

    expect(result.current.settings).toEqual(
      expect.objectContaining({
        ...lockedThemeSettings,
        fontSize: 16,
      }),
    )
    expect(saveAppearance).toHaveBeenCalledWith(
      { fontSize: 16 },
      { keepalive: false },
    )
  })

  it('reset immediately persists the complete default set and replaces pending legacy deltas', () => {
    const { result } = renderSettings({
      canPersistAppearance: true,
      hasStoredAppearance: true,
      appearanceOwner: 'me',
      initialSettings: { mode: 'light', globalTheme: 'vcenterClassic', fontSize: 18, density: 'compact' },
    })

    act(() => result.current.updateSettings({ fontSize: 17, density: 'spacious' }))
    expect(saveAppearance).not.toHaveBeenCalled()

    act(() => result.current.resetSettings())

    expect(updateSettingsCookie).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...lockedThemeSettings,
        skin: 'default',
        semiDark: true,
        layout: 'vertical',
        navbarContentWidth: 'wide',
        contentWidth: 'wide',
        footerContentWidth: 'wide',
        lightBackground: 'neutral',
        density: 'comfortable',
        customBorderRadius: null,
        blurIntensity: 12,
        fontSize: 14,
        uiScale: 100,
        refreshInterval: 30,
        _appearanceOwner: 'me',
      }),
    )
    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      expect.objectContaining({
        ...lockedThemeSettings,
        fontSize: 14,
        density: 'comfortable',
        refreshInterval: 30,
      }),
      { keepalive: false },
    )
    expect(saveAppearance.mock.calls[0][0]).not.toHaveProperty('loginBackground')

    act(() => vi.advanceTimersByTime(600))
    expect(saveAppearance).toHaveBeenCalledOnce()
  })

  it('reset repairs the cookie but does not call the appearance API for an anonymous page', () => {
    const { result } = renderSettings({ canPersistAppearance: false })

    act(() => result.current.resetSettings())

    expect(updateSettingsCookie).toHaveBeenCalledWith(expect.objectContaining(lockedThemeSettings))
    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('collapses rapid updates into one save containing the last value', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => {
      result.current.updateSettings({ fontSize: 15 })
      result.current.updateSettings({ fontSize: 16 })
      result.current.updateSettings({ fontSize: 17 })
    })
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 17 }),
      { keepalive: false },
    )
  })

  it('never saves for an anonymous page', () => {
    const { result } = renderSettings({ canPersistAppearance: false })

    act(() => result.current.updateSettings({ fontSize: 16 }))
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('does not persist a page-scoped update', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ fontSize: 16 }, { updateCookie: false }))
    act(() => vi.advanceTimersByTime(600))

    expect(updateSettingsCookie).not.toHaveBeenCalled()
    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('does not fire a second save when the persisted subset is unchanged', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ fontSize: 16 }))
    act(() => vi.advanceTimersByTime(600))
    expect(saveAppearance).toHaveBeenCalledOnce()

    act(() => result.current.updateSettings({ fontSize: 16 }))
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledOnce()
  })

  it('sends only the keys the update moved, never the whole settings blob', () => {
    // A second tab holding a copy from before must not be able to revert what
    // this one saved, so an untouched key is not part of the payload.
    const { result } = renderSettings({
      canPersistAppearance: true,
      hasStoredAppearance: true,
      initialSettings: { mode: 'light', fontSize: 16 },
    })

    act(() => result.current.updateSettings({ density: 'compact' }))
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledWith({ density: 'compact' }, { keepalive: false })
  })

  it('accumulates the keys changed across several updates in one payload', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => {
      result.current.updateSettings({ fontSize: 16 })
      result.current.updateSettings({ density: 'compact' })
    })
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      { fontSize: 16, density: 'compact' },
      { keepalive: false },
    )
  })

  it('does not send a key the settings store does not persist', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ loginBackground: { type: 'image' } }))
    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('retries a refused save instead of letting the stale server copy win', async () => {
    saveAppearance.mockResolvedValueOnce(false)

    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ fontSize: 16 }))
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(saveAppearance).toHaveBeenCalledOnce()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(saveAppearance).toHaveBeenCalledTimes(2)
    expect(saveAppearance).toHaveBeenLastCalledWith({ fontSize: 16 }, { keepalive: false })
  })

  it('gives up retrying rather than hammering a server that stays down', async () => {
    saveAppearance.mockResolvedValue(false)

    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    act(() => result.current.updateSettings({ fontSize: 16 }))
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
    }

    // The first send plus MAX_PERSIST_RETRIES.
    expect(saveAppearance).toHaveBeenCalledTimes(4)
  })
})

describe('one-shot seeding', () => {
  it('seeds existing cookie settings once when the user has no stored appearance', () => {
    cookieValue = { mode: 'dark', primaryColor: '#FFD200', loginBackground: { type: 'image' } }

    const rendered = renderSettings({ canPersistAppearance: true, hasStoredAppearance: false })
    rendered.rerender()

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith({
      ...lockedThemeSettings,
    })
  })

  it('does not seed when an appearance is already stored', () => {
    cookieValue = { mode: 'dark', primaryColor: '#FFD200' }

    renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('does not seed a cookie that never departed from the shipped defaults', () => {
    // Storing the defaults for someone who never customised anything would pin
    // them to today's defaults, so an untouched cookie is left alone.
    cookieValue = undefined

    renderSettings({ canPersistAppearance: true, hasStoredAppearance: false })

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('does not seed for an anonymous page', () => {
    cookieValue = { mode: 'dark', primaryColor: '#FFD200' }

    renderSettings({ canPersistAppearance: false, hasStoredAppearance: false })

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('refuses to copy another account cookie into this one on a shared browser', () => {
    cookieValue = { mode: 'dark', primaryColor: '#FFD200', _appearanceOwner: 'someone-else' }

    renderSettings({ canPersistAppearance: true, hasStoredAppearance: false, appearanceOwner: 'me' })

    expect(saveAppearance).not.toHaveBeenCalled()
  })

  it('still seeds a cookie this account wrote itself', () => {
    cookieValue = { mode: 'dark', primaryColor: '#FFD200', _appearanceOwner: 'me' }

    renderSettings({ canPersistAppearance: true, hasStoredAppearance: false, appearanceOwner: 'me' })

    expect(saveAppearance).toHaveBeenCalledWith({
      ...lockedThemeSettings,
    })
  })
})

describe('cookie ownership', () => {
  it('stamps the cookie with the account that wrote it, without storing the stamp', () => {
    const { result } = renderSettings({
      canPersistAppearance: true,
      hasStoredAppearance: true,
      appearanceOwner: 'me',
    })

    act(() => result.current.updateSettings({ fontSize: 16 }))

    expect(updateSettingsCookie).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 16, ...lockedThemeSettings, _appearanceOwner: 'me' }),
    )
    expect(result.current.settings._appearanceOwner).toBeUndefined()

    act(() => vi.advanceTimersByTime(600))

    expect(saveAppearance).toHaveBeenCalledWith({ fontSize: 16 }, { keepalive: false })
  })

  it('leaves the cookie unstamped for an anonymous page', () => {
    const { result } = renderSettings({ canPersistAppearance: false })

    act(() => result.current.updateSettings({ fontSize: 16 }))

    expect(updateSettingsCookie).toHaveBeenCalledWith(
      expect.not.objectContaining({ _appearanceOwner: expect.anything() }),
    )
  })
})

describe('page lifecycle flushes', () => {
  it('flushes a pending debounce immediately on pagehide with keepalive', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })
    act(() => result.current.updateSettings({ fontSize: 16 }))

    act(() => window.dispatchEvent(new Event('pagehide')))

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 16 }),
      { keepalive: true },
    )
    act(() => vi.advanceTimersByTime(600))
    expect(saveAppearance).toHaveBeenCalledOnce()
  })

  it('flushes a pending debounce when the document becomes hidden', () => {
    const { result } = renderSettings({ canPersistAppearance: true, hasStoredAppearance: true })
    act(() => result.current.updateSettings({ fontSize: 16 }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(saveAppearance).toHaveBeenCalledOnce()
    expect(saveAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 16 }),
      { keepalive: true },
    )
  })
})
