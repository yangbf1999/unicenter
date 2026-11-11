import { NextResponse } from "next/server"

import { getSessionPrisma, getCurrentTenantId } from "@/lib/tenant"
import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { getRBACContext, filterVmsByPermission, PERMISSIONS, checkPermission } from "@/lib/rbac"
import { formatBytes, formatUptime } from "@/utils/format"
import { getTenantInfrastructureScope, inventoryConnectionPlan, maskingScope } from "@/lib/tenant/infraScope"
import { prisma as globalPrisma } from "@/lib/db/prisma"
import { enrichVmsWithConfig } from "@/lib/inventory/vmConfig"
import { attachGuestIps } from "@/lib/inventory/guestIpIndex"
import { withPublicApiGuard, type GuardedRouteContext } from "@/lib/api-tokens/routeGuard"
import { restrictToTokenScope } from "@/lib/api-tokens/scope"

export const runtime = "nodejs"

/**
 * GET /api/v1/vms
 *
 * API agrégée qui retourne toutes les VMs et LXCs de toutes les connexions UNISPHERE.
 * Optimisé pour charger toutes les données en parallèle.
 * Les IPs sont chargées séparément via /api/v1/vms/ips pour ne pas ralentir.
 * `ips`/`macs` (recherche, #223/#861) viennent de la config déjà lue plus de
 * l'index d'adresses live rafraîchi en arrière-plan : jamais d'appel bloquant.
 *
 * Query:
 * - idHost / hostId / managedHostId: 按 ManagedHost 过滤到单节点
 * - type: 可选。VM=虚拟机(qemu)，RQ=容器(lxc)；不传则两者都返回
 */

