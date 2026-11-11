import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { effectiveHasFeature, Features } from '@/lib/license/features'

export type AlertBackend = 'community' | 'uniserver'

export async function resolveAlertBackend(): Promise<AlertBackend> {
  const license = await prisma.license.findFirst({
    where: {
      isPrimary: true,
      state: 'active',
      expiresAt: { gt: new Date() },
    },
    select: { edition: true },
  })
  const enabled = effectiveHasFeature(
    license
      ? { licensed: true, expired: false, edition: license.edition, options: [] }
      : null,
    Features.ALERTS,
  )
  return enabled ? 'uniserver' : 'community'
}

export async function requireUniserverAlerts(): Promise<NextResponse | null> {
  try {
    if ((await resolveAlertBackend()) === 'uniserver') return null
    return NextResponse.json(
      { error: 'Feature not licensed', feature: Features.ALERTS },
      { status: 403 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Alert license state is unavailable', code: 'ALERT_LICENSE_UNAVAILABLE' },
      { status: 503 },
    )
  }
}
