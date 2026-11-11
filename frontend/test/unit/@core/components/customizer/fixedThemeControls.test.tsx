import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
}))

vi.mock('next/navigation', () => ({ usePathname: () => '/en/home' }))
vi.mock('next/link', () => ({
  default: ({ children, href }: PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('react-use', () => ({
  useMedia: () => false,
  useDebounce: vi.fn(),
}))
vi.mock('react-perfect-scrollbar', () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))
vi.mock('@core/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: h.settings,
    updateSettings: h.updateSettings,
    resetSettings: h.resetSettings,
    isSettingsChanged: false,
  }),
}))
vi.mock('@/contexts/BrandingContext', () => ({
  useBranding: () => ({ branding: { primaryColor: '#00ECB2' } }),
}))
vi.mock('@core/components/customizer/styles.module.css', () => ({ default: {} }))

import Customizer from '@core/components/customizer'
import ThemeDropdown from '@/components/layout/shared/ThemeDropdown'

beforeEach(() => {
  vi.clearAllMocks()
  h.settings = {
    mode: 'dark',
    globalTheme: 'nebula',
    primaryColor: '#2563EB',
    skin: 'default',
    semiDark: true,
    layout: 'vertical',
    contentWidth: 'wide',
  }
})

afterEach(() => cleanup())

describe('fixed-theme fallback entry points', () => {
  it('does not render ThemeDropdown while theme switching is disabled', () => {
    const { container } = render(<ThemeDropdown />)

    expect(container).toBeEmptyDOMElement()
  })

  it('hides Customizer mode and primary colour controls but keeps layout controls', () => {
    render(<Customizer />)

    expect(screen.queryByText('Theming')).not.toBeInTheDocument()
    expect(screen.queryByText(/Primary Color/)).not.toBeInTheDocument()
    expect(screen.queryByText('Mode')).not.toBeInTheDocument()
    expect(screen.getByText('Skin')).toBeInTheDocument()
    expect(screen.getByText('Layout')).toBeInTheDocument()
    expect(screen.getByText('Layouts')).toBeInTheDocument()
  })
})
