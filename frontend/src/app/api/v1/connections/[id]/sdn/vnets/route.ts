import { NextResponse } from "next/server"

import { unisphereFetch } from "@/lib/esage/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const permError = await checkPermission(PERMISSIONS.CONNECTION_VIEW, "connection", id)
    if (permError) return permError
    const conn = await getConnectionById(id)
    if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    const vnets = await unisphereFetch<any[]>(conn, "/cluster/sdn/vnets?pending=1")
    return NextResponse.json({ data: { vnets: vnets ?? [] } })
  } catch (e: any) {
    console.error("Error fetching SDN vnets:", e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 })
  }
}
