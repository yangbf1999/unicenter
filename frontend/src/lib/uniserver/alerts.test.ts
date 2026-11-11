import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/auth/cookies', () => ({
  sessionCookieName: () => '__Secure-esage.next-auth.session-token',
}))

import { headers } from 'next/headers'

import { alertSessionCookieHeader, uniserverAlertFetch } from './alerts'

describe('uniserverAlertFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards only the configured NextAuth cookie including secure chunks', async () => {
    const cookie = [
      '__Secure-esage.next-auth.session-token.0=part-a',
      '__Secure-esage.next-auth.session-token.1=part-b',
      'esage.next-auth.session-token=plain',
      '__Host-esage.next-auth.csrf-token=csrf',
      'theme=dark',
    ].join('; ')
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ code: 0, data: { total: 0 } }),
      { status: 200 },
    ))

    await uniserverAlertFetch('/alerts')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('cookie')).toBe([
      '__Secure-esage.next-auth.session-token.0=part-a',
      '__Secure-esage.next-auth.session-token.1=part-b',
    ].join('; '))
    expect(new Headers(init.headers).has('x-api-key')).toBe(false)
    expect(new Headers(init.headers).has('x-tenant-id')).toBe(false)
  })

  it('does not forward unrelated cookies when the session cookie is absent', () => {
    expect(alertSessionCookieHeader('theme=dark; callback=/settings')).toBeNull()
  })
})
