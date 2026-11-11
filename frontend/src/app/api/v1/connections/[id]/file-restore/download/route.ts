import { NextResponse } from "next/server"

import { request } from "undici"

import { getConnectionById } from "@/lib/connections/getConnection"
import { getInsecureAgent } from "@/lib/esage/client"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

/**
 * GET /api/v1/connections/{unisphereId}/file-restore/download
 *
 * Télécharge un fichier ou dossier depuis un backup vzdump via l'API file-restore de eSage.
 *
 * Query params:
 * - storage: Nom du storage dans UNISPHERE
 * - volume: Volume ID du backup
 * - filepath: Chemin du fichier/dossier à télécharger
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(ctx.params)
    const unisphereId = (params as any)?.id

    if (!unisphereId) {
      return NextResponse.json({ error: "Missing UNISPHERE connection id" }, { status: 400 })
    }

    const denied = await checkPermission(PERMISSIONS.BACKUP_VIEW, "connection", unisphereId)
    if (denied) return denied

    const url = new URL(req.url)
    const storage = url.searchParams.get('storage')
    const volume = url.searchParams.get('volume')
    const filepath = url.searchParams.get('filepath')
    const isDirectory = url.searchParams.get('directory') === '1'

    if (!storage || !volume || !filepath) {
      return NextResponse.json({ error: "Missing required parameters: storage, volume, filepath" }, { status: 400 })
    }

    const conn = await getConnectionById(unisphereId)

    const dispatcher = conn.insecureDev
      ? getInsecureAgent()
      : undefined

    // Récupérer un node qui a accès au storage
    const resourcesUrl = `${conn.baseUrl.replace(/\/$/, "")}/api2/json/cluster/resources`

    const resourcesRes = await request(resourcesUrl, {
      method: 'GET',
      headers: { Authorization: `PVEAPIToken=${conn.apiToken}` },
      dispatcher,
    })

    const resourcesJson = JSON.parse(await resourcesRes.body.text())
    const allResources = resourcesJson.data || []

    const storageNodes = allResources
      .filter((r: any) => r.type === 'storage' && r.storage === storage && r.status === 'available')
      .map((r: any) => r.node)

    const onlineNodes = allResources
      .filter((r: any) => r.type === 'node' && r.status === 'online')
      .map((r: any) => r.node)

    const nodeName = storageNodes.find((n: string) => onlineNodes.includes(n))
      || storageNodes[0]
      || onlineNodes[0]

    if (!nodeName) {
      return NextResponse.json({ error: "No available node found with storage access" }, { status: 500 })
    }

    // Construire le volume ID complet si nécessaire
    const volumeId = volume.includes(':') ? volume : `${storage}:${volume}`

    // Encoder le filepath en base64 comme attendu par l'API UNISPHERE
    const filepathBase64 = Buffer.from(filepath, 'utf-8').toString('base64')

    // Appeler l'API file-restore/download de eSage
    const downloadUrl = `${conn.baseUrl.replace(/\/$/, "")}/api2/json/nodes/${nodeName}/storage/${encodeURIComponent(storage)}/file-restore/download`

    const queryParams = new URLSearchParams({
      volume: volumeId,
      filepath: filepathBase64,
    })

    const unisphereRes = await request(`${downloadUrl}?${queryParams}`, {
      method: 'GET',
      headers: { Authorization: `PVEAPIToken=${conn.apiToken}` },
      dispatcher,
    })

    if (unisphereRes.statusCode < 200 || unisphereRes.statusCode >= 300) {
      const errorText = await unisphereRes.body.text()

      // Essayer de parser l'erreur JSON
      try {
        const errorJson = JSON.parse(errorText)

        return NextResponse.json({
          error: errorJson.errors?.volume || errorJson.message || `UNISPHERE error: ${unisphereRes.statusCode}`,
          details: errorJson
        }, { status: unisphereRes.statusCode })
      } catch {
        return NextResponse.json({
          error: `UNISPHERE error: ${unisphereRes.statusCode}`,
          details: errorText
        }, { status: unisphereRes.statusCode })
      }
    }

    // Déterminer le nom du fichier pour le Content-Disposition
    const filename = filepath.split('/').pop() || 'download'
    const rawContentType = unisphereRes.headers['content-type']
    const contentType: string = Array.isArray(rawContentType) ? rawContentType[0] : (rawContentType || 'application/octet-stream')

    // Pour les dossiers, UNISPHERE retourne une archive .tar.zst
    // Pour les fichiers, on garde le nom original
    let downloadFilename = filename
    if (isDirectory) {
      downloadFilename = `${filename}.tar.zst`
    }

    // Collecter le body en chunks
    const chunks: Uint8Array[] = []

    for await (const chunk of unisphereRes.body) {
      chunks.push(chunk)
    }

    const buffer = Buffer.concat(chunks)

    // Créer la réponse avec les headers appropriés
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
        'Content-Length': String(buffer.length),
      },
    })

  } catch (e: any) {
    console.error("File-restore download error:", e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
