import { getResendClient } from "@/lib/resend/client"
import type { IntakePayload } from "@/features/intake/validate"

export interface IntakeResult {
  contact_id: string
  created: boolean
  org_id: string
  sub_account_id: string
  sub_account_name: string
  key_label: string
  email_settings: { from_name?: string; from_email?: string; reply_to?: string } | null
  notify_email: string | null
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)
}

// Emails a copy of the submission to the workspace's notify address. Uses the
// workspace's own Email Settings as sender (a verified Resend domain). Returns
// false, never throws, when nothing is configured — the contact is already saved.
export async function sendIntakeNotification(
  result: IntakeResult,
  payload: IntakePayload,
  appUrl: string
): Promise<boolean> {
  const fromEmail = result.email_settings?.from_email
  const to = result.notify_email || result.email_settings?.reply_to || fromEmail
  if (!fromEmail || !to || !process.env.RESEND_API_KEY) return false

  const rows: Array<[string, string]> = [
    ["Name", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone ?? "—"],
    ["Source", payload.source],
    ["Tags", payload.tags.join(", ") || "—"],
    ["Message", payload.message ?? "—"],
    ...Object.entries(payload.meta),
  ]
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")
  const link = `${appUrl.replace(/\/$/, "")}/contacts/${result.contact_id}`

  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: `${result.email_settings?.from_name || result.sub_account_name} <${fromEmail}>`,
      to: [to],
      replyTo: payload.email,
      subject: `New website lead: ${payload.name} (${payload.source})`,
      html: `<p>${result.created ? "New contact" : "Existing contact"} in <strong>${escapeHtml(result.sub_account_name)}</strong> via ${escapeHtml(result.key_label)}.</p><table>${table}</table><p><a href="${link}">Open in FlowCRM</a></p>`,
    })
    if (error) {
      console.error("[intake] notification failed:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[intake] notification failed:", err)
    return false
  }
}
