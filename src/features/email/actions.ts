"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { getResendClient } from "@/lib/resend/client"

// ── Send Email ──

export async function sendEmail(
  contactId: string,
  toEmail: string,
  subject: string,
  body: string
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  // Get email settings from sub-account
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings, name")
    .eq("id", subAccountId)
    .single()

  const emailSettings = (subAccount?.settings as Record<string, unknown>)?.email as
    | { from_name?: string; from_email?: string; reply_to?: string }
    | undefined

  const fromEmail = emailSettings?.from_email
  if (!fromEmail) {
    return { error: "Email sending is not configured. Set a verified sender email in Settings > Email." }
  }

  const fromName = emailSettings?.from_name || subAccount?.name || "FlowCRM"
  const replyTo = emailSettings?.reply_to || fromEmail

  try {
    const resend = getResendClient()
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      replyTo,
      subject,
      text: body,
    })

    if (sendError) {
      return { error: `Failed to send email: ${sendError.message}` }
    }

    // Log as activity
    await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: contactId,
      user_id: userId,
      type: "email",
      content: `**${subject}**\n\n${body}`,
      metadata: {
        resend_id: sendResult?.id,
        to: toEmail,
        from: `${fromName} <${fromEmail}>`,
        subject,
        sent_at: new Date().toISOString(),
      },
    })

    revalidatePath(`/contacts/${contactId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending email"
    return { error: message }
  }
}

// ── Email Template CRUD ──

export async function getEmailTemplates() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("name")

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function createEmailTemplate(input: {
  name: string
  subject: string
  body: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data }
}

export async function updateEmailTemplate(
  id: string,
  input: { name?: string; subject?: string; body?: string }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const updates: Record<string, string> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.subject !== undefined) updates.subject = input.subject.trim()
  if (input.body !== undefined) updates.body = input.body.trim()

  const { data, error } = await supabase
    .from("email_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data }
}

export async function deleteEmailTemplate(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Email Settings ──

export async function updateEmailSettings(settings: {
  from_name?: string
  from_email?: string
  reply_to?: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Fetch current settings
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", subAccountId)
    .single()

  const currentSettings = (subAccount?.settings ?? {}) as Record<string, unknown>

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: {
        ...currentSettings,
        email: {
          from_name: settings.from_name?.trim() || null,
          from_email: settings.from_email?.trim() || null,
          reply_to: settings.reply_to?.trim() || null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}
