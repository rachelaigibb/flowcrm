// ============================================================================
// FlowCRM Design System — Single source of truth for status/priority colors
// Import these everywhere. Never hardcode status/priority colors in components.
// ============================================================================

export const PRIORITY_COLORS = {
  high: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
    text: "text-red-400",
    label: "High",
  },
  medium: {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    dot: "bg-yellow-400",
    text: "text-yellow-400",
    label: "Medium",
  },
  low: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
    text: "text-green-400",
    label: "Low",
  },
} as const

export const STATUS_COLORS = {
  // Deal statuses
  open: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
    text: "text-blue-400",
    label: "Open",
  },
  won: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
    text: "text-green-400",
    label: "Won",
  },
  lost: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
    text: "text-red-400",
    label: "Lost",
  },
  // Task statuses
  pending: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
    text: "text-blue-400",
    label: "Pending",
  },
  completed: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    dot: "bg-green-400",
    text: "text-green-400",
    label: "Completed",
  },
  cancelled: {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    label: "Cancelled",
  },
  // Special
  overdue: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dot: "bg-orange-400",
    text: "text-orange-400",
    label: "Overdue",
  },
} as const

export const ACTIVITY_TYPE_COLORS = {
  note: "bg-primary/10 text-primary border-primary/20",
  email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  sms: "bg-green-500/10 text-green-400 border-green-500/20",
  call: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  meeting: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  status_change: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-muted text-muted-foreground border-border",
} as const

// Tag color options for tag management
export const TAG_COLORS = [
  { name: "Gray", value: "#64748b" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
] as const

// Sub-account accent colors
export const ACCENT_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#64748b",
] as const

// Shared timezone list
export const TIMEZONES = [
  "America/Vancouver",
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const

// Contact source color badges
export const SOURCE_COLORS: Record<string, { badge: string; label: string }> = {
  website: { badge: "bg-green-500/10 text-green-400 border-green-500/20", label: "Website" },
  referral: { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Referral" },
  linkedin: { badge: "bg-sky-500/10 text-sky-400 border-sky-500/20", label: "LinkedIn" },
  facebook: { badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", label: "Facebook" },
  instagram: { badge: "bg-pink-500/10 text-pink-400 border-pink-500/20", label: "Instagram" },
  twitter: { badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", label: "Twitter" },
  google: { badge: "bg-red-500/10 text-red-400 border-red-500/20", label: "Google" },
  email: { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Email" },
  phone: { badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Phone" },
  csv_import: { badge: "bg-purple-500/10 text-purple-400 border-purple-500/20", label: "CSV Import" },
  manual: { badge: "bg-muted text-muted-foreground border-border", label: "Manual" },
  other: { badge: "bg-muted text-muted-foreground border-border", label: "Other" },
}

export type PriorityKey = keyof typeof PRIORITY_COLORS
export type StatusKey = keyof typeof STATUS_COLORS