function round1(n: number) {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

/** type=VM → qemu；type=RQ → lxc；不传/空 → null（不过滤） */
function parseGuestTypeFilter(raw: string | null): "qemu" | "lxc" | null {
  const t = (raw || "").trim().toUpperCase()
  if (!t) return null
  if (t === "VM" || t === "QEMU") return "qemu"
  if (t === "RQ" || t === "LXC" || t === "CT") return "lxc"
  return null
}

function applyGuestTypeFilter<T extends { type?: string }>(
  vms: T[],
  guestType: "qemu" | "lxc" | null,
): T[] {
  if (!guestType) return vms
  return vms.filter((v) => String(v.type || "").toLowerCase() === guestType)
}

function mapResourceToVm(
  conn: { id: string; name: string },
  r: any,
  isCluster: boolean,
) {
  const cpuPct = round1(Number(r.cpu || 0) * 100)
  const ramPct = r.maxmem ? round1((Number(r.mem || 0) / Number(r.maxmem)) * 100) : 0

  return {
    id: `${conn.id}:${r.type}:${r.node}:${r.vmid}`,
    connId: conn.id,
    connectionName: conn.name,
    scope: isCluster ? "cluster" : "standalone",
    type: r.type || "qemu",
    node: r.node || "",
    host: r.node || "-",
    vmid: String(r.vmid || r.id || ""),
    name: r.name || `${r.type}/${r.vmid}`,
    status: r.status || "unknown",
    cpu: cpuPct,
    ram: ramPct,
    ramUsed: Number(r.mem || 0),
    ramMax: Number(r.maxmem || 0),
    maxmem: Number(r.maxmem || 0),
    maxdisk: Number(r.maxdisk || 0),
    ramUsedFormatted: formatBytes(Number(r.mem || 0)),
    ramMaxFormatted: formatBytes(Number(r.maxmem || 0)),
    diskGb: round1(Number(r.maxdisk || 0) / 1073741824),
    uptime: formatUptime(r.uptime),
    uptimeSeconds: Number(r.uptime || 0),
    template: r.template === 1,
    tags: r.tags ? String(r.tags).split(";").filter(Boolean) : [],
    pool: r.pool || null,
    netvmid: r.netvmid,
    lock: r.lock || undefined,
    ip: null as string | null,
  }
}

function buildVmStats(allVms: any[]) {
  return {
    total: allVms.length,
    running: allVms.filter((v) => v.status === "running").length,
    stopped: allVms.filter((v) => v.status === "stopped").length,
    paused: allVms.filter((v) => v.status === "paused").length,
    templates: allVms.filter((v) => v.template).length,
    qemu: allVms.filter((v) => v.type === "qemu").length,
    lxc: allVms.filter((v) => v.type === "lxc").length,
  }
}

/**
 * 按 ManagedHost.id 查该主机上的虚拟机/容器。
 * ManagedHost.connectionId = UNISPHERE 连接 ID；ManagedHost.node = UNISPHERE 节点名。
 */
async function listVmsByManagedHost(
  req: Request,
  ctx: GuardedRouteContext,
  idHost: string,
  guestType: "qemu" | "lxc" | null,
) {
  const includeAgent = new URL(req.url).searchParams.get("include") === "agent"

  const host = await globalPrisma.managedHost.findUnique({
    where: { id: idHost },
    select: {
      id: true,
      connectionId: true,
      node: true,
      displayName: true,
      idCluster: true,
      idDatacenter: true,
    },
  })
  if (!host) {
    return NextResponse.json({ error: "ManagedHost not found" }, { status: 404 })
  }
  if (!host.connectionId) {
    return NextResponse.json(
      { error: "ManagedHost.connectionId (UNISPHERE connection id) is missing" },
      { status: 400 },
    )
  }
  if (!host.node) {
    return NextResponse.json(
      { error: "ManagedHost.node (UNISPHERE node name) is missing" },
      { status: 400 },
    )
  }

  // Token perimeter: connection must be in scope
  const scoped = await restrictToTokenScope(
    [{ id: host.connectionId }],
    ctx?.principal,
  )
  if (!scoped.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const connMeta = await globalPrisma.connection.findUnique({
    where: { id: host.connectionId },
    select: { id: true, name: true, tenantId: true, type: true },
  })
  if (!connMeta || connMeta.type !== "unisphere") {
    return NextResponse.json(
      { error: "UNISPHERE connection not found for ManagedHost.connectionId" },
      { status: 404 },
    )
  }

  const connData = await getConnectionById(connMeta.id, connMeta.tenantId)
  if (!connData.baseUrl || !connData.apiToken) {
    return NextResponse.json({ error: "Connection config incomplete" }, { status: 500 })
  }

  const [resourcesResult, nodesResult] = await Promise.allSettled([
    unisphereFetch<any[]>(connData, "/cluster/resources?type=vm"),
    unisphereFetch<any[]>(connData, "/nodes"),
  ])

  const resources = resourcesResult.status === "fulfilled" ? resourcesResult.value || [] : []
  const nodes = nodesResult.status === "fulfilled" ? nodesResult.value || [] : []
  const isCluster = nodes.length > 1
  const onlineNodes =
    nodesResult.status === "fulfilled"
      ? new Set(
          nodes
            .filter((n: any) => n?.status === "online" && n?.node)
            .map((n: any) => String(n.node)),
        )
      : null

  const onNode = resources.filter((r: any) => {
    if (String(r?.node || "") !== host.node) return false
    if (guestType) return r?.type === guestType
    return r?.type === "qemu" || r?.type === "lxc"
  })

  const mapped = onNode.map((r: any) => mapResourceToVm(connMeta, r, isCluster))
  const enriched = await enrichVmsWithConfig(connData, mapped, onlineNodes, { includeAgent })
  const { vms: withIps, warming } = attachGuestIps(connMeta.id, connData, enriched, {
    refresh: resourcesResult.status === "fulfilled",
  })

  let allVms = applyGuestTypeFilter(withIps, guestType)

  const rbacCtx = await getRBACContext()
  if (rbacCtx && !rbacCtx.isAdmin) {
    allVms = await filterVmsByPermission(
      rbacCtx.principal ?? (rbacCtx.userId as string),
      allVms,
      PERMISSIONS.VM_VIEW,
      rbacCtx.tenantId,
    )
  }

  const tenantId = await getCurrentTenantId()
  const infra = await getTenantInfrastructureScope(tenantId, {
    ignoreVdcContext: ctx?.principal?.kind === "token",
  })
  const vdcScope = maskingScope(infra)
  if (vdcScope) {
    allVms = allVms.filter((vm) => {
      const pools = vdcScope.poolsByConnection.get(vm.connId)
      if (!pools) return false
      return vm.pool != null && pools.has(vm.pool)
    })
  }

  allVms.sort((a, b) => {
    const aId = Number.parseInt(a.vmid, 10) || 0
    const bId = Number.parseInt(b.vmid, 10) || 0
    return aId - bId
  })

  return NextResponse.json({
    data: {
      host: {
        id: host.id,
        connectionId: host.connectionId,
        node: host.node,
        displayName: host.displayName,
        idCluster: host.idCluster,
        idDatacenter: host.idDatacenter,
      },
      vms: allVms,
      stats: buildVmStats(allVms),
      ipIndexWarming: warming,
    },
  })
}

async function handler(req: Request, ctx: GuardedRouteContext) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_VIEW)
    if (denied) return denied

    const url = new URL(req.url)
    const typeRaw = url.searchParams.get("type")
    const guestType = parseGuestTypeFilter(typeRaw)
    if (typeRaw?.trim() && !guestType) {
      return NextResponse.json(
        { error: "type must be VM (qemu) or RQ (lxc), or omitted" },
        { status: 400 },
      )
    }

    const idHost =
      url.searchParams.get("idHost")?.trim() ||
      url.searchParams.get("hostId")?.trim() ||
      url.searchParams.get("managedHostId")?.trim() ||
      ""

    if (idHost) {
      return listVmsByManagedHost(req, ctx, idHost, guestType)
    }

    const prisma = await getSessionPrisma()
    const connIdFilter = url.searchParams.get("connId")
    const includeAgent = url.searchParams.get("include") === "agent"

    // Resolve infrastructure scope once; used for both connection enumeration
    // and vDC masking later. Provider and MSP avoid calling getVdcScope.
    const tenantId = await getCurrentTenantId()
    // API tokens never depend on the browser view-context cookie
    // (shared cookie jar case) — global ruling n°4.
    const infra = await getTenantInfrastructureScope(tenantId, {
      ignoreVdcContext: ctx?.principal?.kind === "token",
    })
    const plan = inventoryConnectionPlan(infra)
    const connPrisma = plan.unisphereClient === "global" ? globalPrisma : prisma

    // Récupérer les connexions UNISPHERE
    let connections = await connPrisma.connection.findMany({
      where: { type: "unisphere" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, tenantId: true },
    })

    // For iaas, restrict to the vDC-referenced connection ids
    if (plan.unisphereConnectionIds) {
      const allowed = new Set(plan.unisphereConnectionIds)
      connections = connections.filter((c) => allowed.has(c.id))
    }

    // Aggregated route: the token connection perimeter is applied where we
    // ENUMERATE, because no connection id ever reaches checkPermission here
    // (spec section 6, allowlist review checklist D8). No-op for a session
    // caller (ctx.principal is only ever set for a token, see routeGuard.ts).
    connections = await restrictToTokenScope(connections, ctx?.principal)

    if (!connections.length) {
      return NextResponse.json({
        data: {
          vms: [],
          stats: { total: 0, running: 0, stopped: 0, paused: 0 },
        },
      })
    }

    // Filtrer si nécessaire
    const targetConnections =
      connIdFilter && connIdFilter !== "*"
        ? connections.filter((c) => c.id === connIdFilter)
        : connections

    // True while a connection's address index is being built for the first
    // time: the palette re-fetches once so the IPs show up without a reload.
    let ipIndexWarming = false

    // Charger toutes les connexions EN PARALLÈLE
    const connectionPromises = targetConnections.map(async (conn) => {
      try {
        const connData = await getConnectionById(conn.id, (conn as any).tenantId)

        if (!connData.baseUrl || !connData.apiToken) return []

        // Charger cluster/resources et nodes en parallèle
        const [resourcesResult, nodesResult] = await Promise.allSettled([
          unisphereFetch<any[]>(connData, "/cluster/resources?type=vm"),
          unisphereFetch<any[]>(connData, "/nodes"),
        ])

        const resources =
          resourcesResult.status === "fulfilled" ? resourcesResult.value || [] : []
        // A rejected /nodes leaves node status UNKNOWN, not "everyone offline":
        // `onlineNodes` stays null so enrichVmsWithConfig attempts the /config
        // call instead of fabricating nulls for a connection that is otherwise
        // reachable (resources succeeded).
        const nodes = nodesResult.status === "fulfilled" ? nodesResult.value || [] : []

        const isCluster = nodes.length > 1
        const onlineNodes =
          nodesResult.status === "fulfilled"
            ? new Set(
                nodes
                  .filter((n: any) => n?.status === "online" && n?.node)
                  .map((n: any) => String(n.node)),
              )
            : null

        const mapped = resources.map((r: any) => mapResourceToVm(conn, r, isCluster))

        const enriched = await enrichVmsWithConfig(connData, mapped, onlineNodes, {
          includeAgent,
        })
        // A rejected /cluster/resources gave an EMPTY `mapped`: reading the
        // index is fine, rebuilding it from that list is not.
        const { vms: withIps, warming } = attachGuestIps(conn.id, connData, enriched, {
          refresh: resourcesResult.status === "fulfilled",
        })
        if (warming) ipIndexWarming = true

        return withIps
      } catch (e) {
        console.error(`[vms] Error fetching connection ${conn.id}:`, e)

        return []
      }
    })

    const results = await Promise.all(connectionPromises)
    let allVms = results.flat()

    // RBAC: Filtrer les VMs selon les permissions
    const rbacCtx = await getRBACContext()

    if (rbacCtx && !rbacCtx.isAdmin) {
      allVms = await filterVmsByPermission(
        rbacCtx.principal ?? (rbacCtx.userId as string),
        allVms,
        PERMISSIONS.VM_VIEW,
        rbacCtx.tenantId,
      )
    }

    // vDC filtering: restrict VMs to those in the tenant's vDC pools
    // (infra and tenantId already resolved above)
    const vdcScope = maskingScope(infra)

    if (vdcScope) {
      allVms = allVms.filter((vm) => {
        const pools = vdcScope.poolsByConnection.get(vm.connId)
        if (!pools) return false // connection not in any vDC
        return vm.pool != null && pools.has(vm.pool)
      })
    }

    allVms = applyGuestTypeFilter(allVms, guestType)

    // Trier par vmid
    allVms.sort((a, b) => {
      const aId = Number.parseInt(a.vmid, 10) || 0
      const bId = Number.parseInt(b.vmid, 10) || 0

      return aId - bId
    })

    return NextResponse.json({
      data: {
        vms: allVms,
        stats: buildVmStats(allVms),
        ipIndexWarming,
      },
    })
  } catch (e: any) {
    console.error("[vms] Error:", e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export const GET = withPublicApiGuard("vms-list", handler)
