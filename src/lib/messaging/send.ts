import { createClient } from "@/lib/supabase/server"
import { getResendClient } from "@/lib/resend/client"
import { getTwilioClient } from "@/lib/twilio/client"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface MessageContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

export interface EmailSettings {
  fromName: string
  fromEmail: string
  replyTo: string
}

export interface SmsSettings {
  fromPhone: string
}

export type SendResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string }

// Replaces {{first_name}}, {{last_name}}, {{full_name}}, {{email}}, {{phone}}
// (whitespace-tolerant, case-insensitive) with the contact's values.
export function renderTemplate(text: string, contact: MessageContact): string {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
  const tokens: Record<string, string> = {
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    full_name: fullName,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
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

  const emailSettings = (subAccount?.settings as Record<string, unknown>)?.email as
    | { from_name?: string; from_email?: string; reply_to?: string }
    | undefined

  if (!emailSettings?.from_email) return null

  return {
    fromName: emailSettings.from_name || subAccount?.name || "FlowCRM",
    fromEmail: emailSettings.from_email,
    replyTo: emailSettings.reply_to || emailSettings.from_email,
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
  userId: string
  contact: MessageContact
  settings: EmailSettings
  subject: string
  body: string
  activityMetadata?: Record<string, unknown>
}): Promise<SendResult> {
  const { supabase, orgId, subAccountId, userId, contact, settings, subject, body } = params

  if (!contact.email) {
    return { ok: false, error: "Contact has no email address" }
  }

  try {
    const resend = getResendClient()
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: `${settings.fromName} <${settings.fromEmail}>`,
      to: [contact.email],
      replyTo: settings.replyTo,
      subject,
      text: body,
    })

    if (sendError) {
      return { ok: false, error: sendError.message }
    }

    await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: contact.id,
      user_id: userId,
      type: "email",
      content: `**${subject}**\n\n${body}`,
      metadata: {
        resend_id: sendResult?.id,
        to: contact.email,
        from: `${settings.fromName} <${settings.fromEmail}>`,
        subject,
        sent_at: new Date().toISOString(),
        ...params.activityMetadata,
      },
    })

    return { ok: true, providerId: sendResult?.id ?? null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email" }
  }
}

export async function sendSmsToContact(params: {
  supabase: SupabaseServerClient
  orgId: string
  subAccountId: string
  userId: string
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

    await supabase.from("activities").insert({
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
    })

    return { ok: true, providerId: message.sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending SMS" }
  }
}
