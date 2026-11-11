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
    return NextResponse.json(await uniserverAlertFetch('/alerts/rules', { request }))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const data = await uniserverAlertFetch('/alerts/rules', {
      method: 'POST',
      body: await request.json(),
      request,
    })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
