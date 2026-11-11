import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'

import { renderWithProviders } from '@/__tests__/setup/renderWithProviders'

import { gaugeGeometry } from '../gaugeGeometry'
import CircularGauge from './CircularGauge'

afterEach(cleanup)

describe('CircularGauge', () => {
  it('keeps the full-circle geometry by default', () => {
    const { container } = renderWithProviders(
      <CircularGauge animate={false} value={50} color='#3B82F6' trackColor='#14253F' />
    )
    const circles = container.querySelectorAll('circle')
    const geometry = gaugeGeometry(0.5)

    expect(circles[0].getAttribute('stroke-dasharray')).toBeNull()
    expect(Number(circles[1].getAttribute('stroke-dasharray'))).toBeCloseTo(geometry.circumference, 6)
    expect(Number(circles[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(geometry.circumference / 2, 6)
    expect(circles[1].getAttribute('transform')).toBe('rotate(-90 50 50)')
  })

  it('renders the prototype dashboard gap with Ant-compatible round-cap compensation', () => {
    const { container } = renderWithProviders(
      <CircularGauge
        animate={false}
        value={50}
        color='#06B6D4'
        trackColor='#14253F'
        strokeWidth={10}
        gapDegree={75}
      />
    )
    const circles = container.querySelectorAll('circle')
    const geometry = gaugeGeometry(0.5, 10)
    const arcLength = geometry.circumference * (285 / 360)
    const [trackLength, trackGap] = circles[0].getAttribute('stroke-dasharray')!.split(' ').map(Number)
    const [valueLength, valueGap] = circles[1].getAttribute('stroke-dasharray')!.split(' ').map(Number)

    expect(trackLength).toBeCloseTo(arcLength, 6)
    expect(trackGap).toBeCloseTo(geometry.circumference, 6)
    expect(valueLength).toBeCloseTo(arcLength, 6)
    expect(valueGap).toBeCloseTo(geometry.circumference, 6)
    expect(Number(circles[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(arcLength / 2 + 5, 6)
    expect(circles[0].getAttribute('stroke-linecap')).toBe('round')
    expect(circles[1].getAttribute('transform')).toBe('rotate(127.5 50 50)')
    expect((circles[1] as SVGCircleElement).style.getPropertyValue('--nebula-gauge-color')).toBe('#06B6D4')
  })

  it.each([
    [0, 'empty'],
    [100, 'full'],
  ])('matches the prototype dashboard offset at %i%% (%s)', (value) => {
    const { container } = renderWithProviders(
      <CircularGauge
        animate={false}
        value={value}
        color='#8B5CF6'
        trackColor='#14253F'
        strokeWidth={10}
        gapDegree={75}
      />
    )
    const geometry = gaugeGeometry(value / 100, 10)
    const arcLength = geometry.circumference * (285 / 360)
    const valueCircle = container.querySelector('.nebula-circular-gauge-value')!
    const expectedOffset = value === 100 ? 0 : arcLength - 0.01

    expect(Number(valueCircle.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset, 6)
    expect(Number(valueCircle.getAttribute('opacity'))).toBe(value === 0 ? 0 : 1)
  })
})
