import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatSmartDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`
  return format(d, "MMM d, yyyy")
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return format(d, "MMM d, yyyy 'at' h:mm a")
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return format(d, "MMM d, yyyy")
}

/**
 * Convert any date string (ISO timestamp or date-only) to YYYY-MM-DD for <input type="date">.
 * Returns empty string if null/undefined.
 */
export function toDateInputValue(date: string | null | undefined): string {
  if (!date) return ""
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  // Parse and format
  try {
    return format(new Date(date), "yyyy-MM-dd")
  } catch {
    return ""
  }
}
