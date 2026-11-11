import { describe, expect, it } from 'vitest'

import { createNebulaMetricStyles, metricGlow, metricGradient } from './nebulaMetricStyles'

describe('Nebula metric visual contract', () => {
  it('shares glow strength between arcs, donuts and bars', () => {
    const styles = createNebulaMetricStyles('dark')

    expect(styles['.nebula-circular-gauge-value'].filter).toBe(metricGlow('var(--nebula-gauge-color)'))
    expect(styles['.nebula-donut-value'].filter).toBe(metricGlow('var(--nebula-gauge-color)'))
    expect(styles['.nebula-usage-fill.nebula-usage-fill'].filter).toBe(metricGlow('var(--nebula-progress-color)'))
    expect(styles['.nebula-auto-ring.MuiCircularProgress-root'].filter).toBe(metricGlow('var(--nebula-gauge-color)'))
    expect(styles['.nebula-metric-ring.MuiCircularProgress-root'].filter).toBe(metricGlow('var(--nebula-gauge-color)'))
    expect(styles['.MuiLinearProgress-root.MuiLinearProgress-root'].filter)
      .toBe(metricGlow('var(--nebula-progress-color, var(--nebula-brand-blue))'))
  })

  it('keeps quota warning and error semantics', () => {
    const styles = createNebulaMetricStyles('dark')

    expect(styles['.nebula-quota-value.MuiCircularProgress-colorWarning'].color).toBe('var(--nebula-status-warning)')
    expect(styles['.nebula-quota-value.MuiCircularProgress-colorError'].color).toBe('var(--nebula-status-error)')
  })

  it('does not paint an opaque blue gradient over custom status fills', () => {
    const styles = createNebulaMetricStyles('dark')
    const bar = styles['.MuiLinearProgress-root .MuiLinearProgress-bar']

    expect(bar.backgroundImage).toContain('transparent')
    expect(bar.backgroundImage).not.toContain('--nebula-brand-blue')
    expect(styles['.MuiLinearProgress-root.MuiLinearProgress-colorError:not(.nebula-linear-progress)'])
      .toEqual({ '--nebula-progress-color': 'var(--nebula-status-error)' })
  })

  it('disables glow in light and reduced-motion modes without changing text', () => {
    const styles = createNebulaMetricStyles('light')

    expect(styles['.nebula-circular-gauge-value'].filter).toBe('none')
    expect(styles['.nebula-metric-ring.MuiCircularProgress-root'].filter).toBe('none')
    expect(Object.values(styles['@media (prefers-reduced-motion: reduce)'])[0].filter).toBe('none')
    expect(Object.keys(styles).join(' ')).not.toMatch(/Typography|indeterminate/)
  })

  it('derives the gradient from the metric color, never a green-yellow-red ramp', () => {
    expect(metricGradient('var(--nebula-brand-cyan)')).toContain('var(--nebula-brand-cyan)')
    expect(metricGradient('var(--nebula-brand-cyan)')).not.toMatch(/#|red|yellow|green/)
  })

  it('overrides old glass overlays without making labels glow', () => {
    const styles = createNebulaMetricStyles('dark')
    const fill = styles['.nebula-usage-fill.nebula-usage-fill']

    expect(fill['&::after'].display).toBe('none')
    expect(fill.backgroundSize).toBe('100% 100%')
    expect(styles['.nebula-usage-track.nebula-usage-track'].overflow).toBe('visible')
    expect(styles['.nebula-auto-ring.MuiCircularProgress-root'].color).toBe('var(--nebula-gauge-color)')
    expect(Object.keys(styles).join(' ')).not.toContain('indeterminate')
  })
})
