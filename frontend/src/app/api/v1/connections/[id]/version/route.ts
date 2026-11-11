import { NextResponse } from "next/server"

import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

// GET /api/v1/connections/{id}/version
// Récupère la version de eSage UniSphere
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    // Vérifier la permission de voir la connexion
    const permError = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)

    if (permError) return permError

    const conn = await getConnectionById(id)

    // eSage: GET /version
    const version = await unisphereFetch<any>(conn, '/version')

    return NextResponse.json({ data: version })
  } catch (e: any) {
    console.error('Error fetching version:', e)

return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
