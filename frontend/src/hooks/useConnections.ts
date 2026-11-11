import { useState, useEffect } from 'react'
import { useSWRFetch } from './useSWRFetch'

export function useConnections(type?: 'unisphere' | 'pbs') {
  const url = type ? `/api/v1/connections?type=${type}` : '/api/v1/connections'
  return useSWRFetch(url, { revalidateOnFocus: true })
}

export function useUNISPHEREConnections() {
  return useConnections('unisphere')
}

export function usePBSConnections() {
  return useConnections('pbs')
}

/**
 * Returns only UNISPHERE connections that are clusters (2+ nodes).
 * Standalone single-node hosts are filtered out.
 */
export function useClusterConnections() {
  const { data: connectionsData, ...rest } = useUNISPHEREConnections()
  const [filteredData, setFilteredData] = useState<typeof connectionsData>(undefined)

  useEffect(() => {
    if (!connectionsData?.data) {
      setFilteredData(undefined)
      return
    }

    const connections = connectionsData.data
    if (connections.length === 0) {
      setFilteredData({ data: [] })
      return
    }

    let cancelled = false
    setFilteredData(undefined)

    Promise.all(
      connections.map(async (conn: any) => {
        try {
          const res = await fetch(`/api/v1/connections/${conn.id}/nodes`)
          if (!res.ok) return null
          const json = await res.json()
          return (json?.data?.length ?? 0) >= 2 ? conn : null
        } catch {
          return null
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setFilteredData({ data: results.filter(Boolean) })
      }
    })

    return () => { cancelled = true }
  }, [connectionsData])

  return { ...rest, data: filteredData }
}
