import { unisphereFetch, type eSageClientOptions } from "@/lib/esage/client"

// UNISPHERE `PUT /qemu/{vmid}/config` is synchronous and can take ~10s on slow storage
// (e.g. ZFS-over-iSCSI). unisphereFetch's 8s default fires before the metadata write
// commits, and the abort then trips the failover circuit breaker, surfacing as a
// fake "all cluster nodes unreachable". Issue #332.
const UNISPHERE_CONFIG_PUT_TIMEOUT_MS = 120_000

/**
 * Update a VM's UNISPHERE config (`PUT /nodes/{node}/qemu/{vmid}/config`) with a
 * timeout long enough for synchronous storage work (`qm set` on slow targets
 * like ZFS-over-iSCSI). Every migration-time disk attach, boot order edit,
 * and atomic attach+boot goes through here so the timeout cannot be forgotten
 * on a new call site.
 */
export async function unisphereSetVmConfig(
  unisphereConn: eSageClientOptions,
  node: string,
  vmid: number,
  body: URLSearchParams,
): Promise<void> {
  await unisphereFetch<unknown>(
    unisphereConn,
    `/nodes/${encodeURIComponent(node)}/qemu/${vmid}/config`,
    { method: "PUT", body },
    { timeoutMs: UNISPHERE_CONFIG_PUT_TIMEOUT_MS },
  )
}

/**
 * Destroy a VM (`DELETE /nodes/{node}/qemu/{vmid}`), purging it from the cluster
 * config and reclaiming any disks no longer referenced.
 *
 * The `purge` and `destroy-unreferenced-disks` flags MUST travel in the query
 * string. UNISPHERE's DELETE handler rejects a request body outright with
 * `501 Unexpected content for method 'DELETE'`, which silently aborts the
 * cleanup and leaks the VMID plus its disk on a failed migration (issue #400).
 * Centralised here so every failed-migration cleanup path uses the query-string
 * form and the body footgun can't be reintroduced on a new call site.
 */
export async function destroyUnisphereVm(
  unisphereConn: eSageClientOptions,
  node: string,
  vmid: number | string,
): Promise<void> {
  await unisphereFetch<unknown>(
    unisphereConn,
    `/nodes/${encodeURIComponent(node)}/qemu/${encodeURIComponent(String(vmid))}?purge=1&destroy-unreferenced-disks=1`,
    { method: "DELETE" },
  )
}
