import { NextRequest, NextResponse } from "next/server"

import { getSessionPrisma } from "@/lib/tenant"
import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

type ClusterListItem = {
  id: string
  name: string
  status: "healthy" | "degraded" | "down"
  nodes: number
  nodesOnline: number
  cpuUsagePct: number
  ramUsagePct: number
  isCluster: boolean
}

function round1(n: number) {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

/** 未传数据中心 ID 时：从已配置 UNISPHERE 连接实时拉取集群列表（原 GET 逻辑） */
async function listClustersFromUnisphereConnections(): Promise<
  NextResponse<{ data: ClusterListItem[] } | { data: []; error: string }>
> {
  const sessionPrisma = await getSessionPrisma()
  const connections = await sessionPrisma.connection.findMany({
    where: { type: "unisphere" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  })

  if (!connections.length) {
    return NextResponse.json(
      { data: [], error: "No UNISPHERE connections configured. Create one via POST /api/v1/connections." },
      { status: 200 },
    )
  }

  const allResults: ClusterListItem[] = await Promise.all(
    connections.map(async (c): Promise<ClusterListItem> => {
      try {
        const connData = await getConnectionById(c.id)

        if (!connData.baseUrl || !connData.apiToken) {
          throw new Error("Missing connection config")
        }

        const [nodesResult, statusResult] = await Promise.allSettled([
          unisphereFetch<any[]>(connData, "/nodes"),
          unisphereFetch<any[]>(connData, "/cluster/status"),
        ])

        const nodes = nodesResult.status === "fulfilled" ? nodesResult.value || [] : []
        const status = statusResult.status === "fulfilled" ? statusResult.value || [] : []

        const clusterRow = status.find((x: any) => x?.type === "cluster")
        const clusterName = clusterRow?.name || c.name || c.id

        const nodeCount = nodes.length
        const onlineNodes = nodes.filter((n: any) => n.status === "online").length
        const isCluster = nodeCount > 1

        let totalCpu = 0
        let totalMem = 0
        let totalMaxMem = 0

        for (const node of nodes) {
          totalCpu += Number(node.cpu || 0)
          totalMem += Number(node.mem || 0)
          totalMaxMem += Number(node.maxmem || 0)
        }

        const avgCpu = nodeCount > 0 ? round1((totalCpu / nodeCount) * 100) : 0
        const ramPct = totalMaxMem > 0 ? round1((totalMem / totalMaxMem) * 100) : 0

        let health: "healthy" | "degraded" | "down" = "down"
        if (onlineNodes === nodeCount && nodeCount > 0) {
          health = "healthy"
        } else if (onlineNodes > 0) {
          health = "degraded"
        }

        return {
          id: c.id,
          name: clusterName,
          status: health,
          nodes: nodeCount,
          nodesOnline: onlineNodes,
          cpuUsagePct: avgCpu,
          ramUsagePct: ramPct,
          isCluster,
        }
      } catch (e: any) {
        console.error(`[clusters] failed for ${c.id}:`, e?.message || e)
        return {
          id: c.id,
          name: c.name ?? c.id,
          status: "down",
          nodes: 0,
          nodesOnline: 0,
          cpuUsagePct: 0,
          ramUsagePct: 0,
          isCluster: false,
        }
      }
    }),
  )

  const results = allResults.filter((c) => c.isCluster)
  return NextResponse.json({ data: results })
}

/**
 * GET /api/v1/clusters
 * - 无 idDatacenter：实时拉取 UNISPHERE 连接上的集群
 * - 有 idDatacenter：查库 clusters 表
 */
export async function GET(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.CONNECTION_VIEW)
    if (denied) return denied

    const idDatacenter =
      req.nextUrl.searchParams.get("idDatacenter")?.trim() ||
      req.nextUrl.searchParams.get("datacenterId")?.trim() ||
      ""

    if (!idDatacenter) {
      return listClustersFromUnisphereConnections()
    }

    const rows = await prisma.cluster.findMany({
      where: { idDatacenter },
      orderBy: { name: "asc" },
      select: { id: true, name: true, idDatacenter: true },
    })

    return NextResponse.json({ data: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * POST /api/v1/clusters
 * body: { name, idDatacenter }
 */
export async function POST(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const idDatacenter =
      typeof body?.idDatacenter === "string"
        ? body.idDatacenter.trim()
        : typeof body?.datacenterId === "string"
          ? body.datacenterId.trim()
          : ""

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    if (!idDatacenter) {
      return NextResponse.json({ error: "idDatacenter is required" }, { status: 400 })
    }

    const dc = await prisma.datacenter.findUnique({
      where: { id: idDatacenter },
      select: { id: true },
    })
    if (!dc) {
      return NextResponse.json({ error: "datacenter not found" }, { status: 404 })
    }

    const row = await prisma.cluster.create({
      data: { name, idDatacenter },
      select: { id: true, name: true, idDatacenter: true },
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * PUT /api/v1/clusters
 * body: { id, name?, idDatacenter? }
 */
export async function PUT(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const id = typeof body?.id === "string" ? body.id.trim() : ""
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const existing = await prisma.cluster.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "cluster not found" }, { status: 404 })
    }

    const data: { name?: string; idDatacenter?: string } = {}
    if (typeof body?.name === "string" && body.name.trim()) {
      data.name = body.name.trim()
    }
    const nextDc =
      typeof body?.idDatacenter === "string"
        ? body.idDatacenter.trim()
        : typeof body?.datacenterId === "string"
          ? body.datacenterId.trim()
          : ""
    if (nextDc) {
      const dc = await prisma.datacenter.findUnique({
        where: { id: nextDc },
        select: { id: true },
      })
      if (!dc) {
        return NextResponse.json({ error: "datacenter not found" }, { status: 404 })
      }
      data.idDatacenter = nextDc
    }

    if (!data.name && !data.idDatacenter) {
      return NextResponse.json(
        { error: "name or idDatacenter is required to update" },
        { status: 400 },
      )
    }

    const row = await prisma.cluster.update({
      where: { id },
      data,
      select: { id: true, name: true, idDatacenter: true },
    })

    return NextResponse.json({ success: true, data: row })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * DELETE /api/v1/clusters?id=...  或 body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied

    const body = await req.json().catch(() => null)
    const id =
      req.nextUrl.searchParams.get("id")?.trim() ||
      (typeof body?.id === "string" ? body.id.trim() : "")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const existing = await prisma.cluster.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "cluster not found" }, { status: 404 })
    }

    await prisma.cluster.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
