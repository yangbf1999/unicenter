// Startup importer: seeds pre-existing on-disk assets (data/uploads/branding,
// data/uploads/login-bg; the compliance PDF logo is a 'branding' asset) into
// Postgres so every HA node serves them. Runs at every server boot via
// src/instrumentation.ts, AFTER migrations (the Docker entrypoint applies
// them before the server starts). Insert-only: an asset already present in
// uploaded_assets is never overwritten by a stale disk file.
//
// FS access is deliberately scoped under cwd/data/uploads with
// /*turbopackIgnore: true*/ so `next build` (Turbopack) does not try to
// trace the entire project into the server bundle.

import fs from 'node:fs'
import path from 'node:path'

import { getAsset, putAsset, slotFromFilename, type AssetKind } from './assetStore'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  gif: 'image/gif',
}

const KIND_DIRS: Array<{ dir: string; kind: AssetKind }> = [
  { dir: 'branding', kind: 'branding' },
  { dir: 'login-bg', kind: 'login-bg' },
]

function defaultUploadsRoot(): string {
  // Literal segments keep the scope under <cwd>/data/uploads.
  return path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'uploads')
}

/**
 * @param rootDir Override for tests only. Production uses `<cwd>/data/uploads`.
 */
export async function importDiskAssets(rootDir?: string): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0
  const root = rootDir ?? defaultUploadsRoot()
  if (!fs.existsSync(root)) return { imported, skipped }

  for (const { dir, kind } of KIND_DIRS) {
    const kindDir = path.join(/*turbopackIgnore: true*/ root, dir)
    if (!fs.existsSync(kindDir)) continue
    let tenantIds: string[]
    try {
      tenantIds = fs.readdirSync(kindDir)
    } catch {
      continue
    }
    for (const tenantId of tenantIds) {
      const tenantDir = path.join(/*turbopackIgnore: true*/ kindDir, tenantId)
      let st: fs.Stats
      try {
        st = fs.statSync(tenantDir)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      let files: string[]
      try {
        files = fs.readdirSync(tenantDir)
      } catch {
        continue
      }
      for (const file of files) {
        const ext = (file.split('.').pop() || '').toLowerCase()
        const contentType = MIME_BY_EXT[ext]
        if (!contentType) { skipped++; continue }
        const slot = slotFromFilename(file)
        const existing = await getAsset(tenantId, kind, slot)
        if (existing) { skipped++; continue }
        const filePath = path.join(/*turbopackIgnore: true*/ tenantDir, file)
        const data = fs.readFileSync(filePath)
        await putAsset(tenantId, kind, slot, ext, contentType, data)
        imported++
      }
    }
  }
  return { imported, skipped }
}
