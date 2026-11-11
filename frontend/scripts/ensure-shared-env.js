#!/usr/bin/env node
/**
 * Single source of truth: repo-root `.env` (compose + Next + ws-proxy).
 *
 * - Ensures `../.env` exists (seed from `../.env.example` when needed).
 * - If `frontend/.env` is a real file (not a symlink), merge keys that are
 *   missing from the root file, then replace it with a symlink to `../.env`.
 * - Local-only overrides belong in `frontend/.env.local` (Next.js loads it
 *   over the shared file; do not put secrets that Docker also needs only there).
 */
const fs = require('fs')
const path = require('path')

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..')
const ROOT_ENV = path.join(REPO_ROOT, '.env')
const ROOT_ENV_EXAMPLE = path.join(REPO_ROOT, '.env.example')
const FRONTEND_ENV = path.join(FRONTEND_ROOT, '.env')

function parseKeys(content) {
  const keys = new Set()
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (m) keys.add(m[1])
  }
  return keys
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

if (!fs.existsSync(ROOT_ENV)) {
  if (!fs.existsSync(ROOT_ENV_EXAMPLE)) {
    console.error('[ensure-shared-env] Missing repo-root .env and .env.example')
    process.exit(1)
  }
  fs.copyFileSync(ROOT_ENV_EXAMPLE, ROOT_ENV)
  console.log('[ensure-shared-env] Seeded repo-root .env from .env.example')
}

let frontendStat = null
try {
  frontendStat = fs.lstatSync(FRONTEND_ENV)
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}

if (frontendStat && frontendStat.isSymbolicLink()) {
  const target = path.resolve(FRONTEND_ROOT, fs.readlinkSync(FRONTEND_ENV))
  if (path.normalize(target) === path.normalize(ROOT_ENV)) {
    process.exit(0)
  }
  console.warn(`[ensure-shared-env] frontend/.env symlink points to ${target}; recreating → ${ROOT_ENV}`)
  fs.unlinkSync(FRONTEND_ENV)
  frontendStat = null
}

if (frontendStat && frontendStat.isFile()) {
  const rootContent = read(ROOT_ENV) || ''
  const feContent = read(FRONTEND_ENV) || ''
  const rootKeys = parseKeys(rootContent)
  const additions = []
  for (const line of feContent.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!m) continue
    const key = m[1]
    if (rootKeys.has(key)) continue
    additions.push(line)
    rootKeys.add(key)
  }
  if (additions.length > 0) {
    const prefix = rootContent.length > 0 && !rootContent.endsWith('\n') ? '\n' : ''
    fs.appendFileSync(
      ROOT_ENV,
      `${prefix}\n# Merged from frontend/.env (shared root .env)\n${additions.join('\n')}\n`,
    )
    console.log(`[ensure-shared-env] Merged ${additions.length} key(s) from frontend/.env into repo-root .env`)
  }
  const bak = `${FRONTEND_ENV}.bak-before-share`
  fs.renameSync(FRONTEND_ENV, bak)
  console.log(`[ensure-shared-env] Backed up frontend/.env → ${path.basename(bak)}`)
  frontendStat = null
}

if (!frontendStat) {
  try {
    // Relative symlink so the link stays valid if the repo is moved.
    fs.symlinkSync(path.relative(FRONTEND_ROOT, ROOT_ENV), FRONTEND_ENV)
    console.log('[ensure-shared-env] Linked frontend/.env → ../.env')
  } catch (err) {
    // Windows without Developer Mode / admin: fall back to a one-way copy and warn.
    fs.copyFileSync(ROOT_ENV, FRONTEND_ENV)
    console.warn(
      `[ensure-shared-env] Symlink failed (${err.code || err.message}); copied ../.env → frontend/.env.\n` +
        '  Enable Windows Developer Mode (or run as Admin) and re-run so frontend/.env becomes a symlink.\n' +
        '  Until then, edit ONLY the repo-root .env and re-run: node frontend/scripts/ensure-shared-env.js',
    )
  }
}

process.exit(0)
