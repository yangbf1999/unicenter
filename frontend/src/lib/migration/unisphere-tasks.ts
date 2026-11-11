import { unisphereFetch } from "@/lib/esage/client"

type UnisphereConn = { baseUrl: string; apiToken: string; insecureDev: boolean; id: string }

/** Wait for a UNISPHERE task to complete */
export async function waitForUnisphereTask(conn: UnisphereConn, node: string, upid: string, timeoutMs = 300000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await unisphereFetch<any>(
      conn,
      `/nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/status`
    )
    if (status?.status === "stopped") {
      if (status.exitstatus === "OK") return
      throw new Error(`UNISPHERE task failed: ${status.exitstatus || "unknown error"}`)
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error(`UNISPHERE task timed out after ${timeoutMs / 1000}s`)
}

/**
 * Find the IP address of a eSage node for SSH access.
 * Tries managed hosts first, then extracts from baseUrl.
 */
export async function getNodeIpForMigration(db: any, connectionId: string, nodeName: string, baseUrl: string): Promise<string> {
  const host = await db.managedHost.findFirst({
    where: { connectionId, node: nodeName, enabled: true },
    select: { ip: true, sshAddress: true },
  })
  if (host?.sshAddress) return host.sshAddress
  if (host?.ip) return host.ip
  try {
    return new URL(baseUrl).hostname
  } catch {
    throw new Error(`Cannot determine IP for node ${nodeName}`)
  }
}
