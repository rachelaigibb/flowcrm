import { describe, it, expect } from "vitest"
import { validateIntakePayload } from "@/features/intake/validate"

const good = {
  name: "  Jane Doe ",
  email: "Jane@Example.com",
  phone: "+1 604 555 1234",
  message: "Looking to sell in Surrey.",
  source: "rachelgibbrealtor.ca:contact-form",
  tags: ["contact-form", "web-lead"],
  meta: { page: "/contact" },
  consent: true,
  consent_text: "I consent to being contacted.",
}

describe("validateIntakePayload", () => {
  it("accepts a full payload and normalises it", () => {
    const r = validateIntakePayload(good)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.honeypot).toBe(false)
    expect(r.payload.name).toBe("Jane Doe")
    expect(r.payload.email).toBe("jane@example.com")
    expect(r.payload.tags).toEqual(["contact-form", "web-lead"])
    expect(r.payload.meta).toEqual({ page: "/contact" })
  })

  it("defaults source and tags when omitted", () => {
    const r = validateIntakePayload({ name: "Jo Bloggs", email: "jo@example.com", consent: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.source).toBe("website")
    expect(r.payload.tags).toEqual([])
    expect(r.payload.phone).toBeUndefined()
  })

  it("rejects missing consent", () => {
    const r = validateIntakePayload({ ...good, consent: false })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.join(" ")).toMatch(/consent/)
  })

  it("rejects a bad email and a short name", () => {
    const r = validateIntakePayload({ ...good, email: "nope", name: "J" })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues).toHaveLength(2)
  })

  it("rejects non-object bodies", () => {
    expect(validateIntakePayload(null).ok).toBe(false)
    expect(validateIntakePayload("x").ok).toBe(false)
    expect(validateIntakePayload([]).ok).toBe(false)
  })

  it("flags the honeypot without failing validation", () => {
    const r = validateIntakePayload({ ...good, website: "http://spam.example" })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.honeypot).toBe(true)
  })

  it("rejects tags with odd characters and oversized meta", () => {
    expect(validateIntakePayload({ ...good, tags: ["<script>"] }).ok).toBe(false)
    expect(validateIntakePayload({ ...good, meta: { k: "x".repeat(1001) } }).ok).toBe(false)
    expect(validateIntakePayload({ ...good, meta: ["a"] }).ok).toBe(false)
  })
})
