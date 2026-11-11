import { NextResponse } from "next/server"

import { orchestratorHeaders } from "@/lib/orchestrator/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Default community license status when orchestrator is unavailable
const DEFAULT_COMMUNITY_STATUS = {
  licensed: false,
  expired: false,
  edition: 'community',
  features: ['dashboard', 'inventory', 'backups', 'storage', 'drs', 'firewall', 'microsegmentation', 'rolling_updates', 'ai_insights', 'predictive_alerts', 'green_metrics', 'cross_cluster_migration', 'ceph_replication', 'ldap', 'reports', 'rbac', 'task_center', 'notifications', 'cve_scanner', 'white_label'],
  options: [],
}

export async function GET() {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim()

  // Community has no orchestrator. Avoid a guaranteed localhost request on
  // every page load and return the local Community contract immediately.
  if (!orchestratorUrl) {
    return NextResponse.json(DEFAULT_COMMUNITY_STATUS)
  }

  try {
    const res = await fetch(`${orchestratorUrl.replace(/\/$/, '')}/api/v1/license/status`, {
      headers: orchestratorHeaders(),
      cache: "no-store",
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || `HTTP ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (e: any) {
    // Return default community license when orchestrator is unavailable (silent)
    if (e?.message?.includes('ECONNREFUSED') ||
        e?.message?.includes('fetch failed') ||
        e?.message?.includes('timeout')) {
      return NextResponse.json(DEFAULT_COMMUNITY_STATUS)
    }

    // Log only unexpected errors
    console.error("License status fetch failed:", e?.message)

    return NextResponse.json(
      { error: e?.message || "Failed to fetch license status" },
      { status: 500 }
    )
  }
}
