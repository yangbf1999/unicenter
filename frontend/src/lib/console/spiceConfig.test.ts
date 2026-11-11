// frontend/src/lib/console/spiceConfig.test.ts
import { describe, expect, it } from 'vitest'
import { parseSpiceConfig } from './spiceConfig'

const base = {
  type: 'spice',
  host: 'unispherespiceproxy:57bf...ticket',
  // eSage sets `proxy` to the TARGET NODE's own hostname, which is often
  // NOT resolvable from UniCenter. The parser must ignore this host and
  // use the connection host instead.
  proxy: 'http://unisphere-3az-5-c:3128',
  'tls-port': 61000,
  password: 'SPICE-TICKET',
  ca: '-----BEGIN CERTIFICATE-----\\nMIIA\\n-----END CERTIFICATE-----\\n',
  'host-subject': 'OU=UNISPHERE Cluster Node,O=eSage Virtual Environment,CN=unisphere1',
}

describe('parseSpiceConfig', () => {
  it('uses the connection host (NOT the proxy node name) and parses ticket/tls/ca/host-subject', () => {
    const r = parseSpiceConfig(base, 'https://unisphere1.example:8006')
    expect(r).toMatchObject({
      proxyticket: 'unispherespiceproxy:57bf...ticket',
      proxyHost: 'unisphere1.example', // the connection host, not "unisphere-3az-5-c"
      proxyPort: 3128,
      tlsPort: 61000,
      password: 'SPICE-TICKET',
      hostSubject: 'OU=UNISPHERE Cluster Node,O=eSage Virtual Environment,CN=unisphere1',
    })
    // Regression guard: never connect to the unresolvable node name.
    expect(r.proxyHost).not.toBe('unisphere-3az-5-c')
    // \n escape sequences unescaped into a real PEM
    expect(r.ca).toContain('\n')
    expect(r.ca).not.toContain('\\n')
  })

  it('honours a custom spiceproxy port from the proxy field (host still the connection host)', () => {
    const r = parseSpiceConfig({ ...base, proxy: 'http://unisphere-3az-5-c:3129' }, 'https://unisphere1.example:8006')
    expect(r.proxyHost).toBe('unisphere1.example')
    expect(r.proxyPort).toBe(3129)
  })

  it('defaults the port to 3128 when the proxy field is absent', () => {
    const cfg = { ...base }
    delete (cfg as any).proxy
    const r = parseSpiceConfig(cfg, 'https://unisphere1.example:8006')
    expect(r.proxyHost).toBe('unisphere1.example')
    expect(r.proxyPort).toBe(3128)
  })

  it('falls back to "port" when "tls-port" is absent', () => {
    const cfg: any = { ...base }
    delete cfg['tls-port']
    cfg.port = 5901
    expect(parseSpiceConfig(cfg, 'https://unisphere1.example:8006').tlsPort).toBe(5901)
  })

  it('throws when no usable port or proxyticket is present', () => {
    expect(() => parseSpiceConfig({} as any, 'https://unisphere1.example:8006')).toThrow()
  })

  it('defaults password/ca/host-subject to empty strings when absent', () => {
    const r = parseSpiceConfig({ host: 'pt', 'tls-port': 61000 } as any, 'https://unisphere1.example:8006')
    expect(r.password).toBe('')
    expect(r.ca).toBe('')
    expect(r.hostSubject).toBe('')
    expect(r.proxyPort).toBe(3128)
  })

  it('extracts the host from a scheme-less connBaseUrl (new URL throws -> regex fallback)', () => {
    // '192.168.1.1:8006' has no scheme so new URL() throws; the regex must
    // still extract the host. ('unisphere1.example:8006' would NOT throw because
    // Node parses "unisphere1.example" as a scheme, hence the IP form here.)
    const r = parseSpiceConfig(base, '192.168.1.1:8006')
    expect(r.proxyHost).toBe('192.168.1.1')
    expect(r.proxyPort).toBe(3128)
  })
})
