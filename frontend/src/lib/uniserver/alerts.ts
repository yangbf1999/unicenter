import { headers as requestHeaders } from 'next/headers'
import { NextResponse } from 'next/server'

import { sessionCookieName } from '@/lib/auth/cookies'

const UNISERVER_URL = process.env.UNISERVER_URL || 'http://localhost:8090'

type AlertRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  timeout?: number
  request?: Request
}

type UniserverResponse<T> = {
  code?: number
  msg?: string | null
  data?: T
  error?: string
}

export class UniserverAlertError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'UniserverAlertError'
  }
}

export function alertSessionCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const baseName = sessionCookieName()
  const cookies = cookieHeader.split(';').flatMap(part => {
    const cookie = part.trim()
    const separator = cookie.indexOf('=')
    if (separator < 1) return []
    const name = cookie.slice(0, separator)
    const suffix = name.slice(baseName.length + 1)
    const isSessionCookie = name === baseName
      || (name.startsWith(`${baseName}.`) && /^\d+$/.test(suffix))
    return isSessionCookie ? [cookie] : []
  })
  return cookies.length > 0 ? cookies.join('; ') : null
}

export async function uniserverAlertFetch<T>(
  path: string,
  options: AlertRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, timeout = 10_000, request } = options
  const incoming = request?.headers ?? (await requestHeaders())
  const headers = new Headers({ Accept: 'application/json' })
  const cookie = alertSessionCookieHeader(incoming.get('cookie'))
  const requestId = incoming.get('x-request-id')

  if (cookie) headers.set('Cookie', cookie)
  if (requestId) headers.set('X-Request-ID', requestId)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${UNISERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text()
    let payload: UniserverResponse<T> = {}

    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      throw new UniserverAlertError(
        response.ok ? 502 : response.status,
        'ALERT_UPSTREAM_INVALID_RESPONSE',
        'Alert service returned an invalid response',
      )
    }

    if (!response.ok || payload.code !== 0) {
      throw new UniserverAlertError(
        response.status,
        payload.error || 'ALERT_UPSTREAM_ERROR',
        payload.msg || 'Alert service request failed',
      )
    }

    return payload.data as T
  } catch (error) {
    if (error instanceof UniserverAlertError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UniserverAlertError(504, 'ALERT_UPSTREAM_TIMEOUT', 'Alert service request timed out')
    }
    throw new UniserverAlertError(503, 'ALERT_UPSTREAM_UNAVAILABLE', 'Alert service is unavailable')
  } finally {
    clearTimeout(timeoutId)
  }
}

export function uniserverAlertErrorResponse(error: unknown): NextResponse {
  if (error instanceof UniserverAlertError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }
  return NextResponse.json(
    { error: 'Alert service request failed', code: 'ALERT_UPSTREAM_ERROR' },
    { status: 500 },
  )
}

export function alertPageResponse(page: Record<string, unknown>): Record<string, unknown> {
  const { records, ...rest } = page
  return { ...rest, data: Array.isArray(records) ? records : [] }
}
