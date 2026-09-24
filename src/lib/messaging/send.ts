import type { SupabaseClient } from "@supabase/supabase-js"
import { getResendClient } from "@/lib/resend/client"
import { getTwilioClient } from "@/lib/twilio/client"
import { buildEmailContent } from "@/lib/messaging/html"
import { unsubscribeHeaders, unsubscribeUrlFor } from "@/lib/messaging/unsubscribe"

// Cookie client for user actions; service client for the cron scheduler.
type SupabaseServerClient = SupabaseClient

export interface MessageContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  unsubscribe_token?: string | null
}

export interface EmailSettings {
  fromName: string
  fromEmail: string
  replyTo: string
  // Appended to every one-to-one email (compose, templates, automations).
  signature: string | null
  // Where "Send me a copy" goes: intake notify address → reply-to → from.
  copyTo: string
}

export interface EmailAttachment {
  filename: string
  content: Buffer
}

export interface SmsSettings {
  fromPhone: string
}

export type SendResult =
  | { ok: true; providerId: string | null; activityId: string | null }
  | { ok: false; error: string }

// Replaces {{first_name}}, {{last_name}}, {{full_name}}, {{email}}, {{phone}}
// (whitespace-tolerant, case-insensitive) with the contact's values.
// Also {{unsubscribe_url}} when the contact has a token, plus any extra tokens.
export function renderTemplate(text: string, contact: MessageContact, extra?: Record<string, string>): string {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
  const tokens: Record<string, string> = {
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    full_name: fullName,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    unsubscribe_url: unsubscribeUrlFor(contact.unsubscribe_token) ?? "",
    ...extra,
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/gi, (match, key: string) => {
    const value = tokens[key.toLowerCase()]
    return value !== undefined ? value : match
  })
}

export async function getEmailSettings(
  supabase: SupabaseServerClient,
  subAccountId: string
): Promise<EmailSettings | null> {
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings, name")
    .eq("id", subAccountId)
    .single()

  const settings = (subAccount?.settings ?? {}) as Record<string, unknown>
  const emailSettings = settings.email as
    | { from_name?: string; from_email?: string; reply_to?: string; signature?: string }
    | undefined
  const intake = settings.intake as { notify_email?: string } | undefined

  if (!emailSettings?.from_email) return null

  const replyTo = emailSettings.reply_to || emailSettings.from_email
  return {
    fromName: emailSettings.from_name || subAccount?.name || "FlowCRM",
    fromEmail: emailSettings.from_email,
    replyTo,
    signature: emailSettings.signature?.trim() || null,
    copyTo: intake?.notify_email?.trim() || replyTo,
  }
}

export async function getSmsSettings(
  supabase: SupabaseServerClient,
  subAccountId: string
): Promise<SmsSettings | null> {
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", subAccountId)
    .single()

  const smsSettings = (subAccount?.settings as Record<string, unknown>)?.sms as
    | { twilio_phone_number?: string }
    | undefined

  if (!smsSettings?.twilio_phone_number) return null

  return { fromPhone: smsSettings.twilio_phone_number }
}

export async function sendEmailToContact(params: {
  supabase: SupabaseServerClient
  orgId: string
  subAccountId: string
  // null when the scheduler sends and the org has no owner to attribute to
  userId: string | null
  contact: MessageContact
  settings: EmailSettings
  subject: string
  body: string
  // Broadcasts pass false: a campaign carries its own footer.
  includeSignature?: boolean
  // Marketing mail (broadcasts, automation emails): adds the sender line +
  // unsubscribe footer and the List-Unsubscribe headers. Needs the contact's
  // unsubscribe_token; without one the mail goes out without a footer.
  marketing?: boolean
  // Test sends: deliver but do not write an activity (the "contact" is a sample).
  skipActivity?: boolean
  attachments?: EmailAttachment[]
  bcc?: string[]
  activityMetadata?: Record<string, unknown>
}): Promise<SendResult> {
  const { supabase, orgId, subAccountId, userId, contact, settings, subject, body } = params

  if (!contact.email) {
    return { ok: false, error: "Contact has no email address" }
  }

  try {
    const resend = getResendClient()
    const unsubscribeUrl = params.marketing ? unsubscribeUrlFor(contact.unsubscribe_token) : null
    const footer = unsubscribeUrl
      ? { senderLine: `${settings.fromName} · ${settings.replyTo}`, unsubscribeUrl }
      : null
    const content = buildEmailContent(body, params.includeSignature === false ? null : settings.signature, footer)
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: `${settings.fromName} <${settings.fromEmail}>`,
      to: [contact.email],
      bcc: params.bcc && params.bcc.length > 0 ? params.bcc : undefined,
      replyTo: settings.replyTo,
      subject,
      text: content.text,
      html: content.html,
      headers: params.marketing ? unsubscribeHeaders(contact.unsubscribe_token) : undefined,
      attachments: params.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    })

    if (sendError) {
      return { ok: false, error: sendError.message }
    }

    if (params.skipActivity) {
      return { ok: true, providerId: sendResult?.id ?? null, activityId: null }
    }

    const { data: activity } = await supabase
      .from("activities")
      .insert({
        org_id: orgId,
        sub_account_id: subAccountId,
        contact_id: contact.id,
        user_id: userId,
        type: "email",
        content: `**${subject}**\n\n${body.trim()}`,
        metadata: {
          resend_id: sendResult?.id,
          to: contact.email,
          from: `${settings.fromName} <${settings.fromEmail}>`,
          subject,
          sent_at: new Date().toISOString(),
          ...(params.bcc && params.bcc.length > 0 ? { bcc: params.bcc } : {}),
          ...params.activityMetadata,
        },
      })
      .select("id")
      .single()

    return { ok: true, providerId: sendResult?.id ?? null, activityId: activity?.id ?? null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email" }
  }
}

export async function sendSmsToContact(params: {
  supabase: SupabaseServerClient
  orgId: string
  subAccountId: string
  // null when the scheduler sends and the org has no owner to attribute to
  userId: string | null
  contact: MessageContact
  settings: SmsSettings
  body: string
  activityMetadata?: Record<string, unknown>
}): Promise<SendResult> {
  const { supabase, orgId, subAccountId, userId, contact, settings, body } = params

  if (!contact.phone) {
    return { ok: false, error: "Contact has no phone number" }
  }

  try {
    const client = getTwilioClient()
    const message = await client.messages.create({
      body,
      from: settings.fromPhone,
      to: contact.phone,
    })

    const { data: activity } = await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: contact.id,
      user_id: userId,
      type: "sms",
      content: body,
      metadata: {
        twilio_sid: message.sid,
        to: contact.phone,
        from: settings.fromPhone,
        status: message.status,
        sent_at: new Date().toISOString(),
        ...params.activityMetadata,
      },
    }).select("id").single()

    return { ok: true, providerId: message.sid, activityId: activity?.id ?? null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending SMS" }
  }
}
