import { startOfMonth, startOfQuarter, startOfWeek, startOfYear } from "date-fns"

// Shared "period" picker used by the dashboard, pipeline and reports.
export type DateRange = "week" | "month" | "quarter" | "year" | "all" | `y:${number}`

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
]

export function labelFor(range: DateRange): string {
  if (range.startsWith("y:")) return range.slice(2)
  return DATE_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "All Time"
}

export function parseDateRange(value: string | null | undefined, fallback: DateRange = "all"): DateRange {
  if (!value) return fallback
  if (DATE_RANGE_OPTIONS.some((o) => o.value === value)) return value as DateRange
  if (/^y:\d{4}$/.test(value)) return value as DateRange
  return fallback
}

export interface Period {
  start: Date | null
  end: Date
}

export function getPeriod(range: DateRange, now: Date = new Date()): Period {
  if (range.startsWith("y:")) {
    const y = Number(range.slice(2))
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) }
  }
  switch (range) {
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now }
    case "month":
      return { start: startOfMonth(now), end: now }
    case "quarter":
      return { start: startOfQuarter(now), end: now }
    case "year":
      return { start: startOfYear(now), end: now }
    default:
      return { start: null, end: now }
  }
}

export function inPeriod(date: string | Date | null | undefined, period: Period): boolean {
  if (!date) return false
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return false
  if (period.start && d < period.start) return false
  return d <= period.end
}

/** Every calendar year from `earliest` to now, newest first — years with no data included. */
export function yearsFrom(earliest: Date | string | null | undefined, now: Date = new Date()): number[] {
  const first = earliest ? new Date(earliest).getFullYear() : now.getFullYear()
  const last = now.getFullYear()
  return Array.from({ length: Math.max(last - first + 1, 1) }, (_, i) => last - i)
}
