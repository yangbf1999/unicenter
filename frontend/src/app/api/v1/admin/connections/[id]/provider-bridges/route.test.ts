/**
 * GET /api/v1/admin/connections/[id]/provider-bridges - physical bridges
 * available for a VdC's shared/dedicated bridge pickers.
 *
 * Default mode (no scope) excludes both SDN zone uplinks and vnet names, and
 * must stay byte-identical to the pre-vlan-pool response (no `vlanAware`
 * field at all). `scope=vlan-pool` is a new mode for the VLAN-pool picker:
 * it excludes ONLY vnet names (zone uplinks are legitimate VLAN-pool
 * bridges) and adds a `vlanAware` flag derived from `bridge_vlan_aware`,
 * OR-ed across nodes when a bridge appears on more than one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { callRoute } from "@/__tests__/setup/route-test"

const { requireProviderTenantMock, checkPermissionMock, connFindUniqueMock, getConnectionByIdMock, unisphereFetchMock } =
  vi.hoisted(() => ({
    requireProviderTenantMock: vi.fn(),
    checkPermissionMock: vi.fn(),
    connFindUniqueMock: vi.fn(),
    getConnectionByIdMock: vi.fn(),
    unisphereFetchMock: vi.fn(),
  }))

vi.mock("@/lib/tenant", () => ({
  requireProviderTenant: (...a: unknown[]) => requireProviderTenantMock(...a),
}))

vi.mock("@/lib/rbac", () => ({
  checkPermission: (...a: unknown[]) => checkPermissionMock(...a),
  PERMISSIONS: { ADMIN_SETTINGS: "admin.settings" },
}))

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    connection: { findUnique: (...a: unknown[]) => connFindUniqueMock(...a) },
  },
}))

vi.mock("@/lib/connections/getConnection", () => ({
  getConnectionById: (...a: unknown[]) => getConnectionByIdMock(...a),
}))

vi.mock("@/lib/esage/client", () => ({
  unisphereFetch: (...a: unknown[]) => unisphereFetchMock(...a),
}))

import { GET } from "./route"

beforeEach(() => {
  vi.clearAllMocks()
  requireProviderTenantMock.mockResolvedValue(null)
  checkPermissionMock.mockResolvedValue(null)
  connFindUniqueMock.mockResolvedValue({ tenantId: "t1" })
  getConnectionByIdMock.mockResolvedValue({ id: "c1", baseUrl: "https://h", apiToken: "tok" })
})

/** Single node: vmbr0 is a zone uplink (vlan_aware), vmbr1 is a plain physical bridge, vfoo is a vnet. */
function mockSingleNode() {
  unisphereFetchMock.mockImplementation(async (_conn: unknown, path: string) => {
    if (path === "/cluster/sdn/zones") return [{ bridge: "vmbr0" }]
    if (path === "/cluster/sdn/vnets") return [{ vnet: "vfoo" }]
    if (path === "/nodes") return [{ node: "unisphere1" }]
    if (path === "/nodes/unisphere1/network") {
      return [
        { iface: "vmbr0", type: "bridge", active: 1, bridge_vlan_aware: 1 },
        { iface: "vmbr1", type: "bridge", active: 1 },
        { iface: "vfoo", type: "bridge", active: 1 },
      ]
    }
    throw new Error(`unexpected path ${path}`)
  })
}

describe("GET /api/v1/admin/connections/[id]/provider-bridges - default mode", () => {
  it("excludes zone uplinks and vnets, and never includes a vlanAware field", async () => {
    mockSingleNode()
    const res = await callRoute(GET, { params: { id: "c1" } })
    expect(res.status).toBe(200)

    const text = await res.text()
    expect(text).not.toContain("vlanAware")

    const body = JSON.parse(text)
    expect(body.data).toEqual([{ iface: "vmbr1", nodes: ["unisphere1"], type: "bridge", active: 1 }])
  })
})

describe("GET /api/v1/admin/connections/[id]/provider-bridges - scope=vlan-pool", () => {
  it("excludes only vnet names (zone uplinks stay), and flags vlanAware from bridge_vlan_aware", async () => {
    mockSingleNode()
    const res = await callRoute(GET, { params: { id: "c1" }, searchParams: { scope: "vlan-pool" } })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toEqual([
      { iface: "vmbr0", nodes: ["unisphere1"], type: "bridge", active: 1, vlanAware: true },
      { iface: "vmbr1", nodes: ["unisphere1"], type: "bridge", active: 1, vlanAware: false },
    ])
    expect(body.data.some((b: { iface: string }) => b.iface === "vfoo")).toBe(false)
  })

  it("ORs vlanAware across nodes when a bridge appears on more than one", async () => {
    unisphereFetchMock.mockImplementation(async (_conn: unknown, path: string) => {
      if (path === "/cluster/sdn/zones") return []
      if (path === "/cluster/sdn/vnets") return []
      if (path === "/nodes") return [{ node: "unisphere1" }, { node: "unisphere2" }]
      if (path === "/nodes/unisphere1/network") return [{ iface: "vmbr1", type: "bridge", active: 1 }]
      if (path === "/nodes/unisphere2/network") {
        return [{ iface: "vmbr1", type: "bridge", active: 1, bridge_vlan_aware: 1 }]
      }
      throw new Error(`unexpected path ${path}`)
    })

    const res = await callRoute(GET, { params: { id: "c1" }, searchParams: { scope: "vlan-pool" } })
    const body = await res.json()
    expect(body.data).toEqual([
      { iface: "vmbr1", nodes: ["unisphere1", "unisphere2"], type: "bridge", active: 1, vlanAware: true },
    ])
  })
})
