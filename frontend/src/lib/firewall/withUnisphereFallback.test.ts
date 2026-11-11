import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { orchestratorOrUnisphere } from './withUnisphereFallback'

function unavailableError(): Error {
  const err: any = new Error('Orchestrator unavailable')

  err.code = 'ORCHESTRATOR_UNAVAILABLE'

  return err
}

describe('orchestratorOrUnisphere', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('returns the unwrapped orchestrator data and never calls UNISPHERE on success', async () => {
    const unisphereCall = vi.fn()

    const result = await orchestratorOrUnisphere(
      'firewall/vms',
      async () => ({ data: [{ pos: 0, type: 'in', action: 'ACCEPT' }] }),
      unisphereCall,
    )

    expect(result).toEqual([{ pos: 0, type: 'in', action: 'ACCEPT' }])
    expect(unisphereCall).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('does not fall back on empty/null orchestrator data — only on errors', async () => {
    const unisphereCall = vi.fn()

    const result = await orchestratorOrUnisphere('firewall/vms', async () => ({ data: null as any }), unisphereCall)

    expect(result).toBeNull()
    expect(unisphereCall).not.toHaveBeenCalled()
  })

  it('falls back to UNISPHERE on ORCHESTRATOR_UNAVAILABLE and returns the bare shape', async () => {
    const unisphereCall = vi.fn().mockResolvedValue([{ pos: 1, type: 'out', action: 'DROP' }])

    const result = await orchestratorOrUnisphere(
      'firewall/cluster',
      () => Promise.reject(unavailableError()),
      unisphereCall,
    )

    expect(result).toEqual([{ pos: 1, type: 'out', action: 'DROP' }])
    expect(unisphereCall).toHaveBeenCalledTimes(1)
  })

  it('logs the fallback once, in the SSH fallback style', async () => {
    await orchestratorOrUnisphere('firewall/vms', () => Promise.reject(unavailableError()), async () => 'ok')

    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('[firewall/vms] orchestrator unavailable, falling back to direct UNISPHERE')
  })

  it('rethrows non-unavailable orchestrator errors unchanged and never calls UNISPHERE', async () => {
    const unisphereCall = vi.fn()
    const licenseErr = new Error('Orchestrator 403: feature not licensed')

    await expect(
      orchestratorOrUnisphere('firewall/groups', () => Promise.reject(licenseErr), unisphereCall),
    ).rejects.toBe(licenseErr)
    expect(unisphereCall).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('rethrows timeouts — a timeout is not "unreachable"', async () => {
    const unisphereCall = vi.fn()
    const timeoutErr = new Error('Orchestrator request timeout')

    await expect(
      orchestratorOrUnisphere('firewall/nodes', () => Promise.reject(timeoutErr), unisphereCall),
    ).rejects.toBe(timeoutErr)
    expect(unisphereCall).not.toHaveBeenCalled()
  })

  it('rethrows errors carrying a different code property', async () => {
    const unisphereCall = vi.fn()
    const otherErr: any = new Error('boom')

    otherErr.code = 'ECONNRESET'

    await expect(
      orchestratorOrUnisphere('firewall/aliases', () => Promise.reject(otherErr), unisphereCall),
    ).rejects.toBe(otherErr)
    expect(unisphereCall).not.toHaveBeenCalled()
  })

  it('propagates UNISPHERE errors after a fallback', async () => {
    const unisphereErr = new Error('UNISPHERE 500 /cluster/firewall/rules: boom')

    await expect(
      orchestratorOrUnisphere('firewall/cluster', () => Promise.reject(unavailableError()), () => Promise.reject(unisphereErr)),
    ).rejects.toBe(unisphereErr)
  })
})
