import { beforeEach, describe, expect, it, vi } from "vitest"
import { sendEmail } from "@/features/email/actions"

const mock = vi.hoisted(() => ({ send: vi.fn(), store: vi.fn(), contact: { id: "c1", first_name: "Rachel", last_name: "Gibb", email: "delivered@resend.dev", phone: null, consent_status: "explicit", unsubscribe_token: "token" } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/get-user-context", () => ({ getUserContext: async () => {
  const query = { select: () => query, eq: () => query, single: async () => ({ data: mock.contact }) }
  return { orgId: "org", subAccountId: "Testing", userId: "owner", supabase: { from: () => query } }
} }))
vi.mock("@/lib/messaging/send", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/messaging/send")>(),
  getEmailSettings: async () => ({ fromName: "Testing", fromEmail: "info@example.com", signature: null, mailingAddress: "Testing address", copyTo: "copy@example.com" }),
  sendEmailToContact: mock.send,
}))
vi.mock("@/features/documents/store", () => ({ storeFiles: mock.store, MAX_UPLOAD_BYTES: 10485760 }))
beforeEach(() => { vi.clearAllMocks(); mock.contact.consent_status = "explicit"; mock.send.mockResolvedValue({ ok: true, activityId: null }) })
function draft(body = "Hi {{first_name}}") {
  const form = new FormData()
  form.set("contact_id", "c1")
  form.set("subject", "For {{ full_name }}")
  form.set("body", body)
  form.set("send_copy", "true")
  return form
}
describe("contact email action", () => {
  it("personalizes pasted fields and passes stored file bytes and metadata together", async () => {
    const form = draft()
    const file = new File(["PDF"], "report.pdf", { type: "application/pdf" })
    form.append("files", file)
    const buffer = Buffer.from("PDF")
    mock.store.mockResolvedValue({ documents: [{ id: "doc", name: "report.pdf", size: 3 }], buffers: [buffer] })
    expect(await sendEmail(form)).toMatchObject({ success: true })
    expect(mock.store).toHaveBeenCalledWith(expect.objectContaining({ files: [file], subAccountId: "Testing" }))
    expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "For Rachel Gibb", body: "Hi Rachel", marketing: true, attachments: [{ filename: "report.pdf", content: buffer }], bcc: ["copy@example.com"], activityMetadata: { attachments: [{ id: "doc", name: "report.pdf", size: 3 }] } }))
  })
  it("blocks unresolved fields before upload or send", async () => {
    expect(await sendEmail(draft("Hi {{company}}"))).toHaveProperty("error")
    expect(mock.store).not.toHaveBeenCalled()
    expect(mock.send).not.toHaveBeenCalled()
  })
  it("blocks withdrawn contacts for marketing but permits requested correspondence", async () => {
    mock.contact.consent_status = "withdrawn"
    const form = draft()
    expect(await sendEmail(form)).toHaveProperty("error")
    expect(mock.send).not.toHaveBeenCalled()
    form.set("marketing", "false")
    expect(await sendEmail(form)).toMatchObject({ success: true })
  })
})
