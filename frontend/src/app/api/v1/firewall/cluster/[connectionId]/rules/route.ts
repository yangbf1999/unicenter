export const dynamic = "force-dynamic"
// src/app/api/v1/firewall/cluster/[connectionId]/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { getOrchestratorClient } from '@/lib/orchestrator/client'
import { verifyConnectionOwnership } from '@/lib/tenant'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { orchestratorOrUnisphere } from '@/lib/firewall/withUnisphereFallback'
import * as unisphereDirect from '@/lib/firewall/unisphereDirect'
import { getConnectionById } from '@/lib/connections/getConnection'

// POST /api/v1/firewall/cluster/[connectionId]/rules - Add cluster rule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params
    const ownershipDenied = await verifyConnectionOwnership(connectionId)
    if (ownershipDenied) return ownershipDenied

    const denied = await checkPermission(PERMISSIONS.NODE_MANAGE, "connection", connectionId)
    if (denied) return denied

    const body = await request.json()

    const orchestrator = getOrchestratorClient()
    const result = await orchestratorOrUnisphere(
      'firewall/cluster/rules',
      () => orchestrator.post(`/firewall/cluster/${connectionId}/rules`, body),
      async () => unisphereDirect.addClusterRule(await getConnectionById(connectionId), body),
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error adding cluster rule:', error)
    
return NextResponse.json(
      { error: error.message || 'Failed to add cluster rule' },
      { status: 500 }
    )
  }
}
