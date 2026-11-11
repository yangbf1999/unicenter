import { NextResponse } from "next/server"

import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

// GET /api/v1/connections/{id}/ha
// Récupère les ressources HA, les groupes HA (UNISPHERE 8) ou les règles d'affinité (UNISPHERE 9)
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    // Vérifier la permission de voir la connexion
    const permError = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)

    if (permError) return permError

    const conn = await getConnectionById(id)

    // Récupérer les ressources HA, les groupes et les règles en parallèle
    const [resourcesResult, groupsResult, rulesResult, versionResult, statusResult] = await Promise.allSettled([
      unisphereFetch<any[]>(conn, '/cluster/ha/resources'),
      unisphereFetch<any[]>(conn, '/cluster/ha/groups'),
      unisphereFetch<any[]>(conn, '/cluster/ha/rules'), // UNISPHERE 9+ uniquement
      unisphereFetch<any>(conn, '/version'),
      unisphereFetch<any[]>(conn, '/cluster/ha/status/current'),
    ])

    const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value || [] : []
    const groups = groupsResult.status === 'fulfilled' ? groupsResult.value || [] : []
    
    // Vérifier si les règles sont supportées (UNISPHERE 9+)
    const rulesSupported = rulesResult.status === 'fulfilled'
    const rules = rulesSupported ? rulesResult.value || [] : []
    
    // Extraire la version de UNISPHERE
    let unisphereVersion = '8.0.0'

    if (versionResult.status === 'fulfilled' && versionResult.value) {
      unisphereVersion = versionResult.value.version || versionResult.value.release || '8.0.0'
    }
    
    // Déterminer la version majeure (8 ou 9)
    const majorVersion = Number.parseInt(unisphereVersion.split('.')[0], 10) || 8

    const status = statusResult.status === 'fulfilled' ? statusResult.value || [] : []

    return NextResponse.json({
      data: {
        resources,
        groups,
        rules,
        status,
        unisphereVersion,
        majorVersion,
        rulesSupported, // true si UNISPHERE 9+
      }
    })
  } catch (e: any) {
    console.error('Error fetching HA:', e)
    
return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
