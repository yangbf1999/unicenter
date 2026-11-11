import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(frontendDir, '..')
const deployScript = join(repoRoot, 'deploy.sh')
const envExample = join(repoRoot, '.env.example')
const dockerEntrypoint = join(frontendDir, 'docker-entrypoint.sh')
const bashBin = process.env.BASH_BIN || 'bash'
const tempDirs = []

function temporaryEnvFile() {
  const directory = mkdtempSync(join(tmpdir(), 'unicenter-deploy-env-'))
  tempDirs.push(directory)
  return join(directory, '.env')
}

function runInit(envFile, publicUrl) {
  return execFileSync(bashBin, [deployScript, 'init-env'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEPLOY_ENV_FILE: envFile,
      DEPLOY_ENV_EXAMPLE_FILE: envExample,
      ...(publicUrl ? { DEPLOY_PUBLIC_URL: publicUrl } : {})
    }
  })
}

function envValue(content, key) {
  return content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('deploy.sh environment initialisation', () => {
  it('copies .env.example and replaces placeholders without modifying the template', () => {
    const envFile = temporaryEnvFile()
    const exampleBefore = readFileSync(envExample, 'utf8')

    runInit(envFile, 'http://192.0.2.10:3001/')

    const content = readFileSync(envFile, 'utf8')
    expect(readFileSync(envExample, 'utf8')).toBe(exampleBefore)
    expect(envValue(content, 'APP_SECRET')).toMatch(/^[0-9a-f]{64}$/)
    expect(envValue(content, 'NEXTAUTH_SECRET')).toMatch(/^[0-9a-f]{64}$/)
    expect(envValue(content, 'POSTGRES_PASSWORD')).toMatch(/^[0-9a-f]{48}$/)
    expect(envValue(content, 'INTERNAL_API_TOKEN')).toMatch(/^[0-9a-f]{64}$/)
    expect(envValue(content, 'NEXTAUTH_URL')).toBe('http://192.0.2.10:3001')
    expect(envValue(content, 'APP_URL')).toBe('http://192.0.2.10:3001')
    expect(envValue(content, 'AUTH_TRUST_HOST')).toBe('true')
    // Windows does not expose POSIX chmod bits; Linux/WSL deployment hosts do.
    if (process.platform !== 'win32') expect(statSync(envFile).mode & 0o777).toBe(0o600)
  })

  it('defaults to dynamic Host when DEPLOY_PUBLIC_URL is unset', () => {
    const envFile = temporaryEnvFile()

    runInit(envFile)

    const content = readFileSync(envFile, 'utf8')
    expect(envValue(content, 'AUTH_TRUST_HOST')).toBe('true')
    expect(envValue(content, 'NEXTAUTH_URL') ?? '').toBe('')
    expect(envValue(content, 'APP_URL') ?? '').toBe('')
    expect(envValue(content, 'APP_SECRET')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('unsets blank public URLs before starting the application', () => {
    const probe = [
      'process.stdout.write(JSON.stringify({',
      "nextauth: Object.hasOwn(process.env, 'NEXTAUTH_URL'),",
      "app: Object.hasOwn(process.env, 'APP_URL')",
      '}))',
    ].join('')
    const result = spawnSync(dockerEntrypoint, ['node', '-e', probe], {
      cwd: frontendDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        DEMO_MODE: 'true',
        NEXTAUTH_URL: '',
        APP_URL: '   ',
      },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('{"nextauth":false,"app":false}')
  })

  it('preserves explicitly configured public URLs in the container', () => {
    const publicUrl = 'https://unicenter.example.test'
    const probe = [
      'process.stdout.write(JSON.stringify({',
      'nextauth: process.env.NEXTAUTH_URL,',
      'app: process.env.APP_URL',
      '}))',
    ].join('')
    const result = spawnSync(dockerEntrypoint, ['node', '-e', probe], {
      cwd: frontendDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        DEMO_MODE: 'true',
        NEXTAUTH_URL: publicUrl,
        APP_URL: publicUrl,
      },
    })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(JSON.stringify({ nextauth: publicUrl, app: publicUrl }))
  })

  it('preserves existing secrets while explicitly updating the public URL', () => {
    const envFile = temporaryEnvFile()
    writeFileSync(
      envFile,
      [
        'APP_SECRET=keep-app-secret',
        'NEXTAUTH_SECRET=keep-nextauth-secret',
        'NEXTAUTH_URL=http://192.0.2.20:3001',
        'APP_URL=http://192.0.2.20:3001',
        'POSTGRES_USER=unicenter',
        'POSTGRES_PASSWORD=keep-database-password',
        'POSTGRES_DB=unicenter',
        'INTERNAL_API_TOKEN=keep-internal-token',
        ''
      ].join('\n')
    )

    runInit(envFile, 'https://unicenter.example.test')

    const content = readFileSync(envFile, 'utf8')
    expect(envValue(content, 'APP_SECRET')).toBe('keep-app-secret')
    expect(envValue(content, 'NEXTAUTH_SECRET')).toBe('keep-nextauth-secret')
    expect(envValue(content, 'POSTGRES_PASSWORD')).toBe('keep-database-password')
    expect(envValue(content, 'INTERNAL_API_TOKEN')).toBe('keep-internal-token')
    expect(envValue(content, 'NEXTAUTH_URL')).toBe('https://unicenter.example.test')
    expect(envValue(content, 'APP_URL')).toBe('https://unicenter.example.test')
  })

  it('ignores .env but keeps .env.example available to Git', () => {
    const ignored = spawnSync('git', ['check-ignore', '--no-index', '-q', '.env'], { cwd: repoRoot })
    const template = spawnSync('git', ['check-ignore', '--no-index', '-q', '.env.example'], { cwd: repoRoot })

    expect(ignored.status).toBe(0)
    expect(template.status).toBe(1)
  })
})
