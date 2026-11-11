export const dynamic = "force-dynamic"
// src/app/api/v1/firewall/ipsets/[connectionId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { getOrchestratorClient } from '@/lib/orchestrator/client'
import { verifyConnectionOwnership } from '@/lib/tenant'
import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { getConnectionById } from '@/lib/connections/getConnection'
import { orchestratorOrUnisphere } from '@/lib/firewall/withUnisphereFallback'
import * as unisphereDirect from '@/lib/firewall/unisphereDirect'

// GET /api/v1/firewall/ipsets/[connectionId] - Get all IP sets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params
    const ownershipDenied = await verifyConnectionOwnership(connectionId)
    if (ownershipDenied) return ownershipDenied

    const denied = await checkPermission(PERMISSIONS.NODE_VIEW, "connection", connectionId)
    if (denied) return denied

    const orchestrator = getOrchestratorClient()
    const ipsets = await orchestratorOrUnisphere(
      'firewall/ipsets',
      () => orchestrator.get(`/firewall/ipsets/${connectionId}`),
      async () => unisphereDirect.getIPSets(await getConnectionById(connectionId)),
    )

    return NextResponse.json(ipsets)
  } catch (error: any) {
    console.error('Error fetching IP sets:', error)
    
return NextResponse.json(
      { error: error.message || 'Failed to fetch IP sets' },
      { status: 500 }
    )
  }
}

// POST /api/v1/firewall/ipsets/[connectionId] - Create IP set
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
    const created = await orchestratorOrUnisphere(
      'firewall/ipsets',
      () => orchestrator.post(`/firewall/ipsets/${connectionId}`, body),
      async () => unisphereDirect.createIPSet(await getConnectionById(connectionId), body),
    )

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('Error creating IP set:', error)
    
return NextResponse.json(
      { error: error.message || 'Failed to create IP set' },
      { status: 500 }
    )
  }
}
