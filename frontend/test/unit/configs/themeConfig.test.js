import { describe, expect, it } from 'vitest'

import {
  applyProductThemePolicy,
  lockedThemeSettings,
  themeSwitchingEnabled
} from '@configs/themeConfig'

describe('fixed product theme policy', () => {
  it('keeps non-theme settings and locks all theme fields after merging', () => {
    expect(themeSwitchingEnabled).toBe(false)
    expect(applyProductThemePolicy({
      mode: 'system',
      globalTheme: 'vcenterClassic',
      primaryColor: '#0079B8',
      fontSize: 16,
      density: 'compact'
    })).toEqual({
      ...lockedThemeSettings,
      fontSize: 16,
      density: 'compact'
    })
  })
})
