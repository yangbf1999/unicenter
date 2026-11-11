// src/lib/vdc/sdn.ts
// eSage SDN zone + VNet CRUD for vDCs.

import crypto from 'crypto'

import { prisma } from '@/lib/db/prisma'
import { unisphereFetch } from '@/lib/esage/client'

import type { SdnVnet } from './types'

// ---------------------------------------------------------------------------
// Zone name generation
// ---------------------------------------------------------------------------

// UNISPHERE caps SDN zone IDs at 8 characters total (cluster check, not just our
// preference). The previous 14-char strip was a leftover from an earlier
// schema and broke the moment slugs got longer than ~7 chars after the
// switch to <tenantSlug>-<connectionSlug> auto-derivation. Keep the
// sanitiser pure here; the call sites cap to whatever fits below.
function stripSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]/g, '')
}

const ZONE_MAX_LEN = 8         // UNISPHERE hard limit on /cluster/sdn/zones
const ZONE_HASH_LEN = 2        // collision suffix length (hex)

interface ZoneNameInput { id: string; slug: string }

async function isZoneNameTaken(connectionId: string, sdnZoneName: string): Promise<boolean> {
  const row = await prisma.vdc.findFirst({
    where: { connectionId, sdnZoneName },
    select: { id: true },
  })
  return !!row
}

export async function generateZoneName(connectionId: string, vdc: ZoneNameInput): Promise<string> {
  // 'z' prefix + up to 7 slug chars = 8 total. We always reserve room for
  // the prefix even when the slug is tiny.
  const base = 'z' + stripSlug(vdc.slug).slice(0, ZONE_MAX_LEN - 1)

  if (!(await isZoneNameTaken(connectionId, base))) return base

  // Collision: drop two slug chars and append a 2-hex-char hash of the
  // vdc id so two vDCs with similar slugs on the same cluster don't
  // overlap. Total: 'z' (1) + 5 slug + 2 hash = 8.
  const hash = crypto.createHash('sha1').update(vdc.id).digest('hex').slice(0, ZONE_HASH_LEN)
  const slugRoom = ZONE_MAX_LEN - 1 - ZONE_HASH_LEN
  const withSuffix = 'z' + stripSlug(vdc.slug).slice(0, slugRoom) + hash

  if (await isZoneNameTaken(connectionId, withSuffix)) {
    throw new Error(`Cannot generate unique SDN zone name for vDC ${vdc.id} (slug=${vdc.slug})`)
  }
  return withSuffix
}


// ---------------------------------------------------------------------------
// UNISPHERE VNet ID generation
// ---------------------------------------------------------------------------
//
// UNISPHERE caps SDN VNet IDs at 8 characters AND requires them to be unique
// cluster-wide (across every zone, not per-zone). Forcing tenants to share
// that flat 8-char namespace is unusable in MSP — two tenants both naturally
// want a "lan" VNet. We decouple by storing a free-form display_name in the
// vDC namespace and computing a deterministic 8-char unisphere_name to send to UNISPHERE.
// UNISPHERE's own `alias` field carries the display_name so an admin debugging in
// the eSage GUI sees both ID and friendly label.

const UNISPHERE_VNET_ID_LEN = 8                // UNISPHERE hard limit
const UNISPHERE_VNET_ID_PREFIX = 'v'           // first char must be a letter
const UNISPHERE_VNET_ID_HEX_LEN = UNISPHERE_VNET_ID_LEN - UNISPHERE_VNET_ID_PREFIX.length

function hashVnetSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, UNISPHERE_VNET_ID_HEX_LEN)
}

