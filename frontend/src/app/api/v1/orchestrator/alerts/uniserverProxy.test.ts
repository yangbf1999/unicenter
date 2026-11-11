import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gateMock, fetchMock } = vi.hoisted(() => ({
  gateMock: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/alerts/backend', () => ({ requireUniserverAlerts: gateMock }))
vi.mock('@/lib/demo/demo-api', () => ({ demoResponse: () => null }))
vi.mock('@/lib/uniserver/alerts', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/uniserver/alerts')>()
  return { ...actual, uniserverAlertFetch: fetchMock }
})

import { DELETE, GET } from './route'
import { POST as BATCH } from './batch/route'

describe('enterprise alert BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gateMock.mockResolvedValue(null)
  })

  it('forwards list filters and adapts records to the existing page contract', async () => {
    fetchMock.mockResolvedValue({ records: [{ id: 'alert-1' }], total: 1, limit: 200, offset: 0 })
    const request = new Request('http://localhost/api/v1/orchestrator/alerts?limit=200')

    const response = await GET(request)

    expect(fetchMock).toHaveBeenCalledWith('/alerts?limit=200', { request })
    expect(await response.json()).toEqual({
      data: [{ id: 'alert-1' }], total: 1, limit: 200, offset: 0,
    })
  })

  it('maps clear-all to the scoped uniserver clear endpoint', async () => {
    fetchMock.mockResolvedValue({ cleared: 2 })
    const request = new Request('http://localhost/api/v1/orchestrator/alerts')

    const response = await DELETE(request)

    expect(fetchMock).toHaveBeenCalledWith('/alerts/clear', { method: 'DELETE', request })
    expect(await response.json()).toEqual({ cleared: 2 })
  })

  it('sends one batch request for many alert ids', async () => {
    fetchMock.mockResolvedValue({ succeeded_ids: ['a1'], failures: [] })
    const request = new Request('http://localhost/api/v1/orchestrator/alerts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge', ids: ['a1'] }),
    })

    await BATCH(request)

    expect(fetchMock).toHaveBeenCalledWith('/alerts/batch', {
      method: 'POST',
      body: { action: 'acknowledge', ids: ['a1'] },
      request,
    })
  })
})
