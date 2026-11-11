import createNextIntlPlugin from 'next-intl/plugin'
import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

// Shared env lives at repo root (compose + local). Symlink frontend/.env → ../.env
// is ensured by scripts/ensure-shared-env.js; also load root here for next.config.
// @next/env is CJS — use default import (named ESM import fails under Turbopack build).
const { loadEnvConfig } = nextEnv
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
// Docker build context is only ./frontend (WORKDIR /app). Parent is `/` — never
// loadEnvConfig('/') or the builder walks the whole filesystem.
if (
  existsSync(resolve(repoRoot, '.env')) ||
  existsSync(resolve(repoRoot, '.env.local')) ||
  existsSync(resolve(repoRoot, '.env.production'))
) {
  loadEnvConfig(repoRoot)
}
loadEnvConfig(__dirname)

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const proxyUpstream = process.env.UNICENTER_PROXY_UPSTREAM?.replace(/\/+$/, '')

/**
 * Turbopack requires its `root` to be absolute and to CONTAIN the real
 * node_modules. In a git worktree we symlink node_modules to the main
 * checkout, which lives outside the worktree directory; Turbopack then
 * aborts with "Symlink node_modules is invalid, it points out of the
 * filesystem root". Detect that case and widen the root to the common
 * ancestor of the worktree and the symlink target, so `npm run dev`
 * keeps using Turbopack inside worktrees. A normal checkout (real
 * node_modules) just uses the current directory, unchanged.
 */
function resolveTurbopackRoot() {
    const cwd = process.cwd()
    try {
        const nm = resolve(cwd, 'node_modules')
        if (lstatSync(nm).isSymbolicLink()) {
            const target = realpathSync(nm)
            const a = cwd.split(sep)
            const b = target.split(sep)
            let i = 0
            while (i < a.length && i < b.length && a[i] === b[i]) i++
            return a.slice(0, i).join(sep) || sep
        }
    } catch {
        // Fall back to the current directory on any fs error.
    }
    return cwd
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    basePath: process.env.BASEPATH,
    poweredByHeader: false,
    typescript: {
        // Since 16.3 the build type check covers every file in tsconfig
        // include, tests included; keep the build scope free of them.
        tsconfigPath: 'tsconfig.build.json',
    },
    serverExternalPackages: ['ssh2', 'undici'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10gb',
        },
        proxyClientMaxBodySize: '10gb',
    },
    turbopack: {
        root: resolveTurbopackRoot(),
    },
    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
        },
    ],
    redirects: async () => {
        return [
            {
                source: '/',
                destination: '/home',
                permanent: true,
                locale: false
            }
        ];
    },
    rewrites: async () => proxyUpstream
        ? {
            beforeFiles: [
                {
                    source: '/api/:path*',
                    destination: `${proxyUpstream}/api/:path*`,
                },
            ],
            afterFiles: [],
            fallback: [],
        }
        : [],
};

export default withNextIntl(nextConfig);
