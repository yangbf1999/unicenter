import { NextResponse } from "next/server"

import { getSessionPrisma } from "@/lib/tenant"
import { unisphereFetch } from "@/lib/esage/client"
import { decryptSecret } from "@/lib/crypto/secret"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

/**
 * GET /api/v1/pbs-storages
 * 
 * Retourne la liste des storages PBS configurés sur les UNISPHERE, avec le mapping
 * vers les connexions PBS de UniCenter.
 * 
 * Cela permet de savoir quel UNISPHERE peut accéder à quel PBS, et avec quel nom de storage.
 * 
 * Réponse:
 * {
 *   data: [
 *     {
 *       unisphereId: "unisphere-1",
 *       unisphereName: "Cluster Principal",
 *       storageName: "pbs-backups",    // Nom du storage dans UNISPHERE
 *       pbsServer: "192.168.1.10:8007", // Serveur PBS configuré
 *       pbsDatastore: "vm-backups",    // Datastore sur le PBS
 *       pbsFingerprint: "...",
 *       pbsId: "pbs-1",                // ID de la connexion PBS dans UniCenter (si trouvé)
 *       pbsName: "PBS Principal",      // Nom de la connexion PBS (si trouvé)
 *       nodes: ["unisphere1", "unisphere2"],       // Nodes UNISPHERE où ce storage est disponible
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    const denied = await checkPermission(PERMISSIONS.BACKUP_VIEW)
    if (denied) return denied

    const prisma = await getSessionPrisma()
    // Récupérer toutes les connexions UNISPHERE et PBS
    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        insecureTLS: true,
        apiTokenEnc: true,
      }
    })

    const unisphereConnections = connections.filter(c => c.type === 'unisphere')
    const pbsConnections = connections.filter(c => c.type === 'pbs')

    // Créer un map des PBS par URL pour le matching
    const pbsByUrl = new Map<string, { id: string, name: string }>()

    for (const pbs of pbsConnections) {
      // Normaliser l'URL pour le matching (sans protocole, sans trailing slash)
      const normalizedUrl = normalizeUrl(pbs.baseUrl)

      pbsByUrl.set(normalizedUrl, { id: pbs.id, name: pbs.name })
    }

    const result: any[] = []

    // Pour chaque UNISPHERE, récupérer les storages de type PBS
    await Promise.all(unisphereConnections.map(async (unisphere) => {
      if (!unisphere.apiTokenEnc || !unisphere.baseUrl) return

      const conn = {
        id: unisphere.id,
        name: unisphere.name,
        baseUrl: unisphere.baseUrl,
        apiToken: decryptSecret(unisphere.apiTokenEnc),
        insecureDev: !!unisphere.insecureTLS,
      }

      try {
        // Récupérer la config des storages
        const storages = await unisphereFetch<any[]>(conn, "/storage")

        // Filtrer les storages PBS
        const pbsStorages = (storages || []).filter(s => s.type === 'pbs')

        for (const storage of pbsStorages) {
          // Récupérer les nodes où ce storage est actif
          let nodes: string[] = []

          try {
            const resources = await unisphereFetch<any[]>(conn, "/cluster/resources")

            nodes = resources
              .filter(r => r.type === 'storage' && r.storage === storage.storage)
              .map(r => r.node)
              .filter(Boolean)
          } catch {
            // Ignorer les erreurs de récupération des nodes
          }

          // Essayer de matcher avec une connexion PBS de UniCenter
          const pbsServer = storage.server || ''
          const normalizedPbsUrl = normalizeUrl(`https://${pbsServer}`)
          const matchedPbs = pbsByUrl.get(normalizedPbsUrl)

          result.push({
            unisphereId: unisphere.id,
            unisphereName: unisphere.name,
            storageName: storage.storage,
            pbsServer: storage.server || null,
            pbsDatastore: storage.datastore || null,
            pbsFingerprint: storage.fingerprint || null,
            pbsUsername: storage.username || null,

            // Matching avec UniCenter
            pbsId: matchedPbs?.id || null,
            pbsName: matchedPbs?.name || null,

            // Infos additionnelles
            nodes: nodes.length > 0 ? nodes : null,
            content: storage.content ? String(storage.content).split(',') : [],
            enabled: storage.disable !== 1,
          })
        }
      } catch (e) {
        console.warn(`Failed to get storages from UNISPHERE ${unisphere.name}:`, e)
      }
    }))

    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error("PBS storages mapping error:", e)
    
return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * Normalise une URL pour le matching (retire le protocole, le port par défaut, le trailing slash)
 */
function normalizeUrl(url: string): string {
  if (!url) return ''
  
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
}
