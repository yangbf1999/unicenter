export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { smtpConfigToUniserver } from '@/lib/alerts/notificationAdapter'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export async function POST(request: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const body = await request.json().catch(() => ({}))
    const query = new URL(request.url).search
    const data = await uniserverAlertFetch(`/alerts/notifications/test-connection${query}`, {
      method: 'POST',
      body: { config: smtpConfigToUniserver(body.config) },
      request,
    })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
