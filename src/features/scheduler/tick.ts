import type { SupabaseClient } from "@supabase/supabase-js"
import { deliverBroadcast } from "@/features/broadcasts/deliver"
import { executeAutomationRun } from "@/features/automations/engine"

// One scheduler pass across every workspace, called by /api/cron/tick every
// 5 minutes with the service-role client (no user session exists). Each piece
// of work is claimed atomically by the code that runs it, so overlapping ticks
// or a user clicking Send at the same moment cannot send twice.

export const SCHEDULER_JOB = "scheduler_tick"

// Stop picking up new work well inside the route's 300 s limit.
const TIME_BUDGET_MS = 240_000
const BROADCASTS_PER_TICK = 5
const RUNS_PER_TICK = 50

export interface TickSummary {
  broadcastsSent: number
  broadcastsFailed: number
  runsResumed: number
  error: string | null
}

export async function runSchedulerTick(supabase: SupabaseClient): Promise<TickSummary> {
  const startedAt = new Date().toISOString()
  const deadline = Date.now() + TIME_BUDGET_MS
  const summary: TickSummary = { broadcastsSent: 0, broadcastsFailed: 0, runsResumed: 0, error: null }

  await supabase.from("system_jobs").upsert({ name: SCHEDULER_JOB, last_started_at: startedAt })

  // Activities and tasks are attributed to the org owner, as if they had
  // clicked Send; cached per org for the tick.
  const owners = new Map<string, string | null>()
  async function actingUser(orgId: string): Promise<string | null> {
    if (!owners.has(orgId)) {
      const { data } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .order("created_at")
        .limit(1)
        .maybeSingle()
      owners.set(orgId, data?.user_id ?? null)
    }
    return owners.get(orgId) ?? null
  }

  try {
    const now = new Date().toISOString()

    // 1. Scheduled broadcasts that are due
    const { data: dueBroadcasts, error: broadcastError } = await supabase
      .from("broadcasts")
      .select("id, org_id, sub_account_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .order("scheduled_at")
      .limit(BROADCASTS_PER_TICK)
    if (broadcastError) throw new Error(`broadcasts: ${broadcastError.message}`)

    for (const b of dueBroadcasts ?? []) {
      if (Date.now() > deadline) break
      const ctx = { orgId: b.org_id, subAccountId: b.sub_account_id, userId: await actingUser(b.org_id) }
      const result = await deliverBroadcast(supabase, ctx, b.id)
      if (result.ok) {
        summary.broadcastsSent++
        continue
      }
      // Not sent and still scheduled (content, sender or recipients problem):
      // mark failed with the reason so it is not retried every 5 minutes.
      summary.broadcastsFailed++
      await supabase
        .from("broadcasts")
        .update({
          status: "failed",
          stats: { total: 0, sent: 0, failed: 0, opened: 0, error: result.error },
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id)
        .eq("status", "scheduled")
    }

    // 2. Automation runs whose wait step has elapsed
    const { data: dueRuns, error: runError } = await supabase
      .from("automation_runs")
      .select("id, org_id, sub_account_id")
      .eq("status", "paused")
      .lte("resume_at", now)
      .order("resume_at")
      .limit(RUNS_PER_TICK)
    if (runError) throw new Error(`automation runs: ${runError.message}`)

    for (const r of dueRuns ?? []) {
      if (Date.now() > deadline) break
      if (!r.sub_account_id) continue
      const ctx = { orgId: r.org_id, subAccountId: r.sub_account_id, userId: await actingUser(r.org_id) }
      await executeAutomationRun(supabase, ctx, r.id)
      summary.runsResumed++
    }
  } catch (err) {
    summary.error = err instanceof Error ? err.message : "Unknown scheduler error"
    console.error("[Scheduler] tick failed:", err)
  }

  const finishedAt = new Date().toISOString()
  await supabase.from("system_jobs").upsert({
    name: SCHEDULER_JOB,
    last_started_at: startedAt,
    last_finished_at: finishedAt,
    ...(summary.error ? { last_error: summary.error } : { last_ok_at: finishedAt, last_error: null }),
  })

  return summary
}
