import { describe, it, expect, vi, beforeEach } from 'vitest'

import { callRoute, readJson } from '@/__tests__/setup/route-test'

vi.mock('@/lib/connections/getConnection', () => ({
  getConnectionById: vi.fn<(id: string) => Promise<any>>(),
}))

vi.mock('@/lib/esage/client', () => ({
  unisphereFetch: vi.fn<(...args: any[]) => Promise<any>>(),
}))

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn<(...args: any[]) => Promise<any>>(),
  buildVmResourceId: vi.fn<(...args: any[]) => string>(
    (connId, node, type, vmid) => `${connId}:${node}:${type}:${vmid}`
  ),
  PERMISSIONS: {
    VM_DELETE: 'vm.delete',
  },
}))

vi.mock('@/lib/vdc/ipam', () => ({
  releaseAllocationsForVm: vi.fn<(...args: any[]) => Promise<any>>(),
}))

vi.mock('@/lib/audit', () => ({
  audit: vi.fn<(...args: any[]) => Promise<void>>(),
}))

import { DELETE } from './route'
import { getConnectionById } from '@/lib/connections/getConnection'
import { unisphereFetch } from '@/lib/esage/client'
import { checkPermission } from '@/lib/rbac'
import { releaseAllocationsForVm } from '@/lib/vdc/ipam'
import { audit } from '@/lib/audit'

const getConnectionByIdMock = getConnectionById as any
const unisphereFetchMock = unisphereFetch as any
const checkPermissionMock = checkPermission as any
const releaseAllocationsForVmMock = releaseAllocationsForVm as any
const auditMock = audit as any

const CONN_ID = 'conn-1'
const NODE = 'unisphere-node-01'
const VMID = '101'

const baseParams = { id: CONN_ID, type: 'qemu', node: NODE, vmid: VMID }

function makeReq(url = `http://test.local/_`) {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  checkPermissionMock.mockResolvedValue(null)
  getConnectionByIdMock.mockResolvedValue({ id: CONN_ID })
  unisphereFetchMock.mockResolvedValue({ status: 'stopped' })
  releaseAllocationsForVmMock.mockResolvedValue(undefined)
  auditMock.mockResolvedValue(undefined)
})

describe('DELETE /api/v1/connections/[id]/guests/[type]/[node]/[vmid]', () => {
  it('400 when type is not qemu or lxc', async () => {
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ ...baseParams, type: 'template' }),
    })
    expect(res.status).toBe(400)
    const body = await readJson<any>(res)
    expect(body.error).toMatch(/Invalid type/)
    expect(unisphereFetchMock).not.toHaveBeenCalled()
  })

  it('403 when RBAC denies delete permission', async () => {
    const denied = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    checkPermissionMock.mockResolvedValue(denied)
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(403)
  })

  it('409 when VM is locked', async () => {
    unisphereFetchMock.mockResolvedValueOnce({ status: 'stopped', lock: 'snapshot' })
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(409)
    const body = await readJson<any>(res)
    expect(body.code).toBe('vm_locked')
    expect(body.lock).toBe('snapshot')
  })

  it('400 when VM is running', async () => {
    unisphereFetchMock.mockResolvedValueOnce({ status: 'running' })
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(400)
    const body = await readJson<any>(res)
    expect(body.code).toBe('vm_running')
  })

  it('200 happy path: qemu VM deleted, IPAM released, audit called', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce({ status: 'stopped' }) // status check
      .mockResolvedValueOnce('UPID:delete:task') // DELETE
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.success).toBe(true)

    // Status check call
    expect(unisphereFetchMock).toHaveBeenNthCalledWith(
      1,
      { id: CONN_ID },
      `/nodes/${NODE}/qemu/${VMID}/status/current`,
      { method: 'GET' }
    )
    // Delete call (no purge/destroy flags)
    expect(unisphereFetchMock).toHaveBeenNthCalledWith(
      2,
      { id: CONN_ID },
      `/nodes/${NODE}/qemu/${VMID}`,
      { method: 'DELETE' }
    )

    expect(releaseAllocationsForVmMock).toHaveBeenCalledWith(CONN_ID, 101)
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', resourceId: VMID })
    )
  })

  it('200 happy path: qemu VM deleted with purge and destroy-unreferenced-disks flags', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce({ status: 'stopped' })
      .mockResolvedValueOnce('UPID:delete:task')
    const url = `http://test.local/_?purge=1&destroy-unreferenced-disks=1`
    const res = await DELETE(makeReq(url), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(200)
    expect(unisphereFetchMock).toHaveBeenNthCalledWith(
      2,
      { id: CONN_ID },
      `/nodes/${NODE}/qemu/${VMID}?purge=1&destroy-unreferenced-disks=1`,
      { method: 'DELETE' }
    )
  })

  it('200 happy path: lxc container deleted, IPAM NOT released', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce({ status: 'stopped' })
      .mockResolvedValueOnce('UPID:delete:lxc')
    const res = await DELETE(makeReq(), {
      params: Promise.resolve({ ...baseParams, type: 'lxc' }),
    })
    expect(res.status).toBe(200)
    expect(releaseAllocationsForVmMock).not.toHaveBeenCalled()
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'containers', resourceType: 'lxc' })
    )
  })

  it('500 when unisphereFetch throws on DELETE', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce({ status: 'stopped' })
      .mockRejectedValueOnce(new Error('UNISPHERE 500'))
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    expect(res.status).toBe(500)
    const body = await readJson<any>(res)
    expect(body.error).toBe('UNISPHERE 500')
  })

  it('IPAM release failure is surfaced as a warning, VM still deleted', async () => {
    unisphereFetchMock
      .mockResolvedValueOnce({ status: 'stopped' })
      .mockResolvedValueOnce('UPID:delete:task')
    releaseAllocationsForVmMock.mockRejectedValue(new Error('IPAM down'))
    const res = await DELETE(makeReq(), {
      params: Promise.resolve(baseParams),
    })
    // The VM is already gone in UNISPHERE, so we must not fail the request: it still
    // succeeds (200) but the IPAM failure is reported via body.warning + audit.
    expect(res.status).toBe(200)
    const body = await readJson<any>(res)
    expect(body.success).toBe(true)
    expect(body.warning).toMatch(/IPAM release failed/i)
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        details: expect.objectContaining({
          ipamReleaseError: expect.stringMatching(/IPAM release failed/i),
        }),
      })
    )
  })
})
