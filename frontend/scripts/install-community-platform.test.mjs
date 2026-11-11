import { afterEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const installer = resolve(frontendDir, '..', 'install-community.sh')
const tempDirs = []

const makeFakeDocker = (source) => {
  const directory = mkdtempSync(join(tmpdir(), 'unicenter-installer-'))
  const executable = join(directory, 'docker')

  tempDirs.push(directory)
  writeFileSync(executable, `#!/bin/bash\n${source}\n`)
  chmodSync(executable, 0o755)
  return directory
}

const runInstallDocker = ({ os = 'openEuler', path = '/usr/bin:/bin' } = {}) =>
  spawnSync(
    '/bin/bash',
    ['-c', `source "$1"; OS="$2"; PATH="$3"; install_docker`, 'installer-test', installer, os, path],
    {
      encoding: 'utf8',
      env: process.env
    }
  )

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('Community installer Docker host requirements', () => {
  it('requires a preinstalled Docker stack on openEuler', () => {
    const result = runInstallDocker({ path: '/path-without-docker' })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('openEuler requires Docker Engine 24+ and Docker Compose v2')
    expect(result.stdout).toContain('Automatic Docker installation or upgrade is not supported on openEuler')
  })

  it('rejects Docker Engine versions older than 24', () => {
    const fakeBin = makeFakeDocker(`
if [[ "$1" == "version" ]]; then echo "18.09.9"; exit 0; fi
exit 1
`)
    const result = runInstallDocker({ path: `${fakeBin}:/usr/bin:/bin` })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Docker Engine 24+ is required (found: 18.09.9)')
  })

  it('rejects a missing or legacy Docker Compose installation', () => {
    const missingComposeBin = makeFakeDocker(`
if [[ "$1" == "version" ]]; then echo "24.0.9"; exit 0; fi
exit 1
`)
    const missingResult = runInstallDocker({ path: `${missingComposeBin}:/usr/bin:/bin` })

    expect(missingResult.status).toBe(1)
    expect(missingResult.stdout).toContain('Docker Compose v2 is required')

    const legacyComposeBin = makeFakeDocker(`
if [[ "$1" == "version" ]]; then echo "24.0.9"; exit 0; fi
if [[ "$1 $2 $3" == "compose version --short" ]]; then echo "1.29.2"; exit 0; fi
exit 1
`)
    const legacyResult = runInstallDocker({ path: `${legacyComposeBin}:/usr/bin:/bin` })

    expect(legacyResult.status).toBe(1)
    expect(legacyResult.stdout).toContain('Docker Compose v2 is required (found: 1.29.2)')
  })

  it('accepts Docker Engine 24+ and Docker Compose v2 on openEuler', () => {
    const fakeBin = makeFakeDocker(`
if [[ "$1" == "version" ]]; then echo "26.1.3"; exit 0; fi
if [[ "$1 $2 $3" == "compose version --short" ]]; then echo "v2.32.0"; exit 0; fi
exit 1
`)
    const result = runInstallDocker({ path: `${fakeBin}:/usr/bin:/bin` })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Docker Engine 26.1.3 and Docker Compose v2.32.0 are ready')
  })
})
