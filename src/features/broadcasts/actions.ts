"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import {
  getEmailSettings,
  renderTemplate,
  sendEmailToContact,
  type MessageContact,
} from "@/lib/messaging/send"
import { checkBroadcastReady, deliverBroadcast } from "./deliver"
import type { BroadcastChannel, BroadcastRecipientFilter } from "@/types/database"

// ── Broadcast Queries ──

export async function getBroadcasts() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getBroadcast(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (error) return { error: error.message }
  return { data }
}

// ── Broadcast Mutations ──

export async function createBroadcast(input: {
  name: string
  channel: BroadcastChannel
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      channel: input.channel,
      status: "draft",
      recipient_filter: {},
      stats: { total: 0, sent: 0, failed: 0, opened: 0 },
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/broadcasts")
  return { data }
}

export async function updateBroadcast(
  id: string,
  input: {
    name?: string
    email_subject?: string
    email_body?: string
    email_template_id?: string | null
    sms_body?: string
    sms_template_id?: string | null
    recipient_filter?: BroadcastRecipientFilter
    scheduled_at?: string | null
  }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Only allow updating draft broadcasts
  const { data: existing, error: fetchError } = await supabase
    .from("broadcasts")
    .select("status")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (existing.status !== "draft") {
    return { error: "Only draft broadcasts can be edited" }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.email_subject !== undefined) updates.email_subject = input.email_subject
  if (input.email_body !== undefined) updates.email_body = input.email_body
  if (input.email_template_id !== undefined) updates.email_template_id = input.email_template_id
  if (input.sms_body !== undefined) updates.sms_body = input.sms_body
  if (input.sms_template_id !== undefined) updates.sms_template_id = input.sms_template_id
  if (input.recipient_filter !== undefined) updates.recipient_filter = input.recipient_filter
  if (input.scheduled_at !== undefined) updates.scheduled_at = input.scheduled_at

  const { data, error } = await supabase
    .from("broadcasts")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/broadcasts")
  revalidatePath(`/broadcasts/${id}`)
  return { data }
}

export async function deleteBroadcast(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Only allow deleting draft or failed broadcasts
  const { data: existing, error: fetchError } = await supabase
    .from("broadcasts")
    .select("status")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (existing.status !== "draft" && existing.status !== "failed") {
    return { error: "Only draft or failed broadcasts can be deleted" }
  }

  const { error } = await supabase
    .from("broadcasts")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/broadcasts")
  return { success: true }
}

// ── Send Broadcast ──

export async function sendBroadcast(id: string) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  const result = await deliverBroadcast(supabase, { orgId, subAccountId, userId }, id)

  revalidatePath("/broadcasts")
  revalidatePath(`/broadcasts/${id}`)

  if (!result.ok) return { error: result.error }
  return { data: { sent: result.sent, failed: result.failed } }
}

// ── Schedule ──
// A scheduled broadcast is sent by the cron scheduler (/api/cron/tick, every
// 5 minutes) on the first tick at or after scheduled_at. Content and sender
// are checked now so a problem shows up while Rachel is still in the editor.

export async function scheduleBroadcast(id: string, scheduledAt: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime())) return { error: "Pick a valid date and time" }
  if (when.getTime() < Date.now() + 60_000) return { error: "Pick a time at least a minute from now, or use Send Now" }

  const { data: broadcast, error: fetchError } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (broadcast.status !== "draft") return { error: "Only draft broadcasts can be scheduled" }

  const notReady = await checkBroadcastReady(supabase, subAccountId, broadcast)
  if (notReady) return { error: notReady }

  const countResult = await getRecipientCount(
    broadcast.recipient_filter as BroadcastRecipientFilter,
    broadcast.channel as BroadcastChannel
  )
  const count = countResult.data ?? 0
  if (!count) return { error: "No eligible recipients match this filter (consent and contact method required)" }

  const { error } = await supabase
    .from("broadcasts")
    .update({ status: "scheduled", scheduled_at: when.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "draft")

  if (error) return { error: error.message }

  revalidatePath("/broadcasts")
  revalidatePath(`/broadcasts/${id}`)
  return { success: true, recipients: count }
}

// Back to draft so it can be edited; only while nothing has gone out.
export async function unscheduleBroadcast(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("broadcasts")
    .update({ status: "draft", scheduled_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .eq("status", "scheduled")
    .select("id")

  if (error) return { error: error.message }
  if (!data?.length) return { error: "This broadcast is no longer scheduled (it may already be sending)" }

  revalidatePath("/broadcasts")
  revalidatePath(`/broadcasts/${id}`)
  return { success: true }
}

// ── Recipient Count Preview ──

export async function getRecipientCount(
  filter: BroadcastRecipientFilter,
  channel: BroadcastChannel
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  let query = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (!filter.all) {
    const orConditions: string[] = []

    if (filter.tags && filter.tags.length > 0) {
      orConditions.push(`tags.ov.{${filter.tags.join(",")}}`)
    }
    if (filter.sources && filter.sources.length > 0) {
      orConditions.push(`source.in.(${filter.sources.join(",")})`)
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(","))
    }
  }

  // Filter by channel-appropriate contact method + consent
  if (channel === "email") {
    query = query.not("email", "is", null).in("consent_status", ["explicit", "implied"])
  } else {
    query = query.not("phone", "is", null).in("consent_status", ["explicit", "implied"])
  }

  const { count, error } = await query

  if (error) return { error: error.message }
  return { data: count ?? 0 }
}

// ── Test send ──
// Sends the current editor content to the workspace copy address (intake
// notify → reply-to → from) with sample merge values and a preview
// unsubscribe link. Nothing is logged on any contact.

export async function sendBroadcastTest(input: { subject: string; body: string }) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()
  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject || !body) return { error: "Subject and body are required for a test send" }

  const settings = await getEmailSettings(supabase, subAccountId)
  if (!settings) return { error: "Email sending is not configured. Set a verified sender email in Settings > Email." }

  const { data: me } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("sub_account_id", subAccountId)
    .eq("email", settings.copyTo)
    .limit(1)
    .maybeSingle()

  const sample: MessageContact = {
    id: "test",
    first_name: me?.first_name ?? "Test",
    last_name: me?.last_name ?? "Recipient",
    email: settings.copyTo,
    phone: null,
    unsubscribe_token: "preview",
  }

  const result = await sendEmailToContact({
    supabase,
    orgId,
    subAccountId,
    userId,
    contact: sample,
    settings,
    subject: `[TEST] ${renderTemplate(subject, sample)}`,
    body: renderTemplate(body, sample),
    includeSignature: false,
    marketing: true,
    skipActivity: true,
  })
  if (!result.ok) return { error: result.error }
  return { success: true, sentTo: settings.copyTo }
}
