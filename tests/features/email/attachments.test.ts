import { describe, it, expect, vi } from "vitest"
import { loadEmailAttachments } from "@/features/email/attachments"
import type { SupabaseClient } from "@supabase/supabase-js"
const path = "workspace/email/contact/user/11111111-1111-1111-1111-111111111111/report.pdf"
function context(size = 3) {
  const info = vi.fn().mockResolvedValue({ data: { size, metadata: {} } })
  const download = vi.fn().mockResolvedValue({ data: { size: 3, type: "application/pdf", arrayBuffer: async () => new Uint8Array([80,68,70]).buffer } })
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null }), insert: vi.fn(() => query), single: async () => ({ data: { id: "doc", name: "report.pdf", path, size: 3 } }) }
  return { supabase: { storage: { from: () => ({ info, download }) }, from: () => query } as unknown as SupabaseClient, orgId: "org", subAccountId: "workspace", userId: "user", info, download, query }
}
describe("uploaded attachment validation", () => {
  it("rejects a different workspace, contact or user before accessing storage", async () => {
    for (const forbidden of [path.replace("workspace", "other"), path.replace("contact", "other"), path.replace("user", "other"), path.replace("report.pdf", "../report.pdf")]) {
      const ctx = context()
      expect(await loadEmailAttachments(ctx, "contact", [{ path: forbidden, name: "report.pdf" }])).toHaveProperty("error")
      expect(ctx.info).not.toHaveBeenCalled()
    }
  })
  it("rejects actual oversized objects before downloading", async () => {
    const ctx = context(11 * 1024 * 1024)
    expect(await loadEmailAttachments(ctx, "contact", [{ path, name: "report.pdf" }])).toHaveProperty("error")
    expect(ctx.download).not.toHaveBeenCalled()
  })
  it("downloads exact private object bytes and records the document for the current contact", async () => {
    const ctx = context()
    const result = await loadEmailAttachments(ctx, "contact", [{ path, name: "report.pdf" }])
    expect(result).toMatchObject({ documents: [{ id: "doc" }], buffers: [Buffer.from("PDF")] })
    expect(ctx.query.insert).toHaveBeenCalledWith(expect.objectContaining({ sub_account_id: "workspace", contact_id: "contact", created_by: "user", size: 3 }))
  })
})
