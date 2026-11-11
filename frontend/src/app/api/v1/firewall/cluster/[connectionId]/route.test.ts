import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  CONN,
  denied,
  getConnectionByIdMock,
  handlersOf,
  installFirewallRouteMocks,
  orchestrator,
  resetFirewallRouteMocks,
  unavailable,
  checkPermissionMock,
  verifyConnectionOwnershipMock,
} from '@/__tests__/setup/firewall-route-mocks'
import { callRoute, readJson } from '@/__tests__/setup/route-test'

// unisphereFetch stands in for the UNISPHERE API — rather than unisphereDirect — so the Community
// fallback runs through the real unisphereDirect helpers: that is what proves the bare
// shape reaches the client (#616).
const unisphereFetchMock = vi.fn<(...args: any[]) => Promise<any>>()

vi.mock('@/lib/esage/client', () => ({ unisphereFetch: unisphereFetchMock }))

installFirewallRouteMocks()

const RULES = [
  { pos: 0, type: 'in', action: 'ACCEPT', proto: 'tcp', dport: '22', enable: 1 },
  { pos: 1, type: 'in', action: 'DROP', enable: 0 },
]

/** The single UNISPHERE write the fallback performed, destructured for assertions. */
function unisphereWrite() {
  const [conn, path, init] = unisphereFetchMock.mock.calls[0]

  return { conn, path, method: init.method, form: init.body as URLSearchParams }
}

beforeEach(resetFirewallRouteMocks)

describe('GET /api/v1/firewall/cluster/[connectionId]', () => {
  it('returns the orchestrator rules unwrapped and never touches UNISPHERE', async () => {
    orchestrator.get.mockResolvedValue({ data: RULES, status: 200 })

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, {
      params: { connectionId: 'conn-1' },
      searchParams: { type: 'rules' },
    })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual(RULES)
    expect(orchestrator.get).toHaveBeenCalledWith('/firewall/cluster/conn-1/rules')
    expect(getConnectionByIdMock).not.toHaveBeenCalled()
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('falls back to direct UNISPHERE rules when the orchestrator is unavailable', async () => {
    orchestrator.get.mockRejectedValue(unavailable())
    unisphereFetchMock.mockResolvedValue(RULES)

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, {
      params: { connectionId: 'conn-1' },
      searchParams: { type: 'rules' },
    })

    expect(res.status).toBe(200)

    // Regression guard: normalizeRules (components/firewall/shared.tsx) does an
    // Array.isArray check, so a { data: [...] } wrapper here would silently
    // empty the rules table instead of failing loudly.
    const body = await readJson<any>(res)

    expect(Array.isArray(body)).toBe(true)
    expect(body).toEqual(RULES)
    expect(unisphereFetchMock).toHaveBeenCalledWith(CONN, '/cluster/firewall/rules')
  })

  it('reads the cluster options directly from UNISPHERE when no type is given', async () => {
    orchestrator.get.mockRejectedValue(unavailable())
    unisphereFetchMock.mockResolvedValue({ enable: 1, policy_in: 'DROP', policy_out: 'ACCEPT' })

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, { params: { connectionId: 'conn-1' } })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ enable: 1, policy_in: 'DROP', policy_out: 'ACCEPT' })
    expect(orchestrator.get).toHaveBeenCalledWith('/firewall/cluster/conn-1/options')
    expect(unisphereFetchMock).toHaveBeenCalledWith(CONN, '/cluster/firewall/options')
  })

  it('propagates a non-unavailable orchestrator error as a 500 without touching UNISPHERE', async () => {
    orchestrator.get.mockRejectedValue(new Error('Orchestrator 403: feature not licensed'))

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, {
      params: { connectionId: 'conn-1' },
      searchParams: { type: 'rules' },
    })

    expect(res.status).toBe(500)
    expect(await readJson<any>(res)).toEqual({ error: 'Orchestrator 403: feature not licensed' })
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('returns the denied response when RBAC rejects the caller', async () => {
    checkPermissionMock.mockResolvedValue(denied(403, 'Forbidden'))

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, { params: { connectionId: 'conn-1' } })

    expect(res.status).toBe(403)
    expect(orchestrator.get).not.toHaveBeenCalled()
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('returns the denied response when the connection is not owned by the tenant', async () => {
    verifyConnectionOwnershipMock.mockResolvedValue(denied(404, 'Not found'))

    const { GET } = handlersOf(await import('./route'))

    const res = await callRoute(GET, { params: { connectionId: 'conn-other' } })

    expect(res.status).toBe(404)
    expect(checkPermissionMock).not.toHaveBeenCalled()
    expect(orchestrator.get).not.toHaveBeenCalled()
  })
})

