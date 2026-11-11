import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(frontendDir, '..')
const retiredBrand = ['Prox', 'Center'].join('')
const retiredBrandUpper = retiredBrand.toUpperCase()
const retiredClassicTokenFile = `${retiredBrand.toLowerCase()}.classic.tokens.json`

const readRepoFile = (path) => readFileSync(join(repoRoot, path), 'utf8')

describe('UniCenter application identity', () => {
  it('uses UniCenter as the frontend package identity', () => {
    const manifest = JSON.parse(readRepoFile('frontend/package.json'))
    const lock = JSON.parse(readRepoFile('frontend/package-lock.json'))

    expect(manifest.name).toBe('unicenter')
    expect(lock.name).toBe('unicenter')
    expect(lock.packages[''].name).toBe('unicenter')
  })

  it('uses only UniCenter database defaults for a new Community deployment', () => {
    const deploySource = readRepoFile('deploy.sh')

    expect(deploySource).toContain('append_env_if_missing POSTGRES_USER "unicenter"')
    expect(deploySource).toContain('append_env_if_missing POSTGRES_DB "unicenter"')
    expect(deploySource).not.toContain('POSTGRES_USER_OLD')
    expect(deploySource).not.toContain('LEGACY_POSTGRES')
  })

  it('does not use the managed-platform name for UniCenter metadata', () => {
    const readme = readRepoFile('README.md')
    const architecture = readRepoFile('architecture.md')
    const backupJobs = readRepoFile('frontend/src/app/(dashboard)/infrastructure/inventory/BackupJobsPanel.tsx')

    expect(readme).toContain('| `unicenter` |')
    expect(architecture).toContain('| npm 包名 | `unicenter`')
    expect(backupJobs).not.toMatch(/(?:unisphereLogoSrc|proxcenter|ezcenter)/i)
  })

  it('does not expose the retired brand in the classic UI', () => {
    const visibleBrandFiles = [
      'frontend/src/@layouts/components/vertical/LayoutContent.jsx',
      'frontend/src/components/layout/vertical/Navigation.jsx',
      'frontend/src/components/layout/vertical/VcenterNavbarContent.jsx'
    ]

    for (const path of visibleBrandFiles) {
      const source = readRepoFile(path)
      expect(source, path).toContain('UniCenter')
      expect(source, path).not.toContain(retiredBrand)
    }

    expect(existsSync(join(repoRoot, 'frontend/default/tokens', retiredClassicTokenFile))).toBe(false)
    expect(existsSync(join(repoRoot, 'frontend/public/images', `${retiredBrand.toLowerCase()}.png`))).toBe(false)

    const serverEntry = readRepoFile('frontend/start.js')
    expect(serverEntry).toContain('UniCenter')
    expect(serverEntry).not.toContain('██████╗ ██╗  ██╗ ██████╗')

    const classicTokens = JSON.parse(readRepoFile('frontend/default/tokens/unicenter.classic.tokens.json'))
    expect(classicTokens.name).toBe('UniCenter Classic')
    expect(classicTokens.source).toContain('UniCenter')
    expect(classicTokens.source).not.toContain(retiredBrand)
  })

  it('uses UniCenter names for the local development proxy contract', () => {
    const nextConfig = readRepoFile('frontend/next.config.mjs')
    const proxy = readRepoFile('frontend/src/proxy.ts')
    const themes = readRepoFile('frontend/src/configs/globalThemesConfig.js')

    expect(nextConfig).toContain('UNICENTER_PROXY_UPSTREAM')
    expect(proxy).toContain('UNICENTER_PROXY_AUTH_BYPASS')
    expect(proxy).toContain('UNICENTER_PROXY_UPSTREAM')
    expect(themes).toContain('--unicenter-transition-duration')
    expect(`${nextConfig}\n${proxy}\n${themes}`).not.toContain(retiredBrandUpper)
    expect(themes).not.toContain(`--${retiredBrand.toLowerCase()}-`)
  })

  it('pins Community installation sources while allowing candidate overrides', () => {
    const installer = readRepoFile('install-community.sh')
    const compose = readRepoFile('docker-compose.community.yml')
    const readme = readRepoFile('README.md')

    expect(installer).toContain('RELEASE_VERSION="${UNICENTER_VERSION:-1.0.0}"')
    expect(installer).toContain('RELEASE_REF="${UNICENTER_RELEASE_REF:-v${RELEASE_VERSION}}"')
    expect(installer).toContain('COMPOSE_URL="${UNICENTER_COMPOSE_URL:-')
    expect(installer).toContain('FRONTEND_IMAGE="${UNICENTER_IMAGE:-')
    expect(installer).toContain('UNICENTER_IMAGE=$FRONTEND_IMAGE')
    expect(installer).toContain('"$FRONTEND_IMAGE"')
    expect(installer).toContain('Existing secrets preserved and image version updated')
    expect(installer).toContain('docker compose config --images')
    expect(installer).toContain('centos|rhel|rocky|almalinux|fedora|openEuler|openeuler')
    expect(installer).toContain('centos|rhel|rocky|almalinux|fedora)')
    expect(installer).not.toContain('centos|rhel|rocky|almalinux|fedora|openEuler|openeuler)\n            dnf remove')
    expect(installer).toContain('openEuler requires Docker Engine 24+ and Docker Compose v2')
    expect(installer).toContain('docker version --format')
    expect(installer).toContain('docker compose version --short')
    expect(installer).toContain('UniCenter')
    expect(installer).not.toContain('/main/docker-compose.community.yml')
    expect(installer).not.toContain('unicenter-frontend:latest')
    expect(installer).not.toContain('Upgrade to Enterprise')
    expect(installer).not.toContain(retiredBrand)

    expect(compose).toContain('image: ${UNICENTER_IMAGE:-unicenter-frontend:1.0.0}')
    expect(compose).not.toContain('${REGISTRY:-')
    expect(compose).not.toContain('${VERSION:-latest}')

    expect(readme).toContain('/v1.0.0/install-community.sh')
    expect(readme).toContain('fixed image version')
    expect(readme).toContain('openEuler 22.03')
    expect(readme).toContain('the installer does not install or upgrade Docker on openEuler')
  })
})
