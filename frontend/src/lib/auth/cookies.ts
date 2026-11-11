// Single source of truth for NextAuth cookie names and the `secure` flag.
//
// The NAMES stay derived from NEXTAUTH_URL when set (+ optional
// AUTH_COOKIE_PREFIX) and are static for the process lifetime: three readers
// (proxy.ts twice, the 2FA verify route) must look up the same name the
// issuer wrote, and they have no per-request agreement with it. With
// NEXTAUTH_URL unset (dynamic Host + AUTH_TRUST_HOST), names stay unprefixed;
// the Secure *flag* still follows the request via resolveCookieSecure.
//
// AUTH_COOKIE_PREFIX disambiguates cookies when two UniCenter instances
// share a browser host but differ by port (browsers scope cookies by host,
// not port). Example: AUTH_COOKIE_PREFIX=esage -> esage.next-auth.session-token.
// `__Secure-` / `__Host-` stay as the leading RFC prefixes when HTTPS is on.
//
// The FLAG is per-request and monotonic: env OR actual transport. It can only
// ever ADD `Secure`, never remove it, so no existing session regresses. A
// spoofed x-forwarded-proto can only make the attacker's own browser refuse
// to send the cookie over http — the failure direction is safe, which is why
// this needs no TRUST_PROXY_HEADERS opt-in. Requiring one would recreate the
// exact trap being fixed: TLS added, variable forgotten, still vulnerable.

export function envPrefersSecureCookies(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith('https://') ?? false
}

/** Sanitized instance label, empty or ending with `.` (e.g. `esage.`). */
export function cookieNamePrefix(): string {
  const raw = process.env.AUTH_COOKIE_PREFIX?.trim()
  if (!raw) return ''
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '')
  return safe ? `${safe}.` : ''
}

export function sessionCookieName(): string {
  const p = cookieNamePrefix()
  return envPrefersSecureCookies()
    ? `__Secure-${p}next-auth.session-token`
    : `${p}next-auth.session-token`
}

export function callbackUrlCookieName(): string {
  const p = cookieNamePrefix()
  return envPrefersSecureCookies()
    ? `__Secure-${p}next-auth.callback-url`
    : `${p}next-auth.callback-url`
}

export function csrfCookieName(): string {
  const p = cookieNamePrefix()
  return envPrefersSecureCookies()
    ? `__Host-${p}next-auth.csrf-token`
    : `${p}next-auth.csrf-token`
}

export function requestPrefersSecure(headers: Headers | null | undefined): boolean {
  if (!headers) return false
  const proto = headers.get('x-forwarded-proto')
  if (proto) {
    // Only the first hop is client-facing; later hops describe internal legs.
    const first = proto.split(',')[0]?.trim().toLowerCase()
    if (first === 'https') return true
    if (first === 'http') return false
  }
  return headers.get('x-forwarded-ssl')?.trim().toLowerCase() === 'on'
}

export function resolveCookieSecure(headers: Headers | null | undefined): boolean {
  return envPrefersSecureCookies() || requestPrefersSecure(headers)
}