describe('PUT /api/v1/firewall/cluster/[connectionId]', () => {
  it('returns the orchestrator body unwrapped and never touches UNISPHERE', async () => {
    orchestrator.put.mockResolvedValue({ data: { status: 'updated' }, status: 200 })

    const { PUT } = handlersOf(await import('./route'))

    const res = await callRoute(PUT, {
      params: { connectionId: 'conn-1' },
      method: 'PUT',
      body: { enable: 1 },
    })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ status: 'updated' })
    expect(orchestrator.put).toHaveBeenCalledWith('/firewall/cluster/conn-1/options', { enable: 1 })
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('writes the options straight to UNISPHERE as a form when the orchestrator is unavailable', async () => {
    orchestrator.put.mockRejectedValue(unavailable())
    unisphereFetchMock.mockResolvedValue(null)

    const { PUT } = handlersOf(await import('./route'))

    const res = await callRoute(PUT, {
      params: { connectionId: 'conn-1' },
      method: 'PUT',
      body: { enable: 1, policy_in: 'DROP' },
    })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ status: 'updated' })

    const { conn, path, method, form } = unisphereWrite()

    expect(conn).toEqual(CONN)
    expect(path).toBe('/cluster/firewall/options')
    expect(method).toBe('PUT')
    expect(form.get('enable')).toBe('1')
    expect(form.get('policy_in')).toBe('DROP')
  })

  it('propagates a non-unavailable orchestrator error as a 500 without touching UNISPHERE', async () => {
    orchestrator.put.mockRejectedValue(new Error('Orchestrator 500: boom'))

    const { PUT } = handlersOf(await import('./route'))

    const res = await callRoute(PUT, {
      params: { connectionId: 'conn-1' },
      method: 'PUT',
      body: { enable: 0 },
    })

    expect(res.status).toBe(500)
    expect(await readJson<any>(res)).toEqual({ error: 'Orchestrator 500: boom' })
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/firewall/cluster/[connectionId]', () => {
  it('keeps the 201 and the orchestrator body when the orchestrator answers', async () => {
    orchestrator.post.mockResolvedValue({ data: { status: 'created' }, status: 200 })

    const { POST } = handlersOf(await import('./route'))

    const res = await callRoute(POST, {
      params: { connectionId: 'conn-1' },
      body: { type: 'in', action: 'ACCEPT' },
    })

    expect(res.status).toBe(201)
    expect(await readJson(res)).toEqual({ status: 'created' })
    expect(orchestrator.post).toHaveBeenCalledWith('/firewall/cluster/conn-1/rules', { type: 'in', action: 'ACCEPT' })
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('keeps the 201 when the rule is added through the direct-UNISPHERE fallback', async () => {
    orchestrator.post.mockRejectedValue(unavailable())
    unisphereFetchMock.mockResolvedValue(null)

    const { POST } = handlersOf(await import('./route'))

    const res = await callRoute(POST, {
      params: { connectionId: 'conn-1' },
      body: { type: 'in', action: 'ACCEPT', dport: '443' },
    })

    expect(res.status).toBe(201)
    expect(await readJson(res)).toEqual({ status: 'created' })

    const { conn, path, method, form } = unisphereWrite()

    expect(conn).toEqual(CONN)
    expect(path).toBe('/cluster/firewall/rules')
    expect(method).toBe('POST')
    expect(form.get('type')).toBe('in')
    expect(form.get('action')).toBe('ACCEPT')
    expect(form.get('dport')).toBe('443')

    // Absent enable → 1, so a rule created in Community is armed like it is
    // through the orchestrator.
    expect(form.get('enable')).toBe('1')
  })

  it('propagates a non-unavailable orchestrator error as a 500 without touching UNISPHERE', async () => {
    orchestrator.post.mockRejectedValue(new Error('Orchestrator request timeout'))

    const { POST } = handlersOf(await import('./route'))

    const res = await callRoute(POST, {
      params: { connectionId: 'conn-1' },
      body: { type: 'in', action: 'ACCEPT' },
    })

    expect(res.status).toBe(500)
    expect(await readJson<any>(res)).toEqual({ error: 'Orchestrator request timeout' })
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })
})