export async function generateUnisphereVnetId(vdcId: string, displayName: string): Promise<string> {
  // Deterministic for the same (vdcId, displayName) pair so re-runs of a
  // failed create don't drift. Collision-check across the whole connection
  // (UNISPHERE's actual uniqueness scope), with up to 16 retries appending a nonce.
  const seedBase = `${vdcId}:${displayName}`

  // Resolve the connectionId of vdcId once so we can scope the uniqueness
  // check to "any vDC on the same UNISPHERE cluster".
  const ownerVdc = await prisma.vdc.findUnique({
    where: { id: vdcId },
    select: { connectionId: true },
  })
  if (!ownerVdc) {
    throw new Error(`generateUnisphereVnetId: vDC not found: ${vdcId}`)
  }

  for (let i = 0; i < 16; i++) {
    const seed = i === 0 ? seedBase : `${seedBase}#${i}`
    const candidate = UNISPHERE_VNET_ID_PREFIX + hashVnetSeed(seed)
    const collision = await prisma.vdcVnet.findFirst({
      where: { unisphereName: candidate, vdc: { connectionId: ownerVdc.connectionId } },
      select: { id: true },
    })
    if (!collision) return candidate
  }

  throw new Error(
    `Cannot generate a unique UNISPHERE VNet ID for vdc=${vdcId} displayName=${displayName} after 16 retries — extreme collision rate suggests a bug.`
  )
}

// ---------------------------------------------------------------------------
// VNI allocation (cluster-wide per UNISPHERE connection)
// ---------------------------------------------------------------------------

const VNI_BASE = 10000

export async function allocateVni(vdcId: string, conn?: any): Promise<number> {
  // VXLAN VNIs must be unique across the entire UNISPHERE cluster (transport is one
  // shared overlay), not just within a single vDC. Scoping by vdc_id caused
  // tenant A's first VNet (VNI 10000) to collide with tenant B's first VNet
  // (also 10000) on the same cluster → UNISPHERE returns a 400 on the second.
  const ownerVdc = await prisma.vdc.findUnique({
    where: { id: vdcId },
    select: { connectionId: true },
  })
  if (!ownerVdc) {
    throw new Error(`allocateVni: vDC not found: ${vdcId}`)
  }

  const aggregate = await prisma.vdcVnet.aggregate({
    where: { type: 'vxlan', vdc: { connectionId: ownerVdc.connectionId } },
    _max: { tag: true },
  })
  const dbMax = aggregate._max.tag

  // Our DB only knows the VNets UniCenter created. UNISPHERE can carry tags from
  // legacy zones (older UniCenter installs, manual `unispheresh` work, leftover
  // SDN config from a teardown that didn't roll back). Pull the live tag
  // set from `/cluster/sdn/vnets` when we have a connection so we don't
  // hand back a tag that UNISPHERE will reject with HTTP 400.
  let unisphereMax: number | null = null
  if (conn) {
    try {
      const vnets = await listVnetsUnisphere(conn)
      for (const v of vnets) {
        if (Number.isFinite(v.tag) && (unisphereMax === null || v.tag > unisphereMax)) {
          unisphereMax = v.tag
        }
      }
    } catch {
      // Best-effort: if the SDN endpoint is unreachable we still allocate
      // from the DB-side max — better than failing every VNet creation.
    }
  }

  const candidates = [dbMax, unisphereMax].filter((n): n is number => typeof n === 'number')
  if (candidates.length === 0) return VNI_BASE
  // UNISPHERE's /cluster/sdn/vnets set (unisphereMax) can carry VLAN tags (<= 4094)
  // alongside VXLAN VNIs, so a VLAN-only connection must not drag the next
  // VXLAN allocation below the VNI floor.
  const next = Math.max(...candidates) + 1
  return next < VNI_BASE ? VNI_BASE : next
}

// ---------------------------------------------------------------------------
// UNISPHERE SDN: apply pending changes
// ---------------------------------------------------------------------------

/**
 * Applies pending SDN changes: triggers ifreload on every node.
 * Should be called once at the end of a batch of SDN mutations.
 */
export async function applySdn(conn: any): Promise<void> {
  await unisphereFetch(conn, '/cluster/sdn', { method: 'PUT' })
}

// ---------------------------------------------------------------------------
// Zone CRUD
// ---------------------------------------------------------------------------

