export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import {
  notificationSettingsToBrowser,
  notificationSettingsToUniserver,
} from '@/lib/alerts/notificationAdapter'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export async function GET(request: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const query = new URL(request.url).search
    const data = await uniserverAlertFetch<Record<string, unknown>>(
      `/alerts/notifications/settings${query}`,
      { request },
    )
    return NextResponse.json(notificationSettingsToBrowser(data))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  const denied = await checkPermission(PERMISSIONS.ADMIN_SETTINGS)
  if (denied) return denied
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const query = new URL(request.url).search
    const data = await uniserverAlertFetch<Record<string, unknown>>(
      `/alerts/notifications/settings${query}`,
      {
        method: 'PUT',
        body: notificationSettingsToUniserver(await request.json()),
        request,
      },
    )
    return NextResponse.json(notificationSettingsToBrowser(data))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
