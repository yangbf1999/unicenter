/**
 * NextAuth v4 `detectOrigin` (with AUTH_TRUST_HOST) builds
 * `${proto}://${host}` where proto defaults to **https** unless the value is
 * exactly `"http"`. Direct http://IP:port access often has no
 * `x-forwarded-proto`, so redirects would incorrectly jump to https.
 *
 * Fill missing forwarded origin headers from the actual request URL. Never
 * overwrite a client/proxy-supplied value.
 */
export function ensureForwardedOriginHeaders(
  headers: Headers,
  request: { nextUrl: { protocol: string; host: string } },
): void {
  if (!headers.get('x-forwarded-proto')) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'http'
    headers.set('x-forwarded-proto', proto)
  }
  if (!headers.get('x-forwarded-host')) {
    const host = headers.get('host') || request.nextUrl.host
    if (host) headers.set('x-forwarded-host', host)
  }
}