async function listClusterNodeIps(conn: any): Promise<string[]> {
  const entries = await unisphereFetch<any[]>(conn, '/cluster/status')
  return (entries || [])
    .filter((e: any) => e.type === 'node' && e.ip)
    .map((e: any) => e.ip as string)
}

export interface CreateZoneOptions { type?: 'vxlan' | 'vlan'; bridge?: string }

/**
 * Creates an SDN zone on UNISPHERE. Caller must invoke applySdn(conn) afterwards.
 * Default is the historical VXLAN zone (peers = every cluster node IP);
 * `{ type: 'vlan', bridge }` creates a VLAN zone bound to a physical bridge.
 */
export async function createZone(conn: any, zoneName: string, opts: CreateZoneOptions = {}): Promise<void> {
  const type = opts.type ?? 'vxlan'
  const params = new URLSearchParams()
  params.append('type', type)
  params.append('zone', zoneName)
  if (type === 'vxlan') {
    const peers = await listClusterNodeIps(conn)
    params.append('peers', peers.join(','))
  } else {
    if (!opts.bridge) throw new Error(`createZone: bridge is required for VLAN zone "${zoneName}"`)
    params.append('bridge', opts.bridge)
  }

  try {
    await unisphereFetch(conn, '/cluster/sdn/zones', { method: 'POST', body: params })
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (!msg.includes('already exists')) {
      throw new Error(`Failed to create SDN zone "${zoneName}": ${msg}`)
    }
    console.warn(`[vdc-sdn] SDN zone "${zoneName}" already exists, proceeding`)
  }
}

/**
 * Deletes a VXLAN zone (idempotent - tolerates "not found").
 * Caller must invoke applySdn(conn) afterwards.
 */
export async function deleteZone(conn: any, zoneName: string): Promise<void> {
  try {
    await unisphereFetch(conn, `/cluster/sdn/zones/${encodeURIComponent(zoneName)}`, { method: 'DELETE' })
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (!msg.toLowerCase().includes('not found') && !msg.includes('404')) {
      throw new Error(`Failed to delete SDN zone "${zoneName}": ${msg}`)
    }
    console.warn(`[vdc-sdn] SDN zone "${zoneName}" not found, skipping`)
  }
}

// ---------------------------------------------------------------------------
// VNet CRUD
// ---------------------------------------------------------------------------

export interface CreateVnetParams {
  unisphereName: string
  zoneName: string
  tag: number
  /** Friendly label shown in the UNISPHERE GUI under the hashed unisphereName — lets a
   *  provider admin debugging eSage identify which tenant VNet this is. */
  alias?: string
}

/**
 * Creates a VNet on UNISPHERE. Caller must invoke applySdn(conn) afterwards.
 * The VNet firewall toggle is NOT part of the VNet schema in UNISPHERE 8.x — use
 * setVnetFirewallEnabled() after creation to enable/disable it.
 */
export async function createVnetUnisphere(conn: any, params: CreateVnetParams): Promise<void> {
  const body = new URLSearchParams()
  body.append('vnet', params.unisphereName)
  body.append('zone', params.zoneName)
  body.append('tag', String(params.tag))
  body.append('type', 'vnet')
  if (params.alias) body.append('alias', params.alias)

  try {
    await unisphereFetch(conn, '/cluster/sdn/vnets', { method: 'POST', body })
  } catch (err: any) {
    throw new Error(`Failed to create SDN VNet "${params.alias ?? params.unisphereName}": ${err?.message}`)
  }
}

export async function updateVnetUnisphere(
  conn: any,
  unisphereName: string,
  patch: { alias?: string }
): Promise<void> {
  const body = new URLSearchParams()
  if (patch.alias !== undefined) body.append('alias', patch.alias)
  if ([...body.keys()].length === 0) return

  await unisphereFetch(conn, `/cluster/sdn/vnets/${encodeURIComponent(unisphereName)}`, { method: 'PUT', body })
}

