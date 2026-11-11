import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/rbac", () => ({
  checkPermission: vi.fn(async () => null),
  PERMISSIONS: { NODE_VIEW: "node.view" },
}))
vi.mock("@/lib/connections/getConnection", () => ({
  getConnectionById: vi.fn(async () => ({ id: "c1", baseUrl: "https://h", apiToken: "t" })),
}))
vi.mock("@/lib/demo/demo-api", () => ({
  demoResponse: vi.fn(() => null),
}))
const unisphereFetch = vi.fn()
vi.mock("@/lib/esage/client", () => ({
  unisphereFetch: (...args: unknown[]) => unisphereFetch(...args),
}))

import { POST } from "./route"
import { checkPermission } from "@/lib/rbac"
import { callRoute, readJson, deniedPermissionResponse } from "@/__tests__/setup/route-test"

beforeEach(() => vi.clearAllMocks())

type Point = { ts: number; cpu: number; ram: number; arc: number | null; arcPct: number | null }

const GIB = 1024 * 1024 * 1024

async function trendsFor(rrd: Record<string, number>[]) {
  unisphereFetch.mockResolvedValue(rrd)

  const res = await callRoute(POST, {
    params: { id: "c1" },
    body: { items: [{ node: "unisphere1" }], timeframe: "hour" },
  })

  expect(res.status).toBe(200)
  const json = await readJson<{ data: Record<string, Point[]> }>(res)

  return json?.data["node:unisphere1"] ?? []
}

describe("POST /api/v1/connections/[id]/nodes/trends — ZFS ARC (#617)", () => {
  it("exposes arcsize in bytes and as a share of the node memory", async () => {
    const points = await trendsFor([
      { time: 1_700_000_000, cpu: 0.1, mem: 4 * GIB, maxmem: 32 * GIB, arcsize: 8 * GIB },
    ])

    expect(points[0].arc).toBe(8 * GIB)
    expect(points[0].arcPct).toBe(25)
  })

  it("reports null on a UNISPHERE 8 node, whose RRD has no arcsize column at all", async () => {
    const points = await trendsFor([
      { time: 1_700_000_000, cpu: 0.1, mem: 4 * GIB, maxmem: 32 * GIB },
    ])

    expect(points[0].arc).toBeNull()
    expect(points[0].arcPct).toBeNull()

    // The pre-existing metrics must keep their exact shape.
    expect(points[0].cpu).toBe(10)
    expect(points[0].ram).toBe(13)
  })

  it("reports null rather than zero on a node without ZFS", async () => {
    const points = await trendsFor([
      { time: 1_700_000_000, cpu: 0.1, mem: 4 * GIB, maxmem: 32 * GIB, arcsize: 0 },
    ])

    expect(points[0].arc).toBeNull()
    expect(points[0].arcPct).toBeNull()
  })

  it("leaves arcPct null when the node reports no total memory", async () => {
    const points = await trendsFor([
      { time: 1_700_000_000, cpu: 0.1, mem: 0, maxmem: 0, arcsize: 2 * GIB },
    ])

    expect(points[0].arc).toBe(2 * GIB)
    expect(points[0].arcPct).toBeNull()
  })
})

describe("POST /api/v1/connections/[id]/nodes/trends — shape and guards", () => {
  it("keeps the CPU ratio inside 0 to 100 whatever the RRD reports", async () => {
    const points = await trendsFor([
      { time: 1_700_000_000, cpu: 1.4, mem: GIB, maxmem: 4 * GIB },
    ])

    expect(points[0].cpu).toBe(100)
  })

  it("labels a week point with its date, an hour point with its time only", async () => {
    unisphereFetch.mockResolvedValue([{ time: 1_700_000_000, cpu: 0.5, mem: GIB, maxmem: 4 * GIB }])

    const res = await callRoute(POST, {
      params: { id: "c1" },
      body: { items: [{ node: "unisphere1" }], timeframe: "week" },
    })

    const json = await readJson<{ data: Record<string, { t: string }[]> }>(res)

    expect(json?.data["node:unisphere1"][0].t).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it("downsamples an hour series to the point budget of the chart", async () => {
    const rrd = Array.from({ length: 400 }, (_, i) => ({
      time: 1_700_000_000 + i * 60, cpu: 0.1, mem: GIB, maxmem: 4 * GIB,
    }))

    unisphereFetch.mockResolvedValue(rrd)

    const res = await callRoute(POST, {
      params: { id: "c1" },
      body: { items: [{ node: "unisphere1" }], timeframe: "hour" },
    })

    const json = await readJson<{ data: Record<string, unknown[]> }>(res)

    expect(json?.data["node:unisphere1"]).toHaveLength(70)
  })

  it("answers with an empty map when no node is asked for", async () => {
    const res = await callRoute(POST, { params: { id: "c1" }, body: { items: [] } })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ data: {} })
    expect(unisphereFetch).not.toHaveBeenCalled()
  })

  it("answers with an empty map when the body is not JSON", async () => {
    const res = await callRoute(POST, { params: { id: "c1" }, body: "not json" })

    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ data: {} })
  })

  it("rejects a call without a connection id", async () => {
    const res = await callRoute(POST, { params: {}, body: { items: [{ node: "unisphere1" }] } })

    expect(res.status).toBe(400)
  })

  it("passes the permission refusal straight through", async () => {
    vi.mocked(checkPermission).mockResolvedValueOnce(deniedPermissionResponse() as never)

    const res = await callRoute(POST, {
      params: { id: "c1" },
      body: { items: [{ node: "unisphere1" }] },
    })

    expect(res.status).toBe(403)
    expect(unisphereFetch).not.toHaveBeenCalled()
  })

  it("keeps the other nodes when one of them fails to answer", async () => {
    unisphereFetch.mockImplementation(async (_conn: unknown, path: string) => {
      if (path.includes("unisphere1")) throw new Error("unreachable")

      return [{ time: 1_700_000_000, cpu: 0.2, mem: GIB, maxmem: 4 * GIB }]
    })

    const res = await callRoute(POST, {
      params: { id: "c1" },
      body: { items: [{ node: "unisphere1" }, { node: "unisphere2" }] },
    })

    const json = await readJson<{ data: Record<string, unknown[]> }>(res)

    expect(json?.data["node:unisphere1"]).toEqual([])
    expect(json?.data["node:unisphere2"]).toHaveLength(1)
  })

  it("tolerates an RRD payload that is not a series", async () => {
    unisphereFetch.mockResolvedValue({ unexpected: true } as never)

    const res = await callRoute(POST, {
      params: { id: "c1" },
      body: { items: [{ node: "unisphere1" }] },
    })

    expect(await readJson(res)).toEqual({ data: { "node:unisphere1": [] } })
  })
})
