"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import {
  getEmailSettings,
  getSmsSettings,
  renderTemplate,
  sendEmailToContact,
  sendSmsToContact,
  type MessageContact,
} from "@/lib/messaging/send"
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

  // Step a: Fetch the broadcast — must be draft or scheduled
  const { data: broadcast, error: fetchError } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    return { error: "Only draft or scheduled broadcasts can be sent" }
  }

  // Validate content and provider settings up front, while still draft
  if (broadcast.channel === "email") {
    if (!broadcast.email_subject?.trim() || !broadcast.email_body?.trim()) {
      return { error: "Email subject and body are required before sending" }
    }
  } else if (!broadcast.sms_body?.trim()) {
    return { error: "SMS message body is required before sending" }
  }

  const emailSettings =
    broadcast.channel === "email" ? await getEmailSettings(supabase, subAccountId) : null
  const smsSettings =
    broadcast.channel === "sms" ? await getSmsSettings(supabase, subAccountId) : null

  if (broadcast.channel === "email" && !emailSettings) {
    return { error: "Email sending is not configured. Set a verified sender email in Settings > Email." }
  }
  if (broadcast.channel === "sms" && !smsSettings) {
    return { error: "SMS sending is not configured. Set a Twilio phone number in Settings > SMS." }
  }

  // Step b: Fetch recipient contacts based on recipient_filter
  const filter = broadcast.recipient_filter as BroadcastRecipientFilter
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, consent_status")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (!filter.all) {
    // Build OR filters for tags and sources
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

  // Step c/d: Filter by channel-specific contact method + consent
  if (broadcast.channel === "email") {
    query = query.not("email", "is", null).in("consent_status", ["explicit", "implied"])
  } else {
    query = query.not("phone", "is", null).in("consent_status", ["explicit", "implied"])
  }

  const { data: recipients, error: recipientError } = await query

  if (recipientError) return { error: recipientError.message }

  const totalRecipients = recipients?.length ?? 0
  if (totalRecipients === 0) {
    return { error: "No eligible recipients match this filter (consent and contact method required)" }
  }

  // Step e: Update status to 'sending' with total count
  const { error: sendingError } = await supabase
    .from("broadcasts")
    .update({
      status: "sending",
      stats: { total: totalRecipients, sent: 0, failed: 0, opened: 0 },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)

  if (sendingError) return { error: sendingError.message }

  // Step f: Send to each recipient via Resend/Twilio, personalized per
  // contact, in small concurrent batches. Stats update after every batch so
  // the UI shows live progress on refresh.
  let sent = 0
  let failed = 0
  const failures: Array<{ contact_id: string; error: string }> = []
  const BATCH_SIZE = 5

  for (let i = 0; i < totalRecipients; i += BATCH_SIZE) {
    const batch = (recipients ?? []).slice(i, i + BATCH_SIZE) as MessageContact[]

    const results = await Promise.all(
      batch.map(async (contact) => {
        if (broadcast.channel === "email") {
          return sendEmailToContact({
            supabase,
            orgId,
            subAccountId,
            userId,
            contact,
            settings: emailSettings!,
            subject: renderTemplate(broadcast.email_subject as string, contact),
            body: renderTemplate(broadcast.email_body as string, contact),
            activityMetadata: { broadcast_id: id },
          })
        }
        return sendSmsToContact({
          supabase,
          orgId,
          subAccountId,
          userId,
          contact,
          settings: smsSettings!,
          body: renderTemplate(broadcast.sms_body as string, contact),
          activityMetadata: { broadcast_id: id },
        })
      })
    )

    results.forEach((result, idx) => {
      if (result.ok) {
        sent++
      } else {
        failed++
        failures.push({ contact_id: batch[idx].id, error: result.error })
      }
    })

    await supabase
      .from("broadcasts")
      .update({
        stats: { total: totalRecipients, sent, failed, opened: 0 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgId)
  }

  // Step g: Final status — 'failed' only if nothing went out
  const finalStatus = sent > 0 ? "sent" : "failed"
  const { error: sentError } = await supabase
    .from("broadcasts")
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      stats: { total: totalRecipients, sent, failed, opened: 0 },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)

  if (sentError) return { error: sentError.message }

  if (failures.length > 0) {
    console.error(`[Broadcast ${id}] ${failed}/${totalRecipients} sends failed:`, failures.slice(0, 5))
  }

  // Step h: Revalidate paths
  revalidatePath("/broadcasts")
  revalidatePath(`/broadcasts/${id}`)

  if (sent === 0) {
    return { error: `All ${totalRecipients} sends failed. First error: ${failures[0]?.error}` }
  }
  return { data: { sent, failed } }
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
