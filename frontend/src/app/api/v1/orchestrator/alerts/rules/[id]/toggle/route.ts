import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { demoResponse } from '@/lib/demo/demo-api'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const { id } = await params
    const data = await uniserverAlertFetch(
      `/alerts/rules/${encodeURIComponent(id)}/toggle`,
      { method: 'POST', request },
    )
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
