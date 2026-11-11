export const dynamic = "force-dynamic"
// src/app/api/v1/firewall/cluster/[connectionId]/rules/[pos]/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { getOrchestratorClient } from '@/lib/orchestrator/client'
import { verifyConnectionOwnership } from '@/lib/tenant'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { orchestratorOrUnisphere } from '@/lib/firewall/withUnisphereFallback'
import * as unisphereDirect from '@/lib/firewall/unisphereDirect'
import { getConnectionById } from '@/lib/connections/getConnection'

// PUT /api/v1/firewall/cluster/[connectionId]/rules/[pos] - Update/move cluster rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string; pos: string }> }
) {
  try {
    const { connectionId, pos } = await params
    const ownershipDenied = await verifyConnectionOwnership(connectionId)
    if (ownershipDenied) return ownershipDenied

    const denied = await checkPermission(PERMISSIONS.NODE_MANAGE, "connection", connectionId)
    if (denied) return denied

    const body = await request.json()

    const orchestrator = getOrchestratorClient()
    const result = await orchestratorOrUnisphere(
      'firewall/cluster/rules',
      () => orchestrator.put(`/firewall/cluster/${connectionId}/rules/${pos}`, body),
      async () => unisphereDirect.updateClusterRule(await getConnectionById(connectionId), pos, body),
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error updating cluster rule:', error)
    
return NextResponse.json(
      { error: error.message || 'Failed to update cluster rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/v1/firewall/cluster/[connectionId]/rules/[pos] - Delete cluster rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string; pos: string }> }
) {
  try {
    const { connectionId, pos } = await params
    const ownershipDenied = await verifyConnectionOwnership(connectionId)
    if (ownershipDenied) return ownershipDenied

    const denied = await checkPermission(PERMISSIONS.NODE_MANAGE, "connection", connectionId)
    if (denied) return denied

    const orchestrator = getOrchestratorClient()

    await orchestratorOrUnisphere(
      'firewall/cluster/rules',
      () => orchestrator.delete(`/firewall/cluster/${connectionId}/rules/${pos}`),
      async () => unisphereDirect.deleteClusterRule(await getConnectionById(connectionId), pos),
    )

    return NextResponse.json({ status: 'deleted' })
  } catch (error: any) {
    console.error('Error deleting cluster rule:', error)
    
return NextResponse.json(
      { error: error.message || 'Failed to delete cluster rule' },
      { status: 500 }
    )
  }
}
