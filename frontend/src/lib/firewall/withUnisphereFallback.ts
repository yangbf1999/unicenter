// src/lib/firewall/withUnisphereFallback.ts
// Shared orchestrator → direct-UNISPHERE fallback for the /api/v1/firewall/**
// routes (#616). Community installs run without an orchestrator (no
// ORCHESTRATOR_URL), so every orchestrator call there fails with
// ORCHESTRATOR_UNAVAILABLE and must fall back to unisphereFetch — same pattern as
// the SSH fallback in lib/ssh/exec.ts.

/**
 * Runs `orchestratorCall` and returns its unwrapped `.data`. Only when the
 * orchestrator is unreachable (`err.code === 'ORCHESTRATOR_UNAVAILABLE'`,
 * tagged by lib/orchestrator/client.ts) does it fall back to `unisphereCall`,
 * which must resolve to the same bare shape the orchestrator endpoint
 * returns (see unisphereDirect.ts). Any other error — 403 from the license
 * middleware, UNISPHERE 500, timeout — rethrows unchanged: a timeout is not
 * "unreachable", and swallowing a real error as an empty result is exactly
 * the bug this fixes.
 */
export async function orchestratorOrUnisphere<T>(
  label: string,                          // e.g. 'firewall/vms'
  orchestratorCall: () => Promise<{ data: T }>,
  unisphereCall: () => Promise<T>,
): Promise<T> {
  try {
    const response = await orchestratorCall()

    return response.data
  } catch (err) {
    if ((err as { code?: string })?.code !== 'ORCHESTRATOR_UNAVAILABLE') throw err

    console.log(`[${label}] orchestrator unavailable, falling back to direct UNISPHERE`)

    return unisphereCall()
  }
}
