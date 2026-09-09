// Payload validation for POST /api/intake. Plain functions, no schema library:
// the shape is small and fixed, and this file is unit-tested.

export interface IntakePayload {
  name: string
  email: string
  phone?: string
  message?: string
  source: string
  tags: string[]
  meta: Record<string, string>
  consent: boolean
  consent_text?: string
}

export type IntakeValidation =
  | { ok: true; payload: IntakePayload; honeypot: boolean }
  | { ok: false; error: string; issues: string[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TAG_RE = /^[a-z0-9][a-z0-9 _-]{0,39}$/i

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined
}

export function validateIntakePayload(body: unknown): IntakeValidation {
  const issues: string[] = []
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid input.", issues: ["body must be a JSON object"] }
  }
  const b = body as Record<string, unknown>

  const honeypot = typeof b.website === "string" && b.website.length > 0

  const name = str(b.name) ?? ""
  if (name.length < 2 || name.length > 100) issues.push("name: 2–100 characters")

  const email = (str(b.email) ?? "").toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) issues.push("email: must be a valid address")

  const phone = str(b.phone)
  if (phone !== undefined && phone.length > 30) issues.push("phone: max 30 characters")

  const message = str(b.message)
  if (message !== undefined && message.length > 5000) issues.push("message: max 5000 characters")

  const source = str(b.source) ?? "website"
  if (source.length < 1 || source.length > 80) issues.push("source: 1–80 characters")

  let tags: string[] = []
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || b.tags.length > 20) {
      issues.push("tags: array of up to 20 strings")
    } else {
      tags = b.tags.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      if (tags.some((t) => !TAG_RE.test(t))) issues.push("tags: letters, numbers, spaces, - and _ only (max 40)")
    }
  }

  const meta: Record<string, string> = {}
  if (b.meta !== undefined) {
    if (!b.meta || typeof b.meta !== "object" || Array.isArray(b.meta)) {
      issues.push("meta: must be an object of strings")
    } else {
      const entries = Object.entries(b.meta as Record<string, unknown>)
      if (entries.length > 20) issues.push("meta: max 20 keys")
      for (const [k, v] of entries) {
        if (k.length > 60 || typeof v !== "string" || v.length > 1000) {
          issues.push(`meta.${k}: string values up to 1000 characters`)
          break
        }
        meta[k] = v
      }
    }
  }

  if (b.consent !== true) issues.push("consent: must be true (the visitor ticked the consent box)")

  const consentText = str(b.consent_text)
  if (consentText !== undefined && consentText.length > 1000) issues.push("consent_text: max 1000 characters")

  if (issues.length) return { ok: false, error: "Invalid input.", issues }

  return {
    ok: true,
    honeypot,
    payload: {
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(message ? { message } : {}),
      source,
      tags,
      meta,
      consent: true,
      ...(consentText ? { consent_text: consentText } : {}),
    },
  }
}
