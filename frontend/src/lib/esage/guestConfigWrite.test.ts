import { describe, it, expect, vi, beforeEach } from "vitest"

const unisphereFetchMock = vi.fn<(...args: any[]) => Promise<any>>()

// Real module minus unisphereFetch: UNISPHERE_DEFAULT_TIMEOUT_MS has to keep reading the
// environment, and a factory listing only unisphereFetch would break the day this
// module imports anything else from the client.
vi.mock("./client", async io => {
  const actual = await io<typeof import("./client")>()

  return { ...actual, unisphereFetch: unisphereFetchMock }
})

const { writeGuestConfig, parseUpid, backgroundDelaySeconds, CONFIG_TASK_WAIT_MS } = await import("./guestConfigWrite")

const conn = { baseUrl: "https://unisphere1:8006", apiToken: "root@pam!t=s", id: "conn-1" } as any
const UPID = "UPID:unisphere3:0000ABCD:00112233:66C0FFEE:qmconfig:100:root@pam:"

/** The config write is always the first call; the rest are task polls. */
function writeCall() {
  return unisphereFetchMock.mock.calls[0]
}

beforeEach(() => {
  unisphereFetchMock.mockReset()
})

describe("parseUpid", () => {
  it("pulls the node out of a UPID", () => {
    expect(parseUpid(UPID)).toEqual({ upid: UPID, node: "unisphere3" })
  })

  it("rejects anything that is not a task id", () => {
    // The synchronous LXC handler answers null, and a qemu write with nothing
    // to apply answers an empty body.
    expect(parseUpid(null)).toBeNull()
    expect(parseUpid(undefined)).toBeNull()
    expect(parseUpid("")).toBeNull()
    expect(parseUpid(42)).toBeNull()
    expect(parseUpid({ upid: UPID })).toBeNull()
    expect(parseUpid("not-a-upid")).toBeNull()
  })
})

