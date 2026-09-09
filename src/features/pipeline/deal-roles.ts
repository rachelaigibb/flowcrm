// Roles a person can have on a deal (deal_contacts.role). Per-workspace list stored in
// sub_accounts.settings.deal_roles; real-estate default below. Generic businesses can
// set e.g. "client, spouse, decision-maker, referrer".
export const DEFAULT_DEAL_ROLES = ["inquiry", "buyer", "co-buyer", "seller", "co-seller", "co-op agent", "lawyer", "lender", "referrer"]
export const INQUIRY_ROLE = "inquiry"

export function getDealRoles(settings: Record<string, unknown> | null | undefined): string[] {
  const raw = settings?.deal_roles
  if (Array.isArray(raw)) {
    const list = raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
    if (list.length > 0) return Array.from(new Set(list))
  }
  return DEFAULT_DEAL_ROLES
}

export function dealRoleLabel(value: string | null | undefined): string {
  if (!value) return ""
  return value.charAt(0).toUpperCase() + value.slice(1)
}
