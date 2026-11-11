import { describe, expect, it } from 'vitest'

import { nebulaMetricColor } from './nebulaMetricColor'

describe('metric color mapping', () => {
  it.each([
    ['cpu', 'blue'], ['memory', 'cyan'], ['storage', 'violet'],
  ])('uses a stable %s resource color with legacy fallback', (metric, token) => {
    expect(nebulaMetricColor('#22c55e', metric)).toBe(`var(--nebula-brand-${token}, #22c55e)`)
  })

  it.each(['success', 'warning', 'error', 'info'])('keeps %s status meaning', status => {
    expect(nebulaMetricColor(`${status}.main`)).toBe(`var(--nebula-status-${status}, var(--mui-palette-${status}-main))`)
  })

  it('preserves custom series colors and existing CSS tokens', () => {
    expect(nebulaMetricColor('#123456')).toBe('#123456')
    expect(nebulaMetricColor('var(--nebula-brand-cyan)')).toBe('var(--nebula-brand-cyan)')
  })

  it('uses purple for normal storage capacity but preserves quota alarms', () => {
    expect(nebulaMetricColor('success.main', 'storage-capacity')).toContain('--nebula-brand-violet')
    expect(nebulaMetricColor('warning.main', 'storage-capacity')).toContain('--nebula-status-warning')
    expect(nebulaMetricColor('error.main', 'storage-capacity')).toContain('--nebula-status-error')
  })
})
