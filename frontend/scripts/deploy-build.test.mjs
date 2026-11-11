import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(frontendDir, '..')
const deployScript = join(repoRoot, 'deploy.sh')
const dockerfile = join(frontendDir, 'Dockerfile')
const envExample = join(repoRoot, '.env.example')
const bashBin = process.env.BASH_BIN || 'bash'
const tempDirs = []

function setupFakeRuntime() {
  const root = mkdtempSync(join(tmpdir(), 'unicenter-deploy-build-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  tempDirs.push(root)

  const docker = join(bin, 'docker')
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -u
printf '%s|%s|image=%s\\n' "\${DOCKER_BUILDKIT:-unset}" "$*" "\${DEPLOY_IMAGE_NAME:-unset}" >> "$FAKE_DOCKER_LOG"

case "\${1:-}" in
  buildx)
    [[ "\${FAKE_BUILDX:-0}" == "1" ]]
    exit
    ;;
  info)
    exit 0
    ;;
  build)
    shift
    dockerfile=""
    while (( $# > 0 )); do
      if [[ "$1" == "-f" ]]; then
        dockerfile="$2"
        shift 2
        continue
      fi
      shift
    done
    printf '%s\\n' "$dockerfile" > "$FAKE_DOCKERFILE_PATH"
    cp "$dockerfile" "$FAKE_DOCKERFILE_CAPTURE"
    exit "\${FAKE_BUILD_STATUS:-0}"
    ;;
  image)
    exit 0
    ;;
  exec)
    exit 0
    ;;
  inspect)
    if [[ "$*" == *".State.Health"* ]]; then
      printf 'healthy\\n'
    else
      printf 'running\\n'
    fi
    exit 0
    ;;
  compose)
    if [[ "$*" == *"config --services"* ]]; then
      if [[ -n "\${FAKE_COMPOSE_SERVICES+x}" ]]; then
        printf '%b\\n' "$FAKE_COMPOSE_SERVICES"
      else
        printf 'frontend\\npostgres\\n'
      fi
    elif [[ "$*" == *"config --images"* ]]; then
      if [[ -n "\${FAKE_COMPOSE_IMAGES+x}" ]]; then
        printf '%b\\n' "$FAKE_COMPOSE_IMAGES"
      else
        printf '%s\\npostgres:16-alpine\\n' "\${DEPLOY_IMAGE_NAME:-unicenter-frontend:local}"
      fi
    elif [[ "$*" == *"ps -q postgres"* ]]; then
      printf 'postgres-id\\n'
    elif [[ "$*" == *"ps -q frontend"* ]]; then
      printf 'frontend-id\\n'
    fi
    exit 0
    ;;
