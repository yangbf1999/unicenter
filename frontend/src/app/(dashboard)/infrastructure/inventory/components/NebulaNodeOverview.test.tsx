import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'

import { renderWithProviders, screen } from '@/__tests__/setup/renderWithProviders'

import type { DetailsPayload } from '../types'
import { NebulaNodeHeader, NebulaNodeSummary } from './NebulaNodeOverview'

afterEach(cleanup)

const nodeData: DetailsPayload = {
  kindLabel: 'HOST',
  title: 'unisphere-01',
  subtitle: 'Production node',
  breadcrumb: ['Shanghai', 'Production', 'unisphere-01'],
  status: 'ok',
  tags: [],
  kpis: [],
  properties: [],
  metrics: {
    cpu: { label: 'CPU', pct: 34 },
    ram: { label: 'Memory', pct: 48, used: 48, max: 100 },
    storage: { label: 'Storage', pct: 31, used: 31, max: 100 },
  },
  lastUpdated: '2026-10-26 14:00',
  hostInfo: {
    cpuModel: 'AMD EPYC',
    kernelVersion: 'Linux 6.8',
    unisphereVersion: '9.2.2',
    uptime: 3600,
  },
}

describe('NebulaNodeHeader', () => {
  it('keeps the real node identity, status and action slot visible', () => {
    const onBack = vi.fn()

    renderWithProviders(
      <NebulaNodeHeader
        data={nodeData}
        selectionId='conn-1:unisphere-01'
        onBack={onBack}
        actions={<button type='button'>Create VM</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'unisphere-01' })).toBeInTheDocument()
    expect(screen.queryByText(/conn-1:unisphere-01/)).not.toBeInTheDocument()
    expect(screen.queryByText(/UNISPHERE HOST/)).not.toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create VM' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('NebulaNodeSummary', () => {
  it('renders the live capacity and host context without replacing the data contract', () => {
    renderWithProviders(<NebulaNodeSummary data={nodeData} selectionId='conn-1:unisphere-01' />)

    expect(screen.queryByText('OBJECT SUMMARY')).not.toBeInTheDocument()
    expect(screen.queryByText('CAPACITY')).not.toBeInTheDocument()
    expect(screen.queryByText('CONTEXT')).not.toBeInTheDocument()
    expect(screen.getByText('conn-1:unisphere-01')).toBeInTheDocument()
    expect(screen.getByText('UNISPHERE HOST')).toBeInTheDocument()
    expect(screen.getByLabelText('CPU 34%')).toBeInTheDocument()
    expect(screen.getByLabelText('Memory 48%')).toBeInTheDocument()
    expect(screen.getByLabelText('Storage Usage 31%')).toBeInTheDocument()
    expect(screen.getByText('AMD EPYC')).toBeInTheDocument()
    expect(screen.getByText('Linux 6.8')).toBeInTheDocument()
    expect(screen.getByText('9.2.2')).toBeInTheDocument()
  })
})