/**
 * Enable or disable the VNet-level firewall via the SDN firewall options
 * endpoint: `/cluster/sdn/vnets/{vnet}/firewall/options` (UNISPHERE 8.3+).
 * Older UNISPHERE builds may not implement this route — we swallow 501 responses
 * and surface a clearer error so the caller can decide (e.g. skip when
 * disabling, warn when enabling).
 */
export async function setVnetFirewallEnabled(conn: any, unisphereName: string, enabled: boolean): Promise<void> {
  const body = new URLSearchParams()
  body.append('enable', enabled ? '1' : '0')
  try {
    await unisphereFetch(conn, `/cluster/sdn/vnets/${encodeURIComponent(unisphereName)}/firewall/options`, { method: 'PUT', body })
  } catch (err: any) {
    const msg = String(err?.message || '')
    // Not implemented: cluster runs a UNISPHERE that doesn't ship SDN VNet firewall.
    if (msg.includes('501') || msg.toLowerCase().includes('not implemented')) {
      throw new Error(
        `VNet firewall is not supported on this eSage cluster — upgrade to UNISPHERE 8.3+ or leave the toggle off (${unisphereName}).`
      )
    }
    // Missing options row is OK when we're turning it off.
    if (!enabled && msg.includes('404')) return
    throw new Error(`Failed to set VNet "${unisphereName}" firewall to ${enabled}: ${msg}`)
  }
}

export async function deleteVnetUnisphere(conn: any, unisphereName: string): Promise<void> {
  // UNISPHERE refuses to delete a vnet that still has subnets attached
  // ("Can't delete vnet if subnets exists"). Even though we stopped
  // mirroring subnets to UNISPHERE, vDCs created by older builds still carry
  // UNISPHERE-side subnets; we list and drop them defensively before the vnet
  // delete so legacy vDCs can be cleaned up.
  try {
    const subnets = await unisphereFetch<any[]>(conn, `/cluster/sdn/vnets/${encodeURIComponent(unisphereName)}/subnets`)
    for (const s of subnets || []) {
      // UNISPHERE returns the subnet id either in `subnet` (older 8.x) or `cidr`
      // (newer 9.x). Both are accepted by the DELETE route as the path
      // segment after `/subnets/`.
      const subnetId = String(s?.subnet ?? s?.cidr ?? '').trim()
      if (!subnetId) continue
      try {
        await unisphereFetch(conn, `/cluster/sdn/vnets/${encodeURIComponent(unisphereName)}/subnets/${encodeURIComponent(subnetId)}`, { method: 'DELETE' })
      } catch (err: any) {
        // Best-effort: log and continue so a single stuck subnet
        // doesn't block the rest of the vnet teardown.
        console.warn(`[vdc-sdn] failed to delete UNISPHERE subnet "${subnetId}" on vnet "${unisphereName}": ${err?.message || err}`)
      }
    }
  } catch (err: any) {
    // 404 / missing vnet → nothing to enumerate; fall through to the vnet
    // delete which will hit the same idempotent-missing path below.
    console.warn(`[vdc-sdn] could not list subnets for vnet "${unisphereName}" before delete: ${err?.message || err}`)
  }

  try {
    await unisphereFetch(conn, `/cluster/sdn/vnets/${encodeURIComponent(unisphereName)}`, { method: 'DELETE' })
  } catch (err: any) {
    const msg = String(err?.message || '')
    const lower = msg.toLowerCase()
    // UNISPHERE returns 500 with "sdn vnet 'X' does not exist" for SDN objects that
    // were already removed (manual cluster cleanup, drift, etc.). Treat any of
    // these missing-object signals as success so DB-side delete stays
    // idempotent and the user can clean up the orphan row.
    const isMissing =
      lower.includes('not found') ||
      msg.includes('404') ||
      lower.includes('does not exist') ||
      lower.includes("doesn't exist")
    if (!isMissing) {
      throw new Error(`Failed to delete SDN VNet "${unisphereName}": ${msg}`)
    }
    console.warn(`[vdc-sdn] SDN VNet "${unisphereName}" already gone on UNISPHERE, proceeding with DB cleanup`)
  }
}

