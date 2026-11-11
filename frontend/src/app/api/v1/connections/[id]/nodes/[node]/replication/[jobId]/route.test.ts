import { describe, it, expect, vi, beforeEach } from 'vitest'

import { callRoute, readJson } from '@/__tests__/setup/route-test'

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn<(...args: any[]) => Promise<Response | null>>(),
  PERMISSIONS: {
    NODE_VIEW: 'node.view',
    NODE_MANAGE: 'node.manage',
  },
}))

vi.mock('@/lib/connections/getConnection', () => ({
  getConnectionById: vi.fn<(id: string) => Promise<any>>(),
}))

vi.mock('@/lib/esage/client', () => ({
  unisphereFetch: vi.fn<(...args: any[]) => Promise<any>>(),
}))

import { GET, POST, DELETE } from './route'
import { checkPermission } from '@/lib/rbac'
import { getConnectionById } from '@/lib/connections/getConnection'
import { unisphereFetch } from '@/lib/esage/client'

const checkPermissionMock = checkPermission as any
const getConnectionByIdMock = getConnectionById as any
const unisphereFetchMock = unisphereFetch as any

const CONN = { id: 'conn-1' }
const BASE_PARAMS = { id: 'conn-1', node: 'unisphere-node-01', jobId: '1-unisphere-node-02' }

beforeEach(() => {
  vi.clearAllMocks()
  checkPermissionMock.mockResolvedValue(null)
  getConnectionByIdMock.mockResolvedValue(CONN)
  unisphereFetchMock.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET /api/v1/connections/[id]/nodes/[node]/replication/[jobId]', () => {
  it('returns 200 with formatted log entries (string entries)', async () => {
    unisphereFetchMock.mockResolvedValue(['line one', 'line two'])

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data).toEqual(['line one', 'line two'])
  })

  it('returns 200 with formatted log entries (object entries with .t field)', async () => {
    unisphereFetchMock.mockResolvedValue([{ t: 'replicated 1024 bytes', n: 1 }, { t: 'done', n: 2 }])

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data).toEqual(['replicated 1024 bytes', 'done'])
  })

  it('returns 200 with JSON-stringified entries when entry has no .t field', async () => {
    unisphereFetchMock.mockResolvedValue([{ level: 'info', msg: 'ok' }])

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data[0]).toBe('{"level":"info","msg":"ok"}')
  })

  it('returns empty data array when unisphereFetch returns a non-array', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data).toEqual([])
  })

  it('uses the limit query param when provided', async () => {
    unisphereFetchMock.mockResolvedValue([])

    await GET(new Request('http://test.local/_?limit=100'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/unisphere-node-01/replication/1-unisphere-node-02/log?limit=100')
  })

  it('defaults to limit=50 when no query param', async () => {
    unisphereFetchMock.mockResolvedValue([])

    await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/unisphere-node-01/replication/1-unisphere-node-02/log?limit=50')
  })

  it('encodes node and jobId in the unisphereFetch path', async () => {
    unisphereFetchMock.mockResolvedValue([])

    await GET(new Request('http://test.local/_'), {
      params: Promise.resolve({ id: 'conn-1', node: 'node/with/slash', jobId: 'job:id' }),
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/node%2Fwith%2Fslash/replication/job%3Aid/log?limit=50')
  })

  it('404 when connection not found', async () => {
    getConnectionByIdMock.mockResolvedValue(null)

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(404)
    const body = await readJson<any>(res)
    expect(body.error).toBe('Connection not found')
  })

  it('403 when NODE_VIEW is denied', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('500 on unisphereFetch throw', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('UNISPHERE unreachable'))

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('UNISPHERE unreachable')
    // data should still be present as empty array in error response
    expect(body.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST (schedule now)
// ---------------------------------------------------------------------------

describe('POST /api/v1/connections/[id]/nodes/[node]/replication/[jobId]', () => {
  it('200 happy path: calls schedule_now and returns result', async () => {
    unisphereFetchMock.mockResolvedValue('upid-abc123')

    const res = await callRoute(POST as any, {
      method: 'POST',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.success).toBe(true)
    expect(body.data).toBe('upid-abc123')

    expect(unisphereFetchMock).toHaveBeenCalledWith(
      CONN,
      '/nodes/unisphere-node-01/replication/1-unisphere-node-02/schedule_now',
      { method: 'POST' },
    )
  })

  it('encodes node and jobId in the schedule_now path', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(POST as any, {
      method: 'POST',
      params: { id: 'conn-1', node: 'node/x', jobId: 'job:1' },
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/node%2Fx/replication/job%3A1/schedule_now')
  })

  it('404 when connection not found', async () => {
    getConnectionByIdMock.mockResolvedValue(null)

    const res = await callRoute(POST as any, {
      method: 'POST',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(404)
    const body = await readJson<any>(res)
    expect(body.error).toBe('Connection not found')
  })

  it('403 when NODE_MANAGE is denied', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)

    const res = await callRoute(POST as any, {
      method: 'POST',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('500 on unisphereFetch throw', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('scheduler unavailable'))

    const res = await callRoute(POST as any, {
      method: 'POST',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('scheduler unavailable')
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/connections/[id]/nodes/[node]/replication/[jobId]', () => {
  it('200 happy path: calls cluster/replication DELETE and returns success', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.success).toBe(true)

    expect(unisphereFetchMock).toHaveBeenCalledWith(
      CONN,
      '/cluster/replication/1-unisphere-node-02',
      { method: 'DELETE' },
    )
  })

  it('encodes jobId in the cluster DELETE path', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(DELETE as any, {
      method: 'DELETE',
      params: { id: 'conn-1', node: 'unisphere-node-01', jobId: 'job:special' },
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/cluster/replication/job%3Aspecial')
  })

  it('404 when connection not found', async () => {
    getConnectionByIdMock.mockResolvedValue(null)

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(404)
    const body = await readJson<any>(res)
    expect(body.error).toBe('Connection not found')
  })

  it('403 when NODE_MANAGE is denied', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('500 on unisphereFetch throw', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('replication job not found'))

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('replication job not found')
  })
})
