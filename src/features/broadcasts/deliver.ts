import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getEmailSettings,
  getSmsSettings,
  renderTemplate,
  sendEmailToContact,
  sendSmsToContact,
  type MessageContact,
} from "@/lib/messaging/send"
import type { BroadcastRecipientFilter } from "@/types/database"

// Shared by "Send now" (features/broadcasts/actions.ts, cookie client) and the
// cron scheduler (features/scheduler/tick.ts, service client). Plain module,
// not "use server": it takes the client and tenant ids from its caller.

export interface DeliveryContext {
  orgId: string
  subAccountId: string
  userId: string | null
}

export type DeliveryResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string }

const MARKETING_CONSENT = ["explicit", "implied"]

// Validates a broadcast is ready to go (content + sender configured) without
// changing it. Used before scheduling and again at send time.
export async function checkBroadcastReady(
  supabase: SupabaseClient,
  subAccountId: string,
  broadcast: { channel: string; email_subject: string | null; email_body: string | null; sms_body: string | null }
): Promise<string | null> {
  if (broadcast.channel === "email") {
    if (!broadcast.email_subject?.trim() || !broadcast.email_body?.trim()) {
      return "Email subject and body are required before sending"
    }
    if (!(await getEmailSettings(supabase, subAccountId))) {
      return "Email sending is not configured. Set a verified sender email in Settings > Email."
    }
  } else {
    if (!broadcast.sms_body?.trim()) return "SMS message body is required before sending"
    if (!(await getSmsSettings(supabase, subAccountId))) {
      return "SMS sending is not configured. Set a Twilio phone number in Settings > SMS."
    }
  }
  return null
}

// Eligible recipients: filter by tags (OR) / sources (OR) / all, plus the
// channel's contact method and marketing consent.
export async function getBroadcastRecipients(
  supabase: SupabaseClient,
  ctx: { orgId: string; subAccountId: string },
  filter: BroadcastRecipientFilter,
  channel: string
) {
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, consent_status, unsubscribe_token")
    .eq("org_id", ctx.orgId)
    .eq("sub_account_id", ctx.subAccountId)

  if (!filter.all) {
    const orConditions: string[] = []
    if (filter.tags && filter.tags.length > 0) orConditions.push(`tags.ov.{${filter.tags.join(",")}}`)
    if (filter.sources && filter.sources.length > 0) orConditions.push(`source.in.(${filter.sources.join(",")})`)
    if (orConditions.length > 0) query = query.or(orConditions.join(","))
  }

  if (channel === "email") {
    query = query.not("email", "is", null).in("consent_status", MARKETING_CONSENT)
  } else {
    query = query.not("phone", "is", null).in("consent_status", MARKETING_CONSENT)
  }
  return query
}

// Sends a draft or scheduled broadcast. The draft/scheduled → sending update
// is the claim: if two callers race (Send now vs the cron tick, or two ticks),
// only one matches the row and sends.
export async function deliverBroadcast(
  supabase: SupabaseClient,
  ctx: DeliveryContext,
  id: string
): Promise<DeliveryResult> {
  const { orgId, subAccountId, userId } = ctx

  const { data: broadcast, error: fetchError } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError || !broadcast) return { ok: false, error: fetchError?.message ?? "Broadcast not found" }
  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    return { ok: false, error: "Only draft or scheduled broadcasts can be sent" }
  }

  const notReady = await checkBroadcastReady(supabase, subAccountId, broadcast)
  if (notReady) return { ok: false, error: notReady }

  const emailSettings = broadcast.channel === "email" ? await getEmailSettings(supabase, subAccountId) : null
  const smsSettings = broadcast.channel === "sms" ? await getSmsSettings(supabase, subAccountId) : null

  const { data: recipients, error: recipientError } = await getBroadcastRecipients(
    supabase,
    ctx,
    broadcast.recipient_filter as BroadcastRecipientFilter,
    broadcast.channel
  )
  if (recipientError) return { ok: false, error: recipientError.message }

  const totalRecipients = recipients?.length ?? 0
  if (totalRecipients === 0) {
    return { ok: false, error: "No eligible recipients match this filter (consent and contact method required)" }
  }

  const { data: claimed, error: claimError } = await supabase
    .from("broadcasts")
    .update({
      status: "sending",
      stats: { total: totalRecipients, sent: 0, failed: 0, opened: 0 },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .in("status", ["draft", "scheduled"])
    .select("id")

  if (claimError) return { ok: false, error: claimError.message }
  if (!claimed?.length) return { ok: false, error: "This broadcast is already being sent" }

  // Personalized per contact, in small concurrent batches. Stats update after
  // every batch so the UI shows live progress on refresh.
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
            includeSignature: false,
            marketing: true,
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

  // 'failed' only if nothing went out
  const { error: sentError } = await supabase
    .from("broadcasts")
    .update({
      status: sent > 0 ? "sent" : "failed",
      sent_at: new Date().toISOString(),
      stats: {
        total: totalRecipients,
        sent,
        failed,
        opened: 0,
        ...(sent === 0 ? { error: failures[0]?.error ?? "All sends failed" } : {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)

  if (sentError) return { ok: false, error: sentError.message }

  if (failures.length > 0) {
    console.error(`[Broadcast ${id}] ${failed}/${totalRecipients} sends failed:`, failures.slice(0, 5))
  }

  if (sent === 0) {
    return { ok: false, error: `All ${totalRecipients} sends failed. First error: ${failures[0]?.error}` }
  }
  return { ok: true, sent, failed }
}
