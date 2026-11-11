import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { demoResponse } from '@/lib/demo/demo-api'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate

  try {
    const { id } = await params
    const data = await uniserverAlertFetch(`/alerts/${encodeURIComponent(id)}`, { request })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate

  try {
    const { id } = await params
    const data = await uniserverAlertFetch(`/alerts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      request,
    })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
