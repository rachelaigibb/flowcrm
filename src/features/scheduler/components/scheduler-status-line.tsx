import { Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SchedulerStatus } from "@/features/scheduler/status"

// One line under a page title: when the 5-minute scheduler last ran. More than
// 15 minutes, or an error on the last tick, means scheduled sends and wait
// steps are not going out.
export function SchedulerStatusLine({ status }: { status: SchedulerStatus }) {
  const stale = status.minutesAgo === null || status.minutesAgo > 15
  const bad = stale || Boolean(status.error)
  const label =
    status.minutesAgo === null
      ? "Scheduler has not run yet"
      : status.minutesAgo === 0
        ? "Scheduler ran just now"
        : `Scheduler ran ${status.minutesAgo} min ago`

  return (
    <p className={cn("mt-1 flex items-center gap-1.5 text-xs", bad ? "text-amber-500" : "text-muted-foreground")}>
      {bad ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}
      {label}
      {status.error ? ` · last error: ${status.error}` : stale ? " · scheduled sends are waiting" : ""}
    </p>
  )
}
