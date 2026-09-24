import type { SupabaseClient } from "@supabase/supabase-js"
import { SCHEDULER_JOB } from "./tick"

export interface SchedulerStatus {
  // Minutes since the last successful tick; null if it has never run
  minutesAgo: number | null
  error: string | null
}

// Read on the server (the page's cookie client; system_jobs is readable by
// any signed-in user) and passed to SchedulerStatusLine as plain values.
export async function getSchedulerStatus(supabase: SupabaseClient): Promise<SchedulerStatus> {
  const { data } = await supabase
    .from("system_jobs")
    .select("last_ok_at, last_error")
    .eq("name", SCHEDULER_JOB)
    .maybeSingle()
  const lastOk = data?.last_ok_at ? new Date(data.last_ok_at).getTime() : null
  return {
    minutesAgo: lastOk === null ? null : Math.max(0, Math.round((Date.now() - lastOk) / 60_000)),
    error: data?.last_error ?? null,
  }
}
