import { NextRequest, NextResponse } from "next/server"

import { getSessionPrisma } from "@/lib/tenant"
import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { formatBytes, formatUptime } from "@/utils/format"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

function round1(n: number) {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

const hostSelect = {
  id: true,
  node: true,
  ip: true,
  sshAddress: true,
  displayName: true,
  enabled: true,
  connectionId: true,
  idCluster: true,
  idDatacenter: true,
  tags: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * 查询 ManagedHost 列表
 * - idCluster 有值：按集群过滤
 * - 仅 idDatacenter 且 all=false：该数据中心下、尚未关联集群的主机
 * - all=true：全部（若同时有 idDatacenter 则限定该数据中心）
 */
async function listManagedHosts(req: NextRequest) {
  const idCluster =
    req.nextUrl.searchParams.get("idCluster")?.trim() ||
    req.nextUrl.searchParams.get("clusterId")?.trim() ||
    ""
  const idDatacenter =
    req.nextUrl.searchParams.get("idDatacenter")?.trim() ||
    req.nextUrl.searchParams.get("datacenterId")?.trim() ||
    ""
  const allParam = (req.nextUrl.searchParams.get("all") || "false").toLowerCase()
  const all = allParam === "true" || allParam === "1"

  const where: {
    idCluster?: string | null
    idDatacenter?: string
  } = {}

  if (idCluster) {
    where.idCluster = idCluster
  } else if (idDatacenter) {
    where.idDatacenter = idDatacenter
    if (!all) {
      where.idCluster = null
    }
  } else if (!all) {
    return NextResponse.json(
      {
        error:
          "provide idCluster, or idDatacenter (all=false → unassigned to cluster), or all=true",
      },
      { status: 400 },
    )
  }

  const rows = await prisma.managedHost.findMany({
    where: where as any,
    orderBy: [{ node: "asc" }],
    select: hostSelect,
  })

  return NextResponse.json({ data: rows })
}

/** 原逻辑：从 UNISPHERE 连接实时拉取主机资源 */
async function listHostsFromUnisphere(req: NextRequest) {
  const sessionPrisma = await getSessionPrisma()
  const connIdFilter = req.nextUrl.searchParams.get("connId")

  const connections = await sessionPrisma.connection.findMany({
    where: { type: "unisphere" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  })

  if (!connections.length) {
    return NextResponse.json({
      data: { hosts: [], stats: { total: 0, online: 0, offline: 0 } },
    })
  }

  const targetConnections =
    connIdFilter && connIdFilter !== "*"
      ? connections.filter((c) => c.id === connIdFilter)
      : connections

  const connectionPromises = targetConnections.map(async (conn) => {
    try {
      const connData = await getConnectionById(conn.id)

      if (!connData.baseUrl || !connData.apiToken) return []

      const resources = await unisphereFetch<any[]>(connData, "/cluster/resources")

      const nodes = resources.filter((r: any) => r?.type === "node")
      const isCluster = nodes.length > 1

      const nodeDetails = nodes.map((node: any) => {
        if (!node?.node) return null

        const cpuUsage = Number(node.cpu || 0)
        const memUsed = Number(node.mem || 0)
        const memMax = Number(node.maxmem || 0)
        const diskUsed = Number(node.disk || 0)
        const diskMax = Number(node.maxdisk || 0)
        const uptime = Number(node.uptime || 0)

        return {
          id: `${conn.id}:${node.node}`,
          connId: conn.id,
          connectionName: conn.name,
          scope: isCluster ? "cluster" : "standalone",
          node: node.node,
          status: node.status || "unknown",
          cpu: round1(cpuUsage * 100),
          cpuCores: 0,
          ram: memMax > 0 ? round1((memUsed / memMax) * 100) : 0,
          ramUsed: memUsed,
          ramMax: memMax,
          ramUsedFormatted: formatBytes(memUsed),
          ramMaxFormatted: formatBytes(memMax),
          disk: diskMax > 0 ? round1((diskUsed / diskMax) * 100) : 0,
          diskUsed,
          diskMax,
          diskUsedFormatted: formatBytes(diskUsed),
          diskMaxFormatted: formatBytes(diskMax),
          uptime,
          uptimeFormatted: formatUptime(uptime),
        }
      })

      return nodeDetails.filter((n): n is NonNullable<typeof n> => n !== null)
    } catch (e) {
      console.error(`[hosts] Error fetching connection ${conn.id}:`, e)
      return []
    }
  })

  const results = await Promise.all(connectionPromises)
  const allHosts = results.flat()

  allHosts.sort((a, b) => a.node.localeCompare(b.node))

  return NextResponse.json({
    data: {
      hosts: allHosts,
      stats: {
        total: allHosts.length,
        online: allHosts.filter((h) => h.status === "online").length,
        offline: allHosts.filter((h) => h.status !== "online").length,
      },
    },
  })
}

/**
 * GET /api/v1/hosts
 * - 带 idCluster / idDatacenter / all=true：查 ManagedHost 库表
 * - 否则：实时拉 UNISPHERE 主机（可用 connId 过滤）
 */
export async function GET(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.NODE_VIEW)
    if (denied) return denied

    const sp = req.nextUrl.searchParams
    const hasDbFilter =
      !!sp.get("idCluster")?.trim() ||
      !!sp.get("idDatacenter")?.trim() ||
      ["true", "1"].includes((sp.get("all") || "").toLowerCase())

    if (hasDbFilter) {
      return listManagedHosts(req)
    }

    return listHostsFromUnisphere(req)
  } catch (e: any) {
    console.error("[hosts] Error:", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * POST /api/v1/hosts
 * 接入 UNISPHERE 主机：关联数据中心 / 集群到 ManagedHost
 * body: { idHost, idDatacenter, idCluster }
 */
export async function POST(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const idHost =
      typeof body?.idHost === "string"
        ? body.idHost.trim() : ""
    let idDatacenter =
      typeof body?.idDatacenter === "string"
        ? body.idDatacenter.trim() : ""
    let idCluster =
      typeof body?.idCluster === "string"
        ? body.idCluster.trim() : ""

    if (!idHost || (!idDatacenter && !idCluster)) {
      return NextResponse.json(
        { error: "idHost, idDatacenter or idCluster are required" },
        { status: 400 },
      )
    }

    const host = await prisma.managedHost.findUnique({ where: { id: idHost } })
    if (!host) {
      return NextResponse.json({ error: "host not found" }, { status: 404 })
    }
    if (idCluster) {
      const cluster = await prisma.cluster.findUnique({
        where: { id: idCluster },
        select: { id: true, idDatacenter: true },
      })
      if (!cluster) {
        return NextResponse.json({ error: "cluster not found" }, { status: 404 })
      }
      idDatacenter = cluster.idDatacenter || ""
    } else if (idDatacenter) {
      const datacenter = await prisma.datacenter.findUnique({
        where: { id: idDatacenter },
        select: { id: true },
      })
      if (!datacenter) {
        return NextResponse.json({ error: "datacenter not found" }, { status: 404 })
      }
    }

    const row = await prisma.managedHost.update({
      where: { id: idHost },
      data: { idDatacenter, idCluster },
      select: hostSelect,
    })

    return NextResponse.json({ success: true, data: row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