esac
exit 0
`
  )
  chmodSync(docker, 0o755)

  const curl = join(bin, 'curl')
  writeFileSync(curl, '#!/usr/bin/env bash\nexit "${FAKE_CURL_STATUS:-0}"\n')
  chmodSync(curl, 0o755)

  return {
    root,
    log: join(root, 'docker.log'),
    dockerfilePath: join(root, 'dockerfile-path.txt'),
    dockerfileCapture: join(root, 'Dockerfile.capture'),
    envFile: join(root, '.env'),
    path: `${bin}${delimiter}${process.env.PATH}`
  }
}

function runDeploy(runtime, args, overrides = {}) {
  return spawnSync(bashBin, [deployScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: runtime.path,
      DEPLOY_ENV_FILE: runtime.envFile,
      DEPLOY_ENV_EXAMPLE_FILE: envExample,
      FAKE_DOCKER_LOG: runtime.log,
      FAKE_DOCKERFILE_PATH: runtime.dockerfilePath,
      FAKE_DOCKERFILE_CAPTURE: runtime.dockerfileCapture,
      ...overrides
    }
  })
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('deploy.sh Docker builder selection', () => {
  it('supports direct, bash and sh-compatible invocation forms', () => {
    const invocations = [
      [deployScript, []],
      [bashBin, [deployScript]],
      ['/bin/sh', [deployScript]]
    ]
    if (existsSync('/bin/dash')) invocations.push(['/bin/dash', [deployScript]])

    for (const [command, args] of invocations) {
      const result = spawnSync(command, [...args, '--help'], {
        cwd: repoRoot,
        encoding: 'utf8'
      })
      expect(result.status, `${command}: ${result.stderr}`).toBe(0)
      expect(result.stdout).toContain('UniCenter 本地源码部署脚本')
    }
  })

  it('pins the Compose project to unicenter-esage by default', () => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['build'], {
      FAKE_BUILDX: '1',
      COMPOSE_PROJECT: 'legacy-project',
      COMPOSE_PROJECT_NAME: 'standard-project'
    })

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    const log = readFileSync(runtime.log, 'utf8')
    expect(log).toMatch(/compose -f .* --env-file .* -p unicenter-esage config --quiet/)
    expect(log).not.toContain('-p legacy-project')
    expect(log).not.toContain('-p standard-project')
  })

  it('allows DEPLOY_COMPOSE_PROJECT to override the default project', () => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['build'], {
      FAKE_BUILDX: '1',
      DEPLOY_COMPOSE_PROJECT: 'custom-project'
    })

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(readFileSync(runtime.log, 'utf8')).toMatch(
      /compose -f .* --env-file .* -p custom-project config --quiet/
    )
  })

  it('uses BuildKit and the tracked Dockerfile when buildx is available', () => {
    const runtime = setupFakeRuntime()
    const original = readFileSync(dockerfile, 'utf8')

    const result = runDeploy(runtime, ['build'], { FAKE_BUILDX: '1' })

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(runtime.log, 'utf8')).toContain('1|build ')
    const selectedDockerfile = readFileSync(runtime.dockerfilePath, 'utf8').trim().replaceAll('\\', '/').toLowerCase()
    expect(selectedDockerfile).toMatch(/\/frontend\/dockerfile$/)
    expect(selectedDockerfile).not.toContain('unicenter-dockerfile.')
    expect(readFileSync(runtime.dockerfileCapture, 'utf8')).toContain('RUN --mount=type=cache')
    expect(readFileSync(dockerfile, 'utf8')).toBe(original)
  })

  it('falls back to a cleaned temporary Dockerfile without modifying the source', () => {
    const runtime = setupFakeRuntime()
    const original = readFileSync(dockerfile, 'utf8')

    const result = runDeploy(runtime, ['build'], { FAKE_BUILDX: '0' })

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(runtime.log, 'utf8')).toContain('0|build ')
    expect(readFileSync(runtime.dockerfileCapture, 'utf8')).not.toContain('RUN --mount=type=cache')
    expect(readFileSync(dockerfile, 'utf8')).toBe(original)
    expect(existsSync(readFileSync(runtime.dockerfilePath, 'utf8').trim())).toBe(false)
  })

  it('cleans the temporary Dockerfile when docker build fails', () => {
    const runtime = setupFakeRuntime()
    const original = readFileSync(dockerfile, 'utf8')

    const result = runDeploy(runtime, ['build'], {
      FAKE_BUILDX: '0',
      FAKE_BUILD_STATUS: '23'
    })

    expect(result.status).toBe(1)
    expect(readFileSync(dockerfile, 'utf8')).toBe(original)
    expect(existsSync(readFileSync(runtime.dockerfilePath, 'utf8').trim())).toBe(false)
  })

  it('redeploy force-recreates frontend without force-recreating postgres', () => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['redeploy'], { FAKE_BUILDX: '1' })

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    const log = readFileSync(runtime.log, 'utf8')
    expect(log).toMatch(/compose .*up -d --no-build --pull missing --no-recreate postgres/)
    expect(log).toMatch(/compose .*up -d --no-build --pull missing --force-recreate --no-deps frontend/)
    expect(log).not.toMatch(/--force-recreate postgres/)
  })

  it('uses the same custom image name for build and Compose', () => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['redeploy'], {
      FAKE_BUILDX: '1',
      DEPLOY_IMAGE_NAME: 'custom:test'
    })

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    const log = readFileSync(runtime.log, 'utf8')
    expect(log).toMatch(/build .* -t custom:test /)
    expect(log).toMatch(/compose .*config --quiet\|image=custom:test/)
    expect(readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8')).toContain(
      'image: ${DEPLOY_IMAGE_NAME:-unicenter-frontend:local}'
    )
  })

  it('fails redeploy when the host HTTP health check never succeeds', () => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['redeploy'], {
      FAKE_BUILDX: '1',
      FAKE_CURL_STATUS: '22',
      HEALTH_WAIT_SECS: '1'
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('宿主机 HTTP 健康检查在 1s 内未通过')
  })

  it.each([
    ['docker-compose.community.yml', 'Community 发布安装流程']
  ])('rejects release Compose file %s', (composeFile, message) => {
    const runtime = setupFakeRuntime()

    const result = runDeploy(runtime, ['build'], {
      FAKE_BUILDX: '1',
      DEPLOY_COMPOSE_FILE: join(repoRoot, composeFile)
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(message)
  })

  it('rejects a custom Compose file that does not satisfy the source-stack contract', () => {
    const runtime = setupFakeRuntime()
    const customCompose = join(runtime.root, 'custom-compose.yml')
    writeFileSync(customCompose, 'services: {}\n')

    const result = runDeploy(runtime, ['build'], {
      FAKE_BUILDX: '1',
      FAKE_COMPOSE_SERVICES: 'frontend',
      DEPLOY_COMPOSE_FILE: customCompose
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('缺少 PostgreSQL 服务 postgres')
  })
})
