import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
  settings: {} as Record<string, unknown>
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@core/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: h.settings,
    updateSettings: h.updateSettings,
    resetSettings: h.resetSettings
  })
}))

import AppearanceTab from '@/components/settings/AppearanceTab'

beforeEach(() => {
  vi.clearAllMocks()
  h.settings = {
    mode: 'dark',
    globalTheme: 'nebula',
    primaryColor: '#2563EB',
    refreshInterval: 30,
    fontSize: 14,
    uiScale: 100,
    density: 'comfortable',
    customBorderRadius: null,
    layout: 'vertical',
    semiDark: true
  }
})

afterEach(() => cleanup())

describe('AppearanceTab fixed-theme controls', () => {
  it('removes theme selection while keeping interface details directly visible', () => {
    const { container } = render(<AppearanceTab />)

    expect(screen.queryByText('settings.displayMode')).not.toBeInTheDocument()
    expect(screen.queryByText('settings.backgroundTint')).not.toBeInTheDocument()
    expect(screen.queryByText('settings.visualStyle')).not.toBeInTheDocument()
    expect(screen.queryByText('settings.blurIntensity')).not.toBeInTheDocument()

    expect(screen.getAllByText('settings.dataRefresh').length).toBeGreaterThan(0)
    expect(screen.queryByText('settings.advancedCustomization')).not.toBeInTheDocument()
    expect(screen.getByText('settings.interfaceDetails')).toBeVisible()
    expect(screen.getByText('settings.fontSize')).toBeVisible()
    expect(screen.getByText('settings.uiScale')).toBeVisible()
    expect(screen.getByText('settings.interfaceDensity')).toBeVisible()
    expect(screen.getByText('settings.borderRadiusGlobal')).toBeVisible()
    expect(container.querySelector('.ri-arrow-up-s-line, .ri-arrow-down-s-line')).toBeNull()
    expect(screen.getByText('settings.layout')).toBeInTheDocument()
    expect(screen.queryByText('settings.semiDarkMenu')).not.toBeInTheDocument()
    expect(screen.getByText('settings.resetSettings')).toBeInTheDocument()
  })

  it('keeps the reset action connected to SettingsProvider', () => {
    render(<AppearanceTab />)

    fireEvent.click(screen.getByRole('button', { name: 'common.reset' }))

    expect(h.resetSettings).toHaveBeenCalledOnce()
  })
})
