import useSWR from 'swr'
import { useSWRFetch } from './useSWRFetch'
import { useRefreshInterval } from './useRefreshInterval'

// Fetcher that chains connections -> firewall options for a single UNISPHERE connection
const clusterFirewallFetcher = async (url: string) => {
  const connRes = await fetch('/api/v1/connections')
  const connJson = await connRes.json()
  const unisphereConn = connJson.data?.find((c: any) => c.type === 'unisphere')
  if (!unisphereConn) return null

  const fwRes = await fetch(`/api/v1/firewall/cluster/${unisphereConn.id}?type=options`)
  if (!fwRes.ok) return null
  const fwData = await fwRes.json()
  return { ...fwData, connectionId: unisphereConn.id, connectionName: unisphereConn.name }
}

export function useClusterFirewallOptions() {
  const refreshInterval = useRefreshInterval(120000)
  return useSWR('zero-trust/firewall-options', clusterFirewallFetcher, { refreshInterval })
}

// Fetcher for firewall scores across all UNISPHERE clusters
const firewallScoresFetcher = async () => {
  const connRes = await fetch('/api/v1/connections')
  const connJson = await connRes.json()
  const unisphereConns = (connJson.data || []).filter((c: any) => c.type === 'unisphere')
  if (unisphereConns.length === 0) return []

  return Promise.all(
    unisphereConns.map(async (conn: any) => {
      try {
        const fwRes = await fetch(`/api/v1/firewall/cluster/${conn.id}?type=options`)
        let fwData = null
        if (fwRes?.ok) fwData = await fwRes.json()

        let score = 0
        const enabled = fwData?.enable === 1
        const policyIn = fwData?.policy_in || 'ACCEPT'
        const policyOut = fwData?.policy_out || 'ACCEPT'
        if (enabled) score += 40
        if (policyIn === 'DROP') score += 30
        if (policyOut === 'DROP') score += 30

        return { id: conn.id, name: conn.name, enabled, policyIn, policyOut, score }
      } catch {
        return { id: conn.id, name: conn.name, enabled: false, policyIn: 'N/A', policyOut: 'N/A', score: 0 }
      }
    })
  )
}

export function useFirewallScores() {
  const refreshInterval = useRefreshInterval(60000)
  return useSWR('zero-trust/firewall-scores', firewallScoresFetcher, { refreshInterval })
}

// Fetcher for security groups across all UNISPHERE clusters
const securityGroupsFetcher = async () => {
  const connRes = await fetch('/api/v1/connections')
  const connJson = await connRes.json()
  const unisphereConns = (connJson.data || []).filter((c: any) => c.type === 'unisphere')
  if (unisphereConns.length === 0) return []

  return Promise.all(
    unisphereConns.map(async (conn: any) => {
      try {
        const sgRes = await fetch(`/api/v1/firewall/groups/${conn.id}`)
        let groups: any[] = []
        if (sgRes?.ok) {
          const sgJson = await sgRes.json()
          groups = Array.isArray(sgJson) ? sgJson : []
        }
        return { id: conn.id, name: conn.name, groups: groups.slice(0, 10) }
      } catch {
        return { id: conn.id, name: conn.name, groups: [] }
      }
    })
  )
}

export function useClusterSecurityGroups() {
  const refreshInterval = useRefreshInterval(60000)
  return useSWR('zero-trust/security-groups', securityGroupsFetcher, { refreshInterval })
}

// Fetcher for VM firewall coverage (Enterprise only)
const vmFirewallCoverageFetcher = async () => {
  const connRes = await fetch('/api/v1/connections')
  const connJson = await connRes.json()
  const unisphereConn = connJson.data?.find((c: any) => c.type === 'unisphere')
  if (!unisphereConn) return []

  const vmsRes = await fetch(`/api/v1/vms?connId=${unisphereConn.id}`)
  if (!vmsRes?.ok) return []
  const vmsJson = await vmsRes.json()
  const guests = vmsJson?.data?.vms || []

  return Promise.all(
    guests.slice(0, 30).map(async (vm: any) => {
      try {
        const [configRes, rulesRes] = await Promise.all([
          fetch(`/api/v1/connections/${unisphereConn.id}/guests/${vm.type}/${vm.node}/${vm.vmid}/config`),
          fetch(`/api/v1/firewall/vms/${unisphereConn.id}/${vm.node}/${vm.type}/${vm.vmid}?type=rules`).catch(() => null)
        ])

        let firewallEnabled = false
        if (configRes.ok) {
          const configJson = await configRes.json()
          const config = configJson?.data || {}
          for (let i = 0; i < 10; i++) {
            const netConfig = config[`net${i}`]
            if (netConfig && typeof netConfig === 'string' && netConfig.includes('firewall=1')) {
              firewallEnabled = true
              break
            }
          }
        }

        let rules: any[] = []
        let hasSG = false
        if (rulesRes?.ok) {
          rules = await rulesRes.json()
          if (Array.isArray(rules)) hasSG = rules.some((r: any) => r.type === 'group')
        }

        return { ...vm, firewallEnabled, hasRules: Array.isArray(rules) && rules.length > 0, hasSG }
      } catch {
        return { ...vm, firewallEnabled: false, hasRules: false, hasSG: false }
      }
    })
  )
}

export function useVMFirewallCoverage(isEnterprise: boolean) {
  const refreshInterval = useRefreshInterval(60000)
  return useSWR(
    isEnterprise ? 'zero-trust/vm-coverage' : null,
    vmFirewallCoverageFetcher,
    { refreshInterval }
  )
}
