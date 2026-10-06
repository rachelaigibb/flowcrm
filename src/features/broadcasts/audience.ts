import type { BroadcastRecipientFilter } from '@/types/database'

// Unknown or malformed saved/client JSON must never broaden an audience.
export function normalizeAudience(value: unknown): BroadcastRecipientFilter | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (input.all !== undefined && typeof input.all !== 'boolean') return null
  for (const key of ['contact_ids', 'tags', 'sources']) {
    if (input[key] !== undefined && (!Array.isArray(input[key]) || !(input[key] as unknown[]).every(v => typeof v === 'string' && v.trim().length > 0))) return null
  }
  // Explicit IDs always take precedence, including an intentionally empty list.
  if (input.contact_ids !== undefined) return { contact_ids: [...new Set(input.contact_ids as string[])] }
  if (input.all === true) return { all: true }
  const result: BroadcastRecipientFilter = {}
  if ((input.tags as string[] | undefined)?.length) result.tags = [...new Set(input.tags as string[])]
  if ((input.sources as string[] | undefined)?.length) result.sources = [...new Set(input.sources as string[])]
  return result
}

export function hasAudience(value: unknown): boolean {
  const filter = normalizeAudience(value)
  if (!filter) return false
  if (filter.contact_ids) return filter.contact_ids.length > 0
  return filter.all === true || !!filter.tags?.length || !!filter.sources?.length
}
