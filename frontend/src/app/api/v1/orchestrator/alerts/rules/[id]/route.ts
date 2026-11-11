import { NextResponse } from 'next/server'

import { requireUniserverAlerts } from '@/lib/alerts/backend'
import { demoResponse } from '@/lib/demo/demo-api'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

async function path(params: Context['params']) {
  const { id } = await params
  return `/alerts/rules/${encodeURIComponent(id)}`
}

export async function GET(request: Request, { params }: Context) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    return NextResponse.json(await uniserverAlertFetch(await path(params), { request }))
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function PUT(request: Request, { params }: Context) {
  const demo = demoResponse(request)
  if (demo) return demo
  const gate = await requireUniserverAlerts()
  if (gate) return gate
  try {
    const data = await uniserverAlertFetch(await path(params), {
      method: 'PUT',
      body: await request.json(),
      request,
    })
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
    const data = await uniserverAlertFetch(await path(params), {
      method: 'DELETE',
      request,
    })
    return NextResponse.json(data)
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
