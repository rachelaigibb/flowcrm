// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

const runSchedulerTick = vi.fn()
vi.mock("@/features/scheduler/tick", () => ({ runSchedulerTick }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }))

const { GET } = await import("@/app/api/cron/tick/route")

function call(auth?: string) {
  return GET(new Request("https://crm.example/api/cron/tick", auth ? { headers: { authorization: auth } } : undefined))
}

describe("cron tick route", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    runSchedulerTick.mockReset()
  })

  it("rejects every call when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await call("Bearer ")
    expect(res.status).toBe(401)
    expect(runSchedulerTick).not.toHaveBeenCalled()
  })

  it("rejects a missing or wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    expect((await call()).status).toBe(401)
    expect((await call("Bearer nope")).status).toBe(401)
    expect(runSchedulerTick).not.toHaveBeenCalled()
  })

  it("runs the tick with the right token and reports the summary", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    runSchedulerTick.mockResolvedValue({ broadcastsSent: 1, broadcastsFailed: 0, runsResumed: 2, error: null })
    const res = await call("Bearer s3cret")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, broadcastsSent: 1, runsResumed: 2 })
  })

  it("returns 500 when the tick reports an error", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    runSchedulerTick.mockResolvedValue({ broadcastsSent: 0, broadcastsFailed: 0, runsResumed: 0, error: "db down" })
    const res = await call("Bearer s3cret")
    expect(res.status).toBe(500)
  })
})
