import { describe, expect, it } from "vitest"
import { safeRedirect, authSiteUrl } from "@/lib/auth/redirect"

describe("invitation auth redirects", () => {
  it("preserves a same-site invitation path", () => {
    expect(safeRedirect("/invite/abc123")).toBe("/invite/abc123")
  })
  it("rejects external and protocol-relative destinations", () => {
    expect(safeRedirect("https://example.com")).toBe("/")
    expect(safeRedirect("//example.com")).toBe("/")
    expect(safeRedirect("/\\example.com")).toBe("/")
  })
  it("uses the canonical application origin", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = "https://crm.getflowplan.app/"
    expect(authSiteUrl()).toBe("https://crm.getflowplan.app")
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  })
})
