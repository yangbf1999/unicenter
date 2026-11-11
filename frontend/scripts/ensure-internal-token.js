#!/usr/bin/env node
/**
 * Ensures INTERNAL_API_TOKEN is set before `next dev` / `next start` and
 * `ws-proxy.js` are spawned by `concurrently`. They run as sibling processes
 * and authenticate inter-process calls (`/api/internal/console/consume`) via
 * this shared secret.
 *
 * Resolution order:
 *   1. If process.env.INTERNAL_API_TOKEN is set (Docker entrypoint, systemd
 *      unit, CI, etc.), do nothing — the value will flow to both children.
 *   2. If repo-root .env, frontend/.env.local, or frontend/.env already
 *      contains INTERNAL_API_TOKEN, do nothing — Next.js / @next/env load them.
 *   3. Otherwise generate 32 random bytes and append the line to the
 *      repo-root .env (shared with compose / redeploy).
 *
 * Idempotent: safe to run on every `predev` / `prestart`. Designed so a client
 * upgrading via `git pull && npm start` on bare-metal recovers automatically
 * after the security fix that made INTERNAL_API_TOKEN mandatory.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..')
const ENV_FILE = path.join(REPO_ROOT, '.env')
const ENV_LOCAL = path.join(FRONTEND_ROOT, '.env.local')
const FRONTEND_ENV = path.join(FRONTEND_ROOT, '.env')

if (process.env.INTERNAL_API_TOKEN) {
  process.exit(0)
}

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return ''
    console.error(`[ensure-internal-token] Failed to read ${filePath}: ${err.message}`)
    process.exit(1)
  }
}

const envContent = readEnvFile(ENV_FILE)
const envLocalContent = readEnvFile(ENV_LOCAL)
const frontendEnvContent = readEnvFile(FRONTEND_ENV)

if (
  /^INTERNAL_API_TOKEN=.+/m.test(envContent) ||
  /^INTERNAL_API_TOKEN=.+/m.test(envLocalContent) ||
  /^INTERNAL_API_TOKEN=.+/m.test(frontendEnvContent)
) {
  process.exit(0)
}

const token = crypto.randomBytes(32).toString('hex')
const needsLeadingNewline = envContent.length > 0 && !envContent.endsWith('\n')
const block = `${needsLeadingNewline ? '\n' : ''}# Auto-generated for the ws-proxy <-> Next.js internal console channel.\n# Required since the security fix on /api/internal/console/consume.\nINTERNAL_API_TOKEN=${token}\n`

try {
  fs.appendFileSync(ENV_FILE, block, { mode: 0o600 })
  try { fs.chmodSync(ENV_FILE, 0o600) } catch {}
  console.log('[ensure-internal-token] Generated INTERNAL_API_TOKEN in repo-root .env')
} catch (err) {
  console.error(`[ensure-internal-token] Failed to write ${ENV_FILE}: ${err.message}`)
  process.exit(1)
}
