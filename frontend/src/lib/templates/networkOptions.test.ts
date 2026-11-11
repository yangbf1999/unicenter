import { describe, it, expect } from 'vitest'
import { buildNetworkOptions } from './networkOptions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVdc(overrides: {
  id?: string
  slug?: string
  connectionId?: string
  vnets?: Array<{
    unisphereName: string
    displayName: string | null
    subnet: { cidr: string; gateway: string; dnsServers: string | null } | null
  }>
} = {}) {
  return {
    id: overrides.id ?? 'vdc-1',
    slug: overrides.slug ?? 'tenant-vdc',
    connectionId: overrides.connectionId ?? 'conn-1',
    vnets: overrides.vnets ?? [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildNetworkOptions', () => {
  it('returns an empty array for no vDCs', () => {
    expect(buildNetworkOptions([])).toEqual([])
  })

  it('returns an empty array for a vDC with no vnets', () => {
    const result = buildNetworkOptions([makeVdc({ vnets: [] })])
    expect(result).toEqual([])
  })

  it('returns an empty array when vnets is undefined-like (tolerate missing array)', () => {
    const vdc = { id: 'vdc-1', slug: 'slug', connectionId: 'conn-1' } as any
    const result = buildNetworkOptions([vdc])
    expect(result).toEqual([])
  })

  it('flattens a single vDC with one vnet into a single option', () => {
    const result = buildNetworkOptions([
      makeVdc({
        id: 'vdc-1',
        slug: 'my-vdc',
        connectionId: 'conn-1',
        vnets: [
          {
            unisphereName: 'abcd1234',
            displayName: 'web-net',
            subnet: { cidr: '10.0.1.0/24', gateway: '10.0.1.1', dnsServers: '8.8.8.8' },
          },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      unisphereName: 'abcd1234',
      displayName: 'web-net',
      vdc: 'my-vdc',
      vdcId: 'vdc-1',
      connectionId: 'conn-1',
      subnet: {
        cidr: '10.0.1.0/24',
        gateway: '10.0.1.1',
        dnsServers: ['8.8.8.8'],
      },
    })
  })

  it('falls back to unisphereName when displayName is null', () => {
    const result = buildNetworkOptions([
      makeVdc({
        vnets: [
          { unisphereName: 'xyz99abc', displayName: null, subnet: null },
        ],
      }),
    ])

    expect(result[0].displayName).toBe('xyz99abc')
    expect(result[0].unisphereName).toBe('xyz99abc')
  })

  it('falls back to unisphereName when displayName is an empty string', () => {
    const result = buildNetworkOptions([
      makeVdc({
        vnets: [
          { unisphereName: 'unisphere12345', displayName: '', subnet: null },
        ],
      }),
    ])

    expect(result[0].displayName).toBe('unisphere12345')
  })

  it('sets subnet to null when the vnet has no subnet', () => {
    const result = buildNetworkOptions([
      makeVdc({
        vnets: [
          { unisphereName: 'abcd1234', displayName: 'lan', subnet: null },
        ],
      }),
    ])

    expect(result[0].subnet).toBeNull()
  })

  it('splits dnsServers CSV string into a trimmed array', () => {
    const result = buildNetworkOptions([
      makeVdc({
        vnets: [
          {
            unisphereName: 'abcd1234',
            displayName: 'lan',
            subnet: { cidr: '10.0.0.0/24', gateway: '10.0.0.1', dnsServers: '1.1.1.1, 8.8.8.8 , 9.9.9.9' },
          },
        ],
      }),
    ])

    expect(result[0].subnet?.dnsServers).toEqual(['1.1.1.1', '8.8.8.8', '9.9.9.9'])
  })

  it('returns empty dnsServers array when dnsServers is null', () => {
    const result = buildNetworkOptions([
      makeVdc({
        vnets: [
          {
            unisphereName: 'abcd1234',
            displayName: 'lan',
            subnet: { cidr: '10.0.0.0/24', gateway: '10.0.0.1', dnsServers: null },
          },
        ],
      }),
    ])

    expect(result[0].subnet?.dnsServers).toEqual([])
  })

  it('flattens multiple vDCs into a single list', () => {
    const result = buildNetworkOptions([
      makeVdc({
        id: 'vdc-a',
        slug: 'alpha',
        connectionId: 'conn-1',
        vnets: [
          { unisphereName: 'aaa00001', displayName: 'alpha-net', subnet: null },
        ],
      }),
      makeVdc({
        id: 'vdc-b',
        slug: 'beta',
        connectionId: 'conn-2',
        vnets: [
          { unisphereName: 'bbb00001', displayName: 'beta-net', subnet: null },
          { unisphereName: 'bbb00002', displayName: 'beta-net-2', subnet: null },
        ],
      }),
    ])

    expect(result).toHaveLength(3)
    const unisphereNames = result.map(o => o.unisphereName)
    expect(unisphereNames).toContain('aaa00001')
    expect(unisphereNames).toContain('bbb00001')
    expect(unisphereNames).toContain('bbb00002')
  })

  it('carries the vdcId and connectionId from the parent vDC onto each option', () => {
    const result = buildNetworkOptions([
      makeVdc({
        id: 'vdc-xyz',
        slug: 'my-slug',
        connectionId: 'conn-abc',
        vnets: [
          { unisphereName: 'net11111', displayName: 'net-a', subnet: null },
          { unisphereName: 'net22222', displayName: 'net-b', subnet: null },
        ],
      }),
    ])

    for (const opt of result) {
      expect(opt.vdcId).toBe('vdc-xyz')
      expect(opt.connectionId).toBe('conn-abc')
      expect(opt.vdc).toBe('my-slug')
    }
  })

  it('sorts the final list by displayName (locale-insensitive, stable)', () => {
    const result = buildNetworkOptions([
      makeVdc({
        id: 'vdc-1',
        slug: 's1',
        connectionId: 'c1',
        vnets: [
          { unisphereName: 'ppp33333', displayName: 'zeta', subnet: null },
          { unisphereName: 'ppp11111', displayName: 'alpha', subnet: null },
        ],
      }),
      makeVdc({
        id: 'vdc-2',
        slug: 's2',
        connectionId: 'c2',
        vnets: [
          { unisphereName: 'qqq00001', displayName: 'mango', subnet: null },
        ],
      }),
    ])

    expect(result.map(o => o.displayName)).toEqual(['alpha', 'mango', 'zeta'])
  })

  it('sort is stable: items with same displayName keep insertion order', () => {
    const result = buildNetworkOptions([
      makeVdc({
        id: 'vdc-1',
        slug: 'first',
        connectionId: 'c1',
        vnets: [{ unisphereName: 'aaa11111', displayName: 'shared', subnet: null }],
      }),
      makeVdc({
        id: 'vdc-2',
        slug: 'second',
        connectionId: 'c2',
        vnets: [{ unisphereName: 'bbb22222', displayName: 'shared', subnet: null }],
      }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0].vdcId).toBe('vdc-1')
    expect(result[1].vdcId).toBe('vdc-2')
  })
})
