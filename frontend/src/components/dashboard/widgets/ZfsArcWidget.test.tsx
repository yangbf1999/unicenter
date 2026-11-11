import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { ResponsiveContainer } from 'recharts'
import { renderWithProviders, screen } from '@/__tests__/setup/renderWithProviders'
import { server, http, HttpResponse } from '@/__tests__/setup/msw-server'

// jsdom gives every element a zero size, so the real ChartContainer never
// reaches the width it needs and renders nothing. Fixed dimensions here let
// the chart body actually mount, which is what the series assertions read.
vi.mock('@/components/ChartContainer', () => ({
  default: ({ children }: { children: React.ReactElement }) => (
    <ResponsiveContainer width={600} height={300}>{children}</ResponsiveContainer>
  ),
}))

import ZfsArcWidget, { selectArcNodes, formatValue, ChartTooltip } from './ZfsArcWidget'

/**
 * #617: the ARC series used to share the memory chart's linear axis, where a
 * few MB of ARC against GB of RAM is an invisible flat line. The dedicated
 * widget only holds up if it also refuses to plot nodes that have no ARC at
 * all — UNISPHERE 8 has no `arcsize` column, and a node without ZFS reports nothing.
 */

// This project does not enable Vitest globals, so RTL's auto-cleanup is off.
afterEach(cleanup)

const data = {
  clusters: [{ id: 'c1', name: 'cluster-1' }],
  nodes: [
    { name: 'unisphere-01', node: 'unisphere-01', connectionId: 'c1' },
    { name: 'unisphere-02', node: 'unisphere-02', connectionId: 'c1' },
  ],
}

const respondWith = (payload: unknown) =>
  server.use(
    http.post('/api/v1/connections/:connId/nodes/trends', () => HttpResponse.json({ data: payload })),
  )

const render = (settings: Record<string, unknown> = {}) =>
  renderWithProviders(
    <ZfsArcWidget
      data={data}
      loading={false}
      timeRange="1h"
      config={{ settings }}
      onUpdateSettings={() => {}}
    />,
  )

describe('selectArcNodes', () => {
  const series = [
    { ts: 1, 'unisphere-01_arc': 3221225472, 'unisphere-02_arc': null },
    { ts: 2, 'unisphere-01_arc': 3221225472, 'unisphere-02_arc': null },
  ]

  it('keeps a node that reports ARC', () => {
    expect(selectArcNodes(series, ['unisphere-01', 'unisphere-02'])).toEqual(['unisphere-01'])
  })

  it('drops a node whose ARC is always zero (no ZFS)', () => {
    const zeroed = [{ ts: 1, 'unisphere-03_arc': 0 }, { ts: 2, 'unisphere-03_arc': 0 }]

    expect(selectArcNodes(zeroed, ['unisphere-03'])).toEqual([])
  })

  it('returns nothing when there is no series at all', () => {
    expect(selectArcNodes(null, ['unisphere-01'])).toEqual([])
    expect(selectArcNodes([], ['unisphere-01'])).toEqual([])
  })
})

