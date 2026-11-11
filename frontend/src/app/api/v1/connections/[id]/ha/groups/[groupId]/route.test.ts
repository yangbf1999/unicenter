import { describe, it, expect, vi, beforeEach } from 'vitest'

import { callRoute, readJson } from '@/__tests__/setup/route-test'

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn<(...args: any[]) => Promise<Response | null>>(),
  PERMISSIONS: {
    CONNECTION_VIEW: 'connection.view',
    CONNECTION_MANAGE: 'connection.manage',
  },
}))

vi.mock('@/lib/connections/getConnection', () => ({
  getConnectionById: vi.fn<(id: string) => Promise<any>>(),
}))

vi.mock('@/lib/esage/client', () => ({
  unisphereFetch: vi.fn<(...args: any[]) => Promise<any>>(),
}))

import { GET, PUT, DELETE } from './route'
import { checkPermission } from '@/lib/rbac'
import { getConnectionById } from '@/lib/connections/getConnection'
import { unisphereFetch } from '@/lib/esage/client'

const checkPermissionMock = checkPermission as any
const getConnectionByIdMock = getConnectionById as any
const unisphereFetchMock = unisphereFetch as any

const CONN = { id: 'conn-1' }
const BASE_PARAMS = { id: 'conn-1', groupId: 'ha-grp-prod' }

const HA_GROUP = {
  group: 'ha-grp-prod',
  nodes: 'unisphere1:2,unisphere2:1',
  restricted: 0,
  nofailback: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  checkPermissionMock.mockResolvedValue(null)
  getConnectionByIdMock.mockResolvedValue(CONN)
  unisphereFetchMock.mockResolvedValue(HA_GROUP)
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET /api/v1/connections/[id]/ha/groups/[groupId]', () => {
  it('200 returns group data', async () => {
    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.data).toMatchObject({ group: 'ha-grp-prod', nodes: 'unisphere1:2,unisphere2:1' })
    expect(unisphereFetchMock).toHaveBeenCalledWith(CONN, '/cluster/ha/groups/ha-grp-prod')
  })

  it('encodes groupId with special characters in the unisphereFetch path', async () => {
    unisphereFetchMock.mockResolvedValue({})

    await GET(new Request('http://test.local/_'), {
      params: Promise.resolve({ id: 'conn-1', groupId: 'grp/special:1' }),
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/cluster/ha/groups/grp%2Fspecial%3A1')
  })

  it('403 when CONNECTION_VIEW is denied', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('404 when unisphereFetch throws a 404-containing error', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('404 not found'))

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(404)
    const body = await readJson<any>(res)
    expect(body.error).toBe('Groupe HA non trouvé')
  })

  it('404 when unisphereFetch throws a "does not exist" error', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('group does not exist'))

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(404)
    const body = await readJson<any>(res)
    expect(body.error).toBe('Groupe HA non trouvé')
  })

  it('500 on unexpected unisphereFetch error', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('cluster manager offline'))

    const res = await GET(new Request('http://test.local/_'), {
      params: Promise.resolve(BASE_PARAMS),
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('cluster manager offline')
  })
})

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

describe('PUT /api/v1/connections/[id]/ha/groups/[groupId]', () => {
  it('200 happy path with nodes, restricted, nofailback and comment', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    const res = await callRoute(PUT as any, {
      method: 'PUT',
      params: BASE_PARAMS,
      body: {
        nodes: 'unisphere1:2,unisphere2:1',
        restricted: true,
        nofailback: false,
        comment: 'prod group',
      },
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.message).toBe('Groupe HA mis à jour avec succès')

    const [, path, opts] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/cluster/ha/groups/ha-grp-prod')
    expect(opts.method).toBe('PUT')
    expect(opts.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(opts.body).toBe('nodes=unisphere1%3A2%2Cunisphere2%3A1&restricted=1&nofailback=0&comment=prod+group')
  })

  it('sends delete param when provided', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(PUT as any, {
      method: 'PUT',
      params: BASE_PARAMS,
      body: { delete: 'comment' },
    })

    const [, , opts] = unisphereFetchMock.mock.calls[0]
    expect(opts.body).toBe('delete=comment')
  })

  it('omits optional fields when not present in request body', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(PUT as any, {
      method: 'PUT',
      params: BASE_PARAMS,
      body: { nodes: 'unisphere1:1' },
    })

    const [, , opts] = unisphereFetchMock.mock.calls[0]
    expect(opts.body).toBe('nodes=unisphere1%3A1')
    expect(opts.body).not.toContain('restricted')
    expect(opts.body).not.toContain('nofailback')
    expect(opts.body).not.toContain('comment')
  })

  it('encodes groupId in the PUT path', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(PUT as any, {
      method: 'PUT',
      params: { id: 'conn-1', groupId: 'grp:special' },
      body: {},
    })

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/cluster/ha/groups/grp%3Aspecial')
  })

  it('403 when CONNECTION_MANAGE is denied', async () => {
    const denied = new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)

    const res = await callRoute(PUT as any, {
      method: 'PUT',
      params: BASE_PARAMS,
      body: {},
    })

    expect(res.status).toBe(403)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('500 on unisphereFetch throw', async () => {
    unisphereFetchMock.mockRejectedValue(new Error('HA group locked'))

    const res = await callRoute(PUT as any, {
      method: 'PUT',
      params: BASE_PARAMS,
      body: { nodes: 'unisphere1:1' },
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('HA group locked')
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/connections/[id]/ha/groups/[groupId]', () => {
  it('200 happy path: calls unisphereFetch DELETE and returns success message', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.message).toBe('Groupe HA supprimé avec succès')
    expect(body.data).toBeNull()

    expect(unisphereFetchMock).toHaveBeenCalledWith(CONN, '/cluster/ha/groups/ha-grp-prod', {
      method: 'DELETE',
    })
  })

  it('encodes groupId in the DELETE path', async () => {
    unisphereFetchMock.mockResolvedValue(null)

    await callRoute(DELETE as any, {
      method: 'DELETE',
      params: { id: 'conn-1', groupId: 'grp:prod' },
    })

    expect(unisphereFetchMock).toHaveBeenCalledWith(CONN, '/cluster/ha/groups/grp%3Aprod', {
      method: 'DELETE',
    })
  })

  it('403 when CONNECTION_MANAGE is denied', async () => {
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
    unisphereFetchMock.mockRejectedValue(new Error('HA daemon unreachable'))

    const res = await callRoute(DELETE as any, {
      method: 'DELETE',
      params: BASE_PARAMS,
    })

    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toContain('HA daemon unreachable')
  })
})
