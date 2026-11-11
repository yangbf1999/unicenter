import { describe, it, expect, vi, beforeEach } from 'vitest'

const unisphereFetchMock = vi.fn<(...args: any[]) => Promise<any>>()

vi.mock('@/lib/esage/client', () => ({
  unisphereFetch: unisphereFetchMock,
}))

const unisphereConn = {
  baseUrl: 'https://unisphere.test:8006',
  apiToken: 'tok',
  insecureDev: false,
  id: 'conn-1',
}

beforeEach(() => {
  unisphereFetchMock.mockReset().mockResolvedValue(undefined)
})

describe('unisphereSetVmConfig', () => {
  it('PUTs to /nodes/{node}/qemu/{vmid}/config with the provided body', async () => {
    const { unisphereSetVmConfig } = await import('./unisphere-vm-config')
    const body = new URLSearchParams({ scsi0: 'local-zfs:vm-101-disk-0' })

    await unisphereSetVmConfig(unisphereConn, 'unisphere-node-1', 101, body)

    expect(unisphereFetchMock).toHaveBeenCalledTimes(1)
    const [conn, path, init] = unisphereFetchMock.mock.calls[0]
    expect(conn).toBe(unisphereConn)
    expect(path).toBe('/nodes/unisphere-node-1/qemu/101/config')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(body)
  })

  // Slow-storage timeout is the whole point of this helper (issue #332):
  // qm set on ZFS-over-iSCSI takes ~10s, well above unisphereFetch's 8s default.
  // Guard against a future "simplification" that drops the long timeout.
  it('passes a timeout much larger than the unisphereFetch default (issue #332)', async () => {
    const { unisphereSetVmConfig } = await import('./unisphere-vm-config')

    await unisphereSetVmConfig(unisphereConn, 'n', 1, new URLSearchParams())

    const [, , , fetchOpts] = unisphereFetchMock.mock.calls[0]
    expect(fetchOpts).toBeDefined()
    expect(fetchOpts.timeoutMs).toBeGreaterThanOrEqual(60_000)
  })

  it('URL-encodes the node name so unusual characters cannot break the path', async () => {
    const { unisphereSetVmConfig } = await import('./unisphere-vm-config')

    await unisphereSetVmConfig(unisphereConn, 'node with space', 1, new URLSearchParams())

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/node%20with%20space/qemu/1/config')
  })

  it('propagates unisphereFetch errors (timeout, 4xx, 5xx) to the caller', async () => {
    unisphereFetchMock.mockReset().mockRejectedValueOnce(new Error('UNISPHERE 500 /config: boom'))
    const { unisphereSetVmConfig } = await import('./unisphere-vm-config')

    await expect(
      unisphereSetVmConfig(unisphereConn, 'n', 1, new URLSearchParams()),
    ).rejects.toThrow('UNISPHERE 500')
  })
})

describe('destroyUnisphereVm', () => {
  // The whole point of this helper (issue #400): purge + destroy-unreferenced-disks
  // MUST be in the query string and the request MUST NOT carry a body. UNISPHERE rejects a
  // body on DELETE with 501 "Unexpected content for method 'DELETE'", which silently
  // leaked the VMID + its disk on failed-migration cleanup.
  it('DELETEs with purge flags in the query string and NO request body (issue #400)', async () => {
    const { destroyUnisphereVm } = await import('./unisphere-vm-config')

    await destroyUnisphereVm(unisphereConn, 'unisphere-node-1', 112)

    expect(unisphereFetchMock).toHaveBeenCalledTimes(1)
    const [conn, path, init] = unisphereFetchMock.mock.calls[0]
    expect(conn).toBe(unisphereConn)
    expect(path).toBe('/nodes/unisphere-node-1/qemu/112?purge=1&destroy-unreferenced-disks=1')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })

  it('accepts a string vmid and URL-encodes the node name', async () => {
    const { destroyUnisphereVm } = await import('./unisphere-vm-config')

    await destroyUnisphereVm(unisphereConn, 'node with space', '101')

    const [, path] = unisphereFetchMock.mock.calls[0]
    expect(path).toBe('/nodes/node%20with%20space/qemu/101?purge=1&destroy-unreferenced-disks=1')
  })

  it('propagates unisphereFetch errors to the caller (cleanup is best-effort at call sites)', async () => {
    unisphereFetchMock.mockReset().mockRejectedValueOnce(new Error('UNISPHERE 500 /qemu/112: boom'))
    const { destroyUnisphereVm } = await import('./unisphere-vm-config')

    await expect(destroyUnisphereVm(unisphereConn, 'n', 112)).rejects.toThrow('UNISPHERE 500')
  })
})