// ---------------------------------------------------------------------------
// UNISPHERE SDN: subnets used to be mirrored to UNISPHERE here. They no longer are —
// the subnet definition lives only in our DB (`vdc_subnets`), because:
//   - DHCP via dnsmasq does not work on VXLAN zones in UNISPHERE 9.x (the
//     `dhcp=dnsmasq, ipam=unisphere` zone backend depends on the broken IPAM)
//   - SNAT was always disabled (`snat=0`)
//   - DNS resolvers are pushed via CloudInit, not via UNISPHERE
//   - the gateway is purely declarative on UNISPHERE — the VM gets it via
//     CloudInit `ipconfigN`, never reads it from UNISPHERE
// → the UNISPHERE-side subnet had no functional effect on tenant traffic, so
// keeping it in sync was pure overhead and a source of drift.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MAC address helper — used when allocating an IP from IPAM before the VM
// exists on UNISPHERE (we need a MAC to key the IPAM entry, can't rely on UNISPHERE
// auto-generation since that happens after the create).
// ---------------------------------------------------------------------------

/** Generates a random MAC with the eSage OUI prefix `BC:24:11` so the VM's
 *  NIC matches what an admin would expect to see in UNISPHERE. The remaining 24
 *  bits are uniformly random — collision probability inside a single tenant
 *  is negligible (~1 in 16M for typical fleet sizes). */
export function generateUnisphereMacAddress(): string {
  const buf = crypto.randomBytes(3)
  const bytes = ['BC', '24', '11', buf[0].toString(16).padStart(2, '0').toUpperCase(), buf[1].toString(16).padStart(2, '0').toUpperCase(), buf[2].toString(16).padStart(2, '0').toUpperCase()]
  return bytes.join(':')
}

// UNISPHERE IPAM helpers used to live here (allocateIp / releaseIp calling
// /cluster/sdn/vnets/<vnet>/ips). They were removed because UNISPHERE 9.x's
// IPAM is unusable on VXLAN zones (the POST returns 200 but writes
// nothing visible in /cluster/sdn/ipams/unisphere/status, and GET / DELETE
// counterparts are not implemented). UniCenter now owns the IPAM in
// SQLite — see lib/vdc/ipam.ts.

export async function listVnetsUnisphere(conn: any): Promise<SdnVnet[]> {
  const items = await unisphereFetch<any[]>(conn, '/cluster/sdn/vnets')
  return (items || []).map((v: any) => ({
    vnet: v.vnet,
    zone: v.zone,
    tag: Number(v.tag),
    firewall: v.firewall ? 1 : 0,
  }))
}

// ---------------------------------------------------------------------------
// Count NIC attachments for a VNet (used before delete)
// ---------------------------------------------------------------------------

/**
 * Returns the number of NICs across all VMs/CTs that reference `unisphereName` as bridge.
 * Best-effort: skips VMs whose config fails to fetch.
 */
export async function countVnetAttachments(conn: any, unisphereName: string): Promise<number> {
  const resources = await unisphereFetch<any[]>(conn, '/cluster/resources?type=vm')
  let count = 0

  for (const res of resources || []) {
    const vmid = res.vmid
    const node = res.node
    const type = res.type
    if (!vmid || !node || !type) continue

    try {
      const config = await unisphereFetch<any>(conn, `/nodes/${encodeURIComponent(node)}/${type}/${vmid}/config`)
      for (const key of Object.keys(config)) {
        if (!/^net\d+$/.test(key)) continue
        const val = String(config[key] || '')
        const m = val.match(/bridge=([^,]+)/)
        if (m && m[1] === unisphereName) count++
      }
    } catch {
      // Skip VMs whose config fails
    }
  }

  return count
}
