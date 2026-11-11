import { describe, it, expect } from 'vitest'
import { computeNodeBreakdown } from './nodeBreakdown'
import type { HardeningData } from './hardening'

describe('computeNodeBreakdown', () => {
  const baseData: HardeningData = {
    nodes: [
      { node: 'unisphere1', status: 'online' },
      { node: 'unisphere2', status: 'online' },
    ],
    nodeDetails: {
      unisphere1: { firewall: { enable: 1 }, subscription: { status: 'Active', level: 'b' } },
      unisphere2: { firewall: { enable: 0 }, subscription: { status: 'Active', level: 'b' } },
    },
    sshData: {
      nodes: [
        {
          node: 'unisphere1',
          available: true,
          sections: {
            sshd_config: 'PermitRootLogin no\nPasswordAuthentication yes',
          },
        },
        {
          node: 'unisphere2',
          available: true,
          sections: {
            sshd_config: 'PermitRootLogin yes\nPasswordAuthentication yes',
          },
        },
      ],
    },
    resources: [
      { type: 'qemu', vmid: 100, node: 'unisphere1', name: 'vm-unisphere1', id: 'qemu/100' },
      { type: 'qemu', vmid: 200, node: 'unisphere2', name: 'vm-unisphere2', id: 'qemu/200' },
    ],
    vmConfigs: {
      'unisphere1/qemu/100': { bios: 'ovmf', net0: 'virtio,tag=10' },
      'unisphere2/qemu/200': { bios: 'seabios', net0: 'virtio' },
    },
    // Cluster-level fields
    firewallOptions: { enable: 1, policy_in: 'DROP' },
    version: { version: '8.1.0' },
    users: [{ userid: 'root@pam', enable: 1 }],
    tfa: [],
    backupJobs: [{ id: 'backup-1', enabled: 1 }],
    haResources: [],
    replicationJobs: [],
    pools: [],
  }

  it('(a) returns one NodeBreakdown per node', () => {
    const result = computeNodeBreakdown(baseData)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.node)).toEqual(['unisphere1', 'unisphere2'])
  })

  it('(b) ssh_root_login check differs between nodes based on their sshd_config', () => {
    const result = computeNodeBreakdown(baseData)

    const unisphere1 = result.find(r => r.node === 'unisphere1')!
    const unisphere2 = result.find(r => r.node === 'unisphere2')!

    const rootLoginUnisphere1 = unisphere1.checks.find(c => c.id === 'ssh_root_login')
    const rootLoginUnisphere2 = unisphere2.checks.find(c => c.id === 'ssh_root_login')

    // unisphere1 has PermitRootLogin no -- should pass
    expect(rootLoginUnisphere1).toBeDefined()
    expect(rootLoginUnisphere1!.status).toBe('pass')

    // unisphere2 has PermitRootLogin yes -- should warn (ssh_root_login uses 'warning' not 'fail')
    expect(rootLoginUnisphere2).toBeDefined()
    expect(rootLoginUnisphere2!.status).toBe('warning')
  })

  it('(c) no check with category === cluster appears in any node breakdown', () => {
    const result = computeNodeBreakdown(baseData)
    for (const breakdown of result) {
      const clusterChecks = breakdown.checks.filter(c => c.category === 'cluster')
      expect(clusterChecks).toHaveLength(0)
    }
  })

  it('returns empty array when data.nodes is undefined', () => {
    const result = computeNodeBreakdown({})
    expect(result).toHaveLength(0)
  })

  it('filters vmConfigs to only include keys for the given node', () => {
    const result = computeNodeBreakdown(baseData)
    // unisphere1 has one VM with VLAN tag -- vm_vlan_isolation should pass
    // unisphere2 has one VM without VLAN tag -- vm_vlan_isolation should fail/warn
    const unisphere1 = result.find(r => r.node === 'unisphere1')!
    const unisphere2 = result.find(r => r.node === 'unisphere2')!

    const vlanUnisphere1 = unisphere1.checks.find(c => c.id === 'vm_vlan_isolation')
    const vlanUnisphere2 = unisphere2.checks.find(c => c.id === 'vm_vlan_isolation')

    expect(vlanUnisphere1).toBeDefined()
    expect(vlanUnisphere2).toBeDefined()
    // unisphere1 has tag -- pass; unisphere2 does not -- fail
    expect(vlanUnisphere1!.status).toBe('pass')
    expect(vlanUnisphere2!.status).toBe('fail')
  })
})
