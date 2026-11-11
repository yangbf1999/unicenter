import { describe, expect, it } from 'vitest'

import { ensureForwardedOriginHeaders } from './public-origin'

describe('ensureForwardedOriginHeaders', () => {
  it('fills proto and host from the request URL when absent', () => {
    const headers = new Headers()
    ensureForwardedOriginHeaders(headers, {
      nextUrl: { protocol: 'http:', host: '192.0.2.40:3001' },
    })
    expect(headers.get('x-forwarded-proto')).toBe('http')
    expect(headers.get('x-forwarded-host')).toBe('192.0.2.40:3001')
  })

  it('does not overwrite proxy-supplied forwarded headers', () => {
    const headers = new Headers({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'unicenter.example.com',
      host: '10.0.0.1:3000',
    })
    ensureForwardedOriginHeaders(headers, {
      nextUrl: { protocol: 'http:', host: '10.0.0.1:3000' },
    })
    expect(headers.get('x-forwarded-proto')).toBe('https')
    expect(headers.get('x-forwarded-host')).toBe('unicenter.example.com')
  })

  it('prefers an existing Host header for x-forwarded-host', () => {
    const headers = new Headers({ host: 'app.local:3001' })
    ensureForwardedOriginHeaders(headers, {
      nextUrl: { protocol: 'https:', host: 'ignored.example' },
    })
    expect(headers.get('x-forwarded-proto')).toBe('https')
    expect(headers.get('x-forwarded-host')).toBe('app.local:3001')
  })
})
