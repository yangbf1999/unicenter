export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { resolveAlertBackend } from '@/lib/alerts/backend'
import { getSetting, setSetting } from '@/lib/db/settings'
import { demoResponse } from '@/lib/demo/demo-api'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { getCurrentTenantId } from '@/lib/tenant'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'

const DEFAULT_THRESHOLDS = {
  cpu_warning: 80,
  cpu_critical: 90,
  memory_warning: 80,
  memory_critical: 90,
  storage_warning: 80,
  storage_critical: 90,
  snapshot_max_age_days: 7,
  recovery_margin: 5,
  recovery_confirmations: 3,
  osd_latency_warning: 0,
  osd_latency_critical: 250,
  replication_rpo_grace_percent: 25,
  replication_failure_alerts: 1,
}

type Thresholds = typeof DEFAULT_THRESHOLDS

function coerceThresholds(raw: unknown): Thresholds {
  const result = { ...DEFAULT_THRESHOLDS }
  if (!raw || typeof raw !== 'object') return result
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
  }
  return result
}

export async function GET(request: Request) {
  const demo = demoResponse(request)
  if (demo) return demo
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied
    if ((await resolveAlertBackend()) === 'uniserver') {
      const query = new URL(request.url).search
      return NextResponse.json(await uniserverAlertFetch(`/alerts/thresholds${query}`, { request }))
    }
    const tenantId = await getCurrentTenantId()
    return NextResponse.json(coerceThresholds(await getSetting('alert_thresholds', tenantId)))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  const demo = demoResponse(request)
  if (demo) return demo
  try {
    const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
    if (denied) return denied
    const body = await request.json()
    if ((await resolveAlertBackend()) === 'uniserver') {
      const query = new URL(request.url).search
      const data = await uniserverAlertFetch(`/alerts/thresholds${query}`, {
        method: 'PUT',
        body,
        request,
      })
      return NextResponse.json(data)
    }
    const thresholds = coerceThresholds(body)
    const tenantId = await getCurrentTenantId()
    await setSetting('alert_thresholds', tenantId, thresholds)
    return NextResponse.json(thresholds)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
