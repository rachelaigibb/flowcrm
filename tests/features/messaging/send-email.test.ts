import { beforeEach, describe, expect, it, vi } from "vitest"
import { sendEmailToContact, type EmailSettings } from "@/lib/messaging/send"
import type { SupabaseClient } from "@supabase/supabase-js"

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/resend/client", () => ({ getResendClient: () => ({ emails: { send: mocks.send } }) }))
const settings: EmailSettings = { fromName: "Rachel Gibb", fromEmail: "info@example.com", replyTo: "info@example.com", signature: "Rachel", mailingAddress: "eXp Realty, Vancouver", copyTo: "copy@example.com" }
const params = { supabase: {} as SupabaseClient, orgId: "org", subAccountId: "Testing", userId: null, contact: { id: "test", first_name: "Test", last_name: null, email: "delivered@resend.dev", phone: null, unsubscribe_token: "test-token" }, settings, subject: "Report", body: "Hello Test", marketing: true, skipActivity: true }
beforeEach(() => { mocks.send.mockReset(); mocks.send.mockResolvedValue({ data: { id: "provider-id" }, error: null }) })
describe("email delivery payload", () => {
  it("passes exact attachment bytes, BCC, address and unsubscribe headers to Resend", async () => {
    const content = Buffer.from("PDF bytes")
    expect(await sendEmailToContact({ ...params, attachments: [{ filename: "report.pdf", content }], bcc: [settings.copyTo] })).toMatchObject({ ok: true })
    const payload = mocks.send.mock.calls[0][0]
    expect(payload.attachments).toEqual([{ filename: "report.pdf", content }])
    expect(payload.bcc).toEqual(["copy@example.com"])
    expect(payload.html).toContain(settings.mailingAddress)
    expect(payload.text).toContain("Unsubscribe:")
    expect(payload.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
  })
  it("blocks marketing without this workspace's address or recipient token before calling the provider", async () => {
    expect(await sendEmailToContact({ ...params, settings: { ...settings, mailingAddress: null } })).toMatchObject({ ok: false })
    expect(await sendEmailToContact({ ...params, contact: { ...params.contact, unsubscribe_token: null } })).toMatchObject({ ok: false })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("still allows requested correspondence without marketing settings", async () => {
    expect(await sendEmailToContact({ ...params, marketing: false, settings: { ...settings, mailingAddress: null } })).toMatchObject({ ok: true })
    expect(mocks.send.mock.calls[0][0].text).not.toContain("Unsubscribe:")
  })
})
