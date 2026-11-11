import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { demoResponse } from '@/lib/demo/demo-api'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate

  try {
    const query = new URL(request.url).search
    const page = await uniserverAlertFetch<Record<string, unknown>>(`/alerts/active${query}`, {
      request,
    })
    return NextResponse.json(Array.isArray(page.records) ? page.records : [])
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
