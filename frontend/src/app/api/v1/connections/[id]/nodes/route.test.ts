import { describe, it, expect, vi, beforeEach } from 'vitest'

import { callRoute, readJson } from '@/__tests__/setup/route-test'

const checkPermissionMock = vi.fn<(...args: any[]) => Promise<Response | null>>()
const getConnectionByIdMock = vi.fn<(id: string) => Promise<any>>()
const unisphereFetchMock = vi.fn<(...args: any[]) => Promise<any>>()
const getVdcScopeMock = vi.fn<(tenantId?: string) => Promise<any>>()
const resolveManagementIpMock = vi.fn<(_: any) => string | null>()
const setNodeIpsMock = vi.fn<(...args: any[]) => void>()

const upsertMock = vi.fn().mockResolvedValue({})
const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
const findManyMock = vi.fn().mockResolvedValue([])

vi.mock('@/lib/tenant', () => ({
  getSessionPrisma: async () => ({
    managedHost: {
      upsert: upsertMock,
      deleteMany: deleteManyMock,
      findMany: findManyMock,
    },
  }),
  getCurrentTenantId: async () => 'tenant-1',
}))

vi.mock('@/lib/rbac', () => ({
  checkPermission: checkPermissionMock,
  PERMISSIONS: { NODE_VIEW: 'node.view' },
}))

vi.mock('@/lib/connections/getConnection', () => ({
  getConnectionById: getConnectionByIdMock,
}))

vi.mock('@/lib/esage/client', () => ({
  unisphereFetch: unisphereFetchMock,
}))

vi.mock('@/lib/esage/resolveManagementIp', () => ({
  resolveManagementIp: resolveManagementIpMock,
}))

vi.mock('@/lib/esage/urlUtils', () => ({
  extractHostFromUrl: (u: string) => new URL(u).hostname,
  extractPortFromUrl: (u: string) => Number(new URL(u).port || 8006),
}))

vi.mock('@/lib/cache/nodeIpCache', () => ({
  setNodeIps: setNodeIpsMock,
}))

vi.mock('@/lib/vdc/scope', () => ({
  getVdcScope: getVdcScopeMock,
}))

const nodesCacheKey = '__unicenter_nodes_response_cache__'

beforeEach(() => {
  checkPermissionMock.mockReset().mockResolvedValue(null)
  getConnectionByIdMock.mockReset().mockResolvedValue({
    baseUrl: 'https://10.0.0.1:8006',
    apiToken: 'tok=secret',
  })
  unisphereFetchMock.mockReset()
  getVdcScopeMock.mockReset().mockResolvedValue(null)
  resolveManagementIpMock.mockReset().mockReturnValue('10.0.0.1')
  setNodeIpsMock.mockReset()
  upsertMock.mockClear()
  deleteManyMock.mockClear()
  findManyMock.mockClear()
  // Clear the in-module cache so each test sees a fresh fetch.
  delete (globalThis as any)[nodesCacheKey]
})

async function importGET() {
  const mod = await import('./route')
  return mod.GET as Parameters<typeof callRoute>[0]
}

describe('GET /api/v1/connections/[id]/nodes', () => {
  it('extracts the parsed unisphereversion from /status for each online node', async () => {
    unisphereFetchMock
      // /nodes
      .mockResolvedValueOnce([{ node: 'unisphere1', status: 'online' }])
      // /cluster/resources?type=node
      .mockResolvedValueOnce([])
      // /nodes/unisphere1/network
      .mockResolvedValueOnce([{ iface: 'vmbr0', type: 'bridge' }])
      // /nodes/unisphere1/status
      .mockResolvedValueOnce({
        unisphereversion: 'unisphere-manager/9.1.1/2a5fa54a8503f96d',
        memory: { used: 1024, total: 2048 },
      })

    const GET = await importGET()
    const res = await callRoute(GET, { params: { id: 'c1' } })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].unisphereversion).toBe('9.1.1')
  })

  it('falls back to the raw unisphereversion when it does not contain a slash', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce([{ node: 'unisphere1', status: 'online' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ unisphereversion: '9.1.1', memory: { used: 1, total: 2 } })

    const GET = await importGET()
    const res = await callRoute(GET, { params: { id: 'c1' } })

    const body = await readJson<any>(res)
    expect(body.data[0].unisphereversion).toBe('9.1.1')
  })

  it('leaves unisphereversion null when /status omits the field', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce([{ node: 'unisphere1', status: 'online' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ memory: { used: 1, total: 2 } })

    const GET = await importGET()
    const res = await callRoute(GET, { params: { id: 'c1' } })

    const body = await readJson<any>(res)
    expect(body.data[0].unisphereversion).toBeNull()
  })

  it('skips the /status call entirely for offline nodes, leaving unisphereversion null', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce([{ node: 'unisphere1', status: 'offline' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null) // /network
    // No /status call expected for offline node

    const GET = await importGET()
    const res = await callRoute(GET, { params: { id: 'c1' } })

    const body = await readJson<any>(res)
    expect(body.data[0].unisphereversion).toBeNull()
  })

  it('returns 400 when params.id is missing', async () => {
    const GET = await importGET()
    const res = await callRoute(GET, { params: {} })

    expect(res.status).toBe(400)
    expect((await readJson<any>(res))?.error).toBe('Missing params.id')
  })

  it('honours an RBAC denial without contacting eSage', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValueOnce(denied as any)

    const GET = await importGET()
    const res = await callRoute(GET, { params: { id: 'c1' } })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })
})
