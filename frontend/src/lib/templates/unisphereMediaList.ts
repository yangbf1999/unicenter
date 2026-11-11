import { getConnectionById } from "@/lib/connections/getConnection"
import { unisphereFetch } from "@/lib/esage/client"
import { prisma as globalPrisma } from "@/lib/db/prisma"
import { getSessionPrisma, getCurrentTenantId } from "@/lib/tenant"
import {
  getTenantInfrastructureScope,
  inventoryConnectionPlan,
  maskingScope,
} from "@/lib/tenant/infraScope"
import { formatBytes } from "@/utils/format"

export type UnisphereMediaKind = "vm" | "iso" | "vztmpl"

export type PaginationParams = {
  page: number
  pageSize: number
}

export function parsePagination(url: URL): PaginationParams {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = Number.parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "20", 10)
  const pageSize = Math.min(200, Math.max(1, Number.isFinite(rawSize) ? rawSize : 20))
  return { page, pageSize }
}

export function paginate<T>(items: T[], { page, pageSize }: PaginationParams) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  }
}

type ConnMeta = { id: string; name: string; tenantId: string }

export async function listUnisphereConnections(opts: {
  connId?: string | null
  ignoreVdcContext?: boolean
}): Promise<ConnMeta[]> {
  const tenantId = await getCurrentTenantId()
  const infra = await getTenantInfrastructureScope(tenantId, {
    ignoreVdcContext: opts.ignoreVdcContext === true,
  })
  const plan = inventoryConnectionPlan(infra)
  const sessionPrisma = await getSessionPrisma()
  const connPrisma = plan.unisphereClient === "global" ? globalPrisma : sessionPrisma

  let connections = await connPrisma.connection.findMany({
    where: { type: "unisphere" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, tenantId: true },
  })

  if (plan.unisphereConnectionIds) {
    const allowed = new Set(plan.unisphereConnectionIds)
    connections = connections.filter((c) => allowed.has(c.id))
  }

  if (opts.connId && opts.connId !== "*") {
    connections = connections.filter((c) => c.id === opts.connId)
  }

  return connections
}

function isTemplateFlag(v: unknown): boolean {
  return v === 1 || v === true || v === "1"
}

function contentTypesOf(config: any): string[] {
  if (!config?.content) return []
  return String(config.content)
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
}

function storageAllowed(
  scope: ReturnType<typeof maskingScope>,
  connId: string,
  storage: string,
): boolean {
  if (!scope) return true
  const allowed = scope.storagesByConnection.get(connId)
  return !!allowed && allowed.has(storage)
}

/** 虚拟机/容器模板：各连接 /cluster/resources，筛 template=true */
export async function collectVmTemplates(opts: {
  connections: ConnMeta[]
  node?: string | null
  search?: string | null
  guestType?: "qemu" | "lxc" | null
}) {
  const all: any[] = []

  await Promise.all(
    opts.connections.map(async (conn) => {
      try {
        const connData = await getConnectionById(conn.id, conn.tenantId)
        const raw = await unisphereFetch<any[]>(connData, "/cluster/resources?type=vm")
        for (const r of raw || []) {
          if (!isTemplateFlag(r?.template)) continue
          if (r?.type !== "qemu" && r?.type !== "lxc") continue
          if (opts.guestType && r.type !== opts.guestType) continue
          if (opts.node && String(r.node || "") !== opts.node) continue

          const name = String(r.name || `${r.type}/${r.vmid}`)
          if (opts.search) {
            const q = opts.search.toLowerCase()
            const hay = `${name} ${r.vmid} ${r.node} ${r.type}`.toLowerCase()
            if (!hay.includes(q)) continue
          }

          all.push({
            id: `${conn.id}:${r.type}:${r.node}:${r.vmid}`,
            connId: conn.id,
            connectionName: conn.name,
            type: r.type,
            node: r.node || "",
            vmid: String(r.vmid ?? ""),
            name,
            status: r.status || "unknown",
            template: true,
            maxmem: Number(r.maxmem || 0),
            maxdisk: Number(r.maxdisk || 0),
            maxcpu: Number(r.maxcpu || 0),
            tags: r.tags ? String(r.tags).split(/[;,]/).filter(Boolean) : [],
            pool: r.pool || null,
          })
        }
      } catch (e) {
        console.error(`[templates/vm] connection ${conn.id}:`, e)
      }
    }),
  )

  all.sort((a, b) => {
    const byName = String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })
    if (byName !== 0) return byName
    return Number(a.vmid) - Number(b.vmid)
  })

  return all
}

