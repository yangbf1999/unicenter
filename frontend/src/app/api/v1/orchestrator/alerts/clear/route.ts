import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { demoResponse } from '@/lib/demo/demo-api'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate

  try {
    const query = new URL(request.url).search
    const data = await uniserverAlertFetch(`/alerts/clear${query}`, {
      method: 'DELETE',
      request,
    })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
