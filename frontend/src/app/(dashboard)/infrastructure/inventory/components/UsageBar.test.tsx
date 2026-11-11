import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import UsageBar from './UsageBar'

vi.mock('../helpers', () => ({ getMetricIcon: () => 'ri-cpu-line' }))

afterEach(cleanup)

describe('inventory UsageBar', () => {
  it.each([
    ['cpu', 'blue'], ['memory', 'cyan'], ['storage', 'violet'],
  ] as const)('explicit %s identity does not depend on translated labels', (metric, color) => {
    const { container } = render(
      <UsageBar label="任意翻译" metric={metric} used={2} capacity={100} mode="pct" themeColor="#123456" />
    )
    const fill = container.querySelector('.nebula-usage-fill')

    expect(fill).not.toBeNull()
    expect(container.querySelector('.nebula-usage-track')).not.toBeNull()
    expect(fill).toHaveStyle({ width: '2%' })
    expect(fill?.getAttribute('class')).toBeTruthy()
    expect(container.querySelector('i')?.style.color).toBe(`var(--nebula-brand-${color}, #123456)`)
    expect(screen.getByText('Free: 98%')).toBeInTheDocument()
  })

  it('keeps byte calculations and the empty-state width', () => {
    const { container } = render(
      <UsageBar label="RAM" metric="memory" used={0} capacity={0} mode="bytes" themeColor="#123456" />
    )

    expect(container.querySelector('.nebula-usage-fill')).toHaveStyle({ width: '0%' })
  })
})
