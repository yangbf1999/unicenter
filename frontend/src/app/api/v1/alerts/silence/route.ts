import { NextResponse } from 'next/server'

import { resolveAlertBackend } from '@/lib/alerts/backend'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { silenceAlertSchema } from '@/lib/schemas'
import { getCurrentTenantId, getSessionPrisma } from '@/lib/tenant'
import { uniserverAlertErrorResponse, uniserverAlertFetch } from '@/lib/uniserver/alerts'

export const runtime = 'nodejs'

const DURATION_SECONDS: Record<string, number | null> = {
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  indefinite: null,
}

export async function GET(request: Request) {
  try {
    const denied = await checkPermission(PERMISSIONS.ALERTS_VIEW)
    if (denied) return denied
    if ((await resolveAlertBackend()) === 'uniserver') {
      const page = await uniserverAlertFetch<Record<string, unknown>>(
        '/alerts?status=silenced&limit=500',
        { request },
      )
      return NextResponse.json({ data: Array.isArray(page.records) ? page.records : [] })
    }

    const prisma = await getSessionPrisma()
    const silences = await prisma.alertSilence.findMany({ orderBy: { silencedAt: 'desc' } })
    return NextResponse.json({ data: silences })
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const denied = await checkPermission(PERMISSIONS.ALERTS_MANAGE)
    if (denied) return denied
    const rawBody = await request.json()
    const parsed = silenceAlertSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { fingerprint, duration, reason } = parsed.data
    if ((await resolveAlertBackend()) === 'uniserver') {
      const data = await uniserverAlertFetch('/alerts/silences', {
        method: 'POST',
        body: { fingerprint, duration: DURATION_SECONDS[duration], reason },
        request,
      })
      return NextResponse.json({ data })
    }

    const prisma = await getSessionPrisma()
    const tenantId = await getCurrentTenantId()
    const now = new Date()
    const durationSeconds = DURATION_SECONDS[duration]
    const silencedUntil = durationSeconds
      ? new Date(now.getTime() + durationSeconds * 1000)
      : null
    const silence = await prisma.alertSilence.upsert({
      where: { tenantId_fingerprint: { tenantId, fingerprint } },
      create: {
        fingerprint,
        silencedBy: 'user',
        silencedAt: now,
        silencedUntil,
        reason: reason || null,
      },
      update: {
        silencedBy: 'user',
        silencedAt: now,
        silencedUntil,
        reason: reason || null,
      },
    })
    return NextResponse.json({ data: silence })
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = await checkPermission(PERMISSIONS.ALERTS_MANAGE)
    if (denied) return denied
    const fingerprint = new URL(request.url).searchParams.get('fingerprint')
    if (!fingerprint) {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 })
    }

    if ((await resolveAlertBackend()) === 'uniserver') {
      const data = await uniserverAlertFetch(
        `/alerts/silences?fingerprint=${encodeURIComponent(fingerprint)}`,
        { method: 'DELETE', request },
      )
      return NextResponse.json({ data })
    }

    const prisma = await getSessionPrisma()
    const result = await prisma.alertSilence.deleteMany({ where: { fingerprint } })
    return NextResponse.json({ data: { deleted: result.count } })
  } catch (error) {
    return uniserverAlertErrorResponse(error)
  }
}
