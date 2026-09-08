// Deal type ("side" column) is a per-workspace pick-list stored in sub_accounts.settings.deal_types.
// Real-estate workspaces get the default below; any other business can define its own list in Settings.
export const DEFAULT_DEAL_TYPES = ["buyer", "seller", "both", "tenant", "landlord", "referral"]

export function getDealTypes(settings: Record<string, unknown> | null | undefined): string[] {
  const raw = settings?.deal_types
  if (Array.isArray(raw)) {
    const list = raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
    if (list.length > 0) return Array.from(new Set(list))
  }
  return DEFAULT_DEAL_TYPES
}

export function dealTypeLabel(value: string | null | undefined): string {
  if (!value) return ""
  return value.charAt(0).toUpperCase() + value.slice(1)
}
