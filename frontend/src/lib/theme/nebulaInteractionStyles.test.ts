import { describe, expect, it } from 'vitest'

import { nebulaInteractionStyles } from './nebulaInteractionStyles'

describe('Nebula interaction foregrounds', () => {
  it('uses the readable link token rather than the primary button fill', () => {
    for (const rule of Object.values(nebulaInteractionStyles)) {
      if ('color' in rule) {
        expect(['var(--nebula-action-link)', 'inherit']).toContain(rule.color)
      }
    }
  })

  it('excludes disabled controls and protects error input states', () => {
    for (const selector of Object.keys(nebulaInteractionStyles)) {
      expect(selector).toMatch(/Mui-disabled|aria-disabled/)
      if (selector.includes('Input')) expect(selector).toContain(':not(.Mui-error)')
    }
  })

  it('does not override contained buttons or semantic status chips', () => {
    const selectors = Object.keys(nebulaInteractionStyles).join('\n')

    expect(selectors).not.toMatch(/contained|colorSuccess|colorWarning|colorError/)
  })
})
