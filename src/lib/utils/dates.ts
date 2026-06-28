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