describe("writeGuestConfig", () => {
  it("uses UNISPHERE's asynchronous handler for a qemu guest (#743)", async () => {
    // POST is update_vm_async, which forks a qmconfig worker instead of
    // holding the request open for the whole hotplug. UNISPHERE's own PUT
    // description tells API clients to prefer it for hotplug.
    unisphereFetchMock.mockResolvedValueOnce(null)

    await writeGuestConfig({ conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096" })

    expect(writeCall()[1]).toBe("/nodes/unisphere3/qemu/100/config")
    expect(writeCall()[2]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    // UNISPHERE waits for its own worker for that long and answers null when it
    // finished, so a fast write costs one round trip and no polling at all.
    expect(writeCall()[2].body).toBe("memory=4096&background_delay=3")
  })

  it("keeps the synchronous call for an LXC guest, which has no async handler", async () => {
    // UNISPHERE::API2::LXC::Config registers PUT only, and an LXC memory change is
    // a cgroup write, so there is nothing slow to move off the request.
    unisphereFetchMock.mockResolvedValueOnce(null)

    await writeGuestConfig({ conn, type: "lxc", node: "unisphere3", vmid: "200", body: "memory=2048" })

    expect(writeCall()[1]).toBe("/nodes/unisphere3/lxc/200/config")
    expect(writeCall()[2]).toMatchObject({ method: "PUT" })

    // The synchronous schema refuses anything it does not declare, and
    // background_delay is declared on the asynchronous one only.
    expect(writeCall()[2].body).toBe("memory=2048")
  })

  it("reports done without polling when UNISPHERE returned no task", async () => {
    unisphereFetchMock.mockResolvedValueOnce(null)

    const result = await writeGuestConfig({ conn, type: "lxc", node: "unisphere3", vmid: "200", body: "memory=2048" })

    expect(result).toEqual({ state: "done", upid: null })
    expect(unisphereFetchMock).toHaveBeenCalledTimes(1)
  })

  it("waits for the task and reports done when it ends on OK", async () => {
    unisphereFetchMock
      .mockResolvedValueOnce(UPID)
      .mockResolvedValueOnce({ status: "stopped", exitstatus: "OK" })

    const result = await writeGuestConfig({
      conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096", waitMs: 5_000,
    })

    expect(result).toEqual({ state: "done", upid: UPID })
    expect(unisphereFetchMock.mock.calls[1][1]).toBe(`/nodes/unisphere3/tasks/${encodeURIComponent(UPID)}/status`)
  })

  it("polls the node named by the UPID, not the one we wrote to", async () => {
    // UNISPHERE proxies the write, so the worker can run somewhere else entirely.
    const remoteUpid = "UPID:unisphere2:0000ABCD:00112233:66C0FFEE:qmconfig:100:root@pam:"

    unisphereFetchMock
      .mockResolvedValueOnce(remoteUpid)
      .mockResolvedValueOnce({ status: "stopped", exitstatus: "OK" })

    await writeGuestConfig({
      conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096", waitMs: 5_000,
    })

    expect(unisphereFetchMock.mock.calls[1][1]).toContain("/nodes/unisphere2/tasks/")
  })

  it("throws UNISPHERE's own exitstatus when the task fails", async () => {
    // A memory unplug that never releases its DIMM ends here, and the caller
    // needs it to undo its own side effects.
    unisphereFetchMock
      .mockResolvedValueOnce(UPID)
      .mockResolvedValueOnce({ status: "stopped", exitstatus: "error unplug memory module" })

    await expect(
      writeGuestConfig({ conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096", waitMs: 5_000 }),
    ).rejects.toThrow("error unplug memory module")
  })

  it("reports the task as running once the budget is spent, without failing the write", async () => {
    // The change IS being applied. Answering an error here is exactly the bug
    // of issue #743, so the caller gets the UPID to keep following instead.
    unisphereFetchMock
      .mockResolvedValueOnce(UPID)
      .mockResolvedValueOnce({ status: "running" })

    const result = await writeGuestConfig({
      conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096", waitMs: 0,
    })

    expect(result).toEqual({ state: "running", upid: UPID, node: "unisphere3" })
    expect(unisphereFetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries a status poll that blew up instead of reporting a failed save", async () => {
    // A blip on the task endpoint says nothing about the write, which UNISPHERE has
    // already accepted.
    unisphereFetchMock
      .mockResolvedValueOnce(UPID)
      .mockRejectedValueOnce(new Error("UNISPHERE 596 tasks: connection error"))
      .mockResolvedValueOnce({ status: "stopped", exitstatus: "OK" })

    const result = await writeGuestConfig({
      conn, type: "qemu", node: "unisphere3", vmid: "100", body: "memory=4096", waitMs: 5_000,
    })

    expect(result).toEqual({ state: "done", upid: UPID })
    expect(unisphereFetchMock).toHaveBeenCalledTimes(3)
  })

  it("stays under the reverse proxy's 60s read timeout by default", () => {
    // nginx/unicenter-locations.conf cuts a silent upstream at 60s, and a
    // 504 there would hide our JSON from the browser.
    expect(CONFIG_TASK_WAIT_MS).toBeLessThan(60_000)
  })
})

describe("backgroundDelaySeconds", () => {
  /**
   * UNISPHERE holds the HTTP answer for the whole background_delay, so it must stay
   * inside the budget unisphereFetch gives the request. A deployment running with
   * UNISPHERE_TIMEOUT_MS=1000 would otherwise time out on every config write, which
   * is the very bug this module exists to remove.
   */
  it("asks for the full delay on the default budget", () => {
    expect(backgroundDelaySeconds(8_000)).toBe(3)
  })

  it("shortens the delay to stay inside a tight budget", () => {
    expect(backgroundDelaySeconds(2_500)).toBe(1)
  })

  it.each([1_000, 500, 0])("drops the delay entirely on a %sms budget", budgetMs => {
    // UNISPHERE's schema has a minimum of 1, and it hands the UPID back right away
    // when we do not ask, which we then follow.
    expect(backgroundDelaySeconds(budgetMs)).toBe(0)
  })

  it("never asks for more than UNISPHERE's own 30s maximum", () => {
    expect(backgroundDelaySeconds(600_000)).toBeLessThanOrEqual(30)
  })
})
