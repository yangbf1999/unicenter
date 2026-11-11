import { describe, expect, it, vi } from 'vitest'

import {
  getVisibleSettingsTabIndices,
  HIDDEN_SETTINGS_TABS_THIS_RELEASE,
  normalizeConnectionTab,
} from './settingsVisibility'

describe('settings release visibility', () => {
  it('hides HA and API entry points even for a provider administrator', () => {
    const hasFeature = vi.fn(() => true)
    const indices = getVisibleSettingsTabIndices({
      tabNames: ['connections', 'license', 'ha', 'api'],
      tabs: [
        { providerOnly: true },
        { providerOnly: true },
        { providerOnly: true },
        { providerOnly: true },
      ],
      isProviderAdmin: true,
      licenseLoading: false,
      hasFeature,
    })

    expect(indices).toEqual([0, 1])
    expect(HIDDEN_SETTINGS_TABS_THIS_RELEASE).toEqual(new Set(['ha', 'api']))
  })

  it('keeps the existing provider and license feature filters', () => {
    const tabs = [
      { providerOnly: true },
      { requiredFeature: 'notifications' },
      {},
    ]

    expect(getVisibleSettingsTabIndices({
      tabNames: ['connections', 'notifications', 'appearance'],
      tabs,
      isProviderAdmin: false,
      licenseLoading: false,
      hasFeature: () => false,
    })).toEqual([2])

    expect(getVisibleSettingsTabIndices({
      tabNames: ['connections', 'notifications', 'appearance'],
      tabs,
      isProviderAdmin: true,
      licenseLoading: true,
      hasFeature: () => false,
    })).toEqual([0, 1, 2])
  })

  it('returns to the VE tab if migration tabs become unavailable', () => {
    expect(normalizeConnectionTab(5, false)).toBe(0)
    expect(normalizeConnectionTab(1, false)).toBe(1)
    expect(normalizeConnectionTab(3, true)).toBe(3)
  })
})