/** ISO / CT 模板：遍历连接 → 节点 × 支持该 content 的存储 */
export async function collectStorageContent(opts: {
  connections: ConnMeta[]
  content: "iso" | "vztmpl"
  node?: string | null
  storage?: string | null
  search?: string | null
  ignoreVdcContext?: boolean
}) {
  const tenantId = await getCurrentTenantId()
  const infra = await getTenantInfrastructureScope(tenantId, {
    ignoreVdcContext: opts.ignoreVdcContext === true,
  })
  const scope = maskingScope(infra)
  const all: any[] = []

  await Promise.all(
    opts.connections.map(async (conn) => {
      try {
        const connData = await getConnectionById(conn.id, conn.tenantId)
        const [configs, resources, nodes] = await Promise.all([
          unisphereFetch<any[]>(connData, "/storage").catch(() => [] as any[]),
          unisphereFetch<any[]>(connData, "/cluster/resources?type=storage").catch(() => [] as any[]),
          unisphereFetch<any[]>(connData, "/nodes").catch(() => [] as any[]),
        ])

        const configMap = new Map<string, any>()
        for (const cfg of configs || []) {
          if (cfg?.storage) configMap.set(String(cfg.storage), cfg)
        }

        const onlineNodes = new Set(
          (nodes || [])
            .filter((n: any) => n?.status === "online" && n?.node)
            .map((n: any) => String(n.node)),
        )

        // storageKey → nodes that expose it (from cluster resources)
        const storageNodes = new Map<string, Set<string>>()
        for (const r of resources || []) {
          if (r?.type !== "storage" || !r.storage || !r.node) continue
          const key = String(r.storage)
          if (!storageNodes.has(key)) storageNodes.set(key, new Set())
          storageNodes.get(key)!.add(String(r.node))
        }

        const targets: Array<{ storage: string; node: string; shared: boolean }> = []
        const seenShared = new Set<string>()

        for (const [storageName, cfg] of configMap) {
          const types = contentTypesOf(cfg)
          if (!types.includes(opts.content)) continue
          if (opts.storage && storageName !== opts.storage) continue
          if (!storageAllowed(scope, conn.id, storageName)) continue

          const shared = cfg.shared === 1 || cfg.shared === true
          const nodesForStorage = [...(storageNodes.get(storageName) || onlineNodes)]

          if (shared) {
            if (seenShared.has(storageName)) continue
            const pick =
              (opts.node && nodesForStorage.includes(opts.node) ? opts.node : null) ||
              nodesForStorage.find((n) => onlineNodes.has(n)) ||
              nodesForStorage[0]
            if (!pick) continue
            if (opts.node && pick !== opts.node) continue
            seenShared.add(storageName)
            targets.push({ storage: storageName, node: pick, shared: true })
          } else {
            for (const node of nodesForStorage) {
              if (opts.node && node !== opts.node) continue
              if (onlineNodes.size && !onlineNodes.has(node)) continue
              targets.push({ storage: storageName, node, shared: false })
            }
          }
        }

        await Promise.all(
          targets.map(async ({ storage, node, shared }) => {
            try {
              const items = await unisphereFetch<any[]>(
                connData,
                `/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/content?content=${opts.content}`,
                {},
                { timeoutMs: 30_000 },
              )
              for (const item of items || []) {
                const volid = String(item.volid || "")
                const filename = volid.includes("/") ? volid.slice(volid.lastIndexOf("/") + 1) : volid
                if (opts.search) {
                  const q = opts.search.toLowerCase()
                  if (!`${volid} ${filename} ${node} ${storage}`.toLowerCase().includes(q)) continue
                }
                const size = Number(item.size || 0)
                all.push({
                  id: `${conn.id}:${volid}:${node}`,
                  connId: conn.id,
                  connectionName: conn.name,
                  node,
                  storage,
                  shared,
                  content: item.content || opts.content,
                  volid,
                  filename,
                  format: item.format || null,
                  size,
                  sizeFormatted: formatBytes(size),
                  ctime: item.ctime ?? null,
                })
              }
            } catch (e) {
              console.error(`[templates/${opts.content}] ${conn.id}/${node}/${storage}:`, e)
            }
          }),
        )
      } catch (e) {
        console.error(`[templates/${opts.content}] connection ${conn.id}:`, e)
      }
    }),
  )

  all.sort((a, b) => String(a.filename).localeCompare(String(b.filename), undefined, { sensitivity: "base" }))
  return all
}
