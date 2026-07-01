"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { getTwilioClient } from "@/lib/twilio/client"

// ── Send SMS ──

export async function sendSms(
  contactId: string,
  toPhone: string,
  body: string
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  // Get SMS settings from sub-account
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings, name")
    .eq("id", subAccountId)
    .single()

  const smsSettings = (subAccount?.settings as Record<string, unknown>)?.sms as
    | { twilio_phone_number?: string }
    | undefined

  const fromPhone = smsSettings?.twilio_phone_number
  if (!fromPhone) {
    return { error: "SMS sending is not configured. Set a Twilio phone number in Settings > SMS." }
  }

  try {
    const client = getTwilioClient()
    const message = await client.messages.create({
      body,
      from: fromPhone,
      to: toPhone,
    })

    // Log as activity
    await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: contactId,
      user_id: userId,
      type: "sms",
      content: body,
      metadata: {
        twilio_sid: message.sid,
        to: toPhone,
        from: fromPhone,
        status: message.status,
        sent_at: new Date().toISOString(),
      },
    })

    revalidatePath(`/contacts/${contactId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending SMS"
    return { error: message }
  }
}

// ── SMS Template CRUD ──

export async function getSmsTemplates() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("sms_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("name")

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function createSmsTemplate(input: {
  name: string
  body: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("sms_templates")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      body: input.body.trim(),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data }
}

export async function updateSmsTemplate(
  id: string,
  input: { name?: string; body?: string }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const updates: Record<string, string> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.body !== undefined) updates.body = input.body.trim()

  const { data, error } = await supabase
    .from("sms_templates")
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

export async function deleteSmsTemplate(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("sms_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── SMS Settings ──

export async function updateSmsSettings(settings: {
  twilio_phone_number?: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

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
        sms: {
          twilio_phone_number: settings.twilio_phone_number?.trim() || null,
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
