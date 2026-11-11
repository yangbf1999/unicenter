export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import {
  alertPageResponse,
  uniserverAlertErrorResponse,
  uniserverAlertFetch,
} from '@/lib/uniserver/alerts'

export async function GET(request: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const query = new URL(request.url).search
    const page = await uniserverAlertFetch<Record<string, unknown>>(
      `/alerts/notifications/history${query}`,
      { request },
    )
    return NextResponse.json(alertPageResponse(page))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