describe('ZfsArcWidget', () => {
  it('explains the UNISPHERE 9 requirement when no node reports ARC', async () => {
    respondWith({ 'node:unisphere-01': [{ ts: 1, t: '10:00', cpu: 5, ram: 40, arc: null, arcPct: null }] })
    render()

    expect(await screen.findByText(/No ZFS ARC data/i)).toBeInTheDocument()
  })

  it('plots the chart as soon as one node reports ARC', async () => {
    respondWith({
      'node:unisphere-01': [{ ts: 1, t: '10:00', cpu: 5, ram: 40, arc: 3221225472, arcPct: 18.7 }],
      'node:unisphere-02': [{ ts: 1, t: '10:00', cpu: 7, ram: 51, arc: null, arcPct: null }],
    })
    render()

    // Wait for the controls to actually mount: the widget paints a spinner
    // first, so asserting an absence here would pass before anything renders.
    expect(await screen.findByText('ARC')).toBeInTheDocument()
    expect(screen.getByText('% RAM')).toBeInTheDocument()
    expect(screen.queryByText(/No ZFS ARC data/i)).not.toBeInTheDocument()
  })

  it('keeps its controls and offers a reset when a connection filter empties the chart', async () => {
    respondWith({})
    render({ selectedConnections: ['c1'] })

    expect(await screen.findByText(/No ZFS ARC data/i)).toBeInTheDocument()

    // Same bug class as #611: the filter is persisted, so it must stay reachable.
    expect(screen.getByText('ARC')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })
})

describe('formatValue', () => {
  it('renders bytes for the ARC view and a percentage for the share view', () => {
    expect(formatValue('arc', 3221225472)).toBe('3 GiB')
    expect(formatValue('arcPct', 18.7)).toBe('18.7%')
  })

  it('shows a dash rather than "0 B" for a slot the node never reported', () => {
    expect(formatValue('arc', null)).toBe('-')
    expect(formatValue('arcPct', undefined)).toBe('-')
  })
})

describe('ChartTooltip', () => {
  it('stays silent until the chart is hovered', () => {
    const { container } = renderWithProviders(<ChartTooltip active={false} payload={[]} metric="arc" isDark />)

    expect(container).toBeEmptyDOMElement()
  })

  it('formats each node row with the unit of the current view', () => {
    renderWithProviders(
      <ChartTooltip
        active
        label="10:00"
        metric="arc"
        isDark={false}
        payload={[{ dataKey: 'unisphere-01_arc', name: 'unisphere-01', value: 3221225472, color: '#fff' }]}
      />,
    )

    expect(screen.getByText('unisphere-01')).toBeInTheDocument()
    expect(screen.getByText('3 GiB')).toBeInTheDocument()
  })
})

describe('ZfsArcWidget interactions', () => {
  it('plots one series per node that reports ARC, and none for the others', async () => {
    respondWith({
      'node:unisphere-01': [
        { ts: 1, t: '10:00', arc: 3221225472, arcPct: 18.7 },
        { ts: 2, t: '10:01', arc: 3221225472, arcPct: 18.7 },
      ],
      'node:unisphere-02': [
        { ts: 1, t: '10:00', arc: null, arcPct: null },
        { ts: 2, t: '10:01', arc: null, arcPct: null },
      ],
    })
    const { container } = render()

    expect(await screen.findByText('ARC')).toBeInTheDocument()
    await new Promise(r => setTimeout(r, 0))
    expect(container.querySelectorAll('.recharts-area')).toHaveLength(1)
  })

  it('switches to the share of RAM view', async () => {
    respondWith({ 'node:unisphere-01': [{ ts: 1, t: '10:00', arc: 3221225472, arcPct: 18.7 }] })
    render()

    fireEvent.click(await screen.findByText('% RAM'))

    // The percentage axis is bounded, so its ticks carry the percent sign.
    expect(await screen.findByText('100%')).toBeInTheDocument()
  })

  it('clears the connection filter from the empty state', async () => {
    const onUpdateSettings = vi.fn()

    respondWith({})
    renderWithProviders(
      <ZfsArcWidget
        data={data}
        loading={false}
        timeRange="1h"
        config={{ settings: { selectedConnections: ['c2'] } }}
        onUpdateSettings={onUpdateSettings}
      />,
    )

    fireEvent.click(await screen.findByText('Reset'))
    expect(onUpdateSettings).toHaveBeenCalledWith({ selectedConnections: [] })
  })

  it('shows a spinner while the dashboard itself is still loading', () => {
    respondWith({})
    const { container } = renderWithProviders(
      <ZfsArcWidget data={data} loading timeRange="1h" config={{ settings: {} }} onUpdateSettings={() => {}} />,
    )

    expect(container.querySelector('.MuiCircularProgress-root')).toBeTruthy()
  })
})
