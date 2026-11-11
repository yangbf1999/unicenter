import { afterEach, describe, expect, it, vi } from 'vitest'

import { readJson } from '@/__tests__/setup/route-test'

import { GET } from './route'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/v1/license/status', () => {
  it('returns Community status without requesting an orchestrator', async () => {
    vi.stubEnv('ORCHESTRATOR_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({
      licensed: false,
      expired: false,
      edition: 'community',
    }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the configured orchestrator when Enterprise integration is enabled', async () => {
    vi.stubEnv('ORCHESTRATOR_URL', 'http://orchestrator:8080/')
    const payload = { licensed: true, expired: false, edition: 'enterprise' }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://orchestrator:8080/api/v1/license/status',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })
})
