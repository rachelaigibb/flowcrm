"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { assertMarketingEligibility } from "@/lib/messaging/marketing-eligibility"
import { getBroadcastRecipients } from "./deliver"
import { mergeAudience, normalizeAudience } from "./audience"
import type { BroadcastChannel } from "@/types/database"

export type ContactBroadcastTarget =
  | { kind: "new"; name: string; channel: BroadcastChannel; draftId: string }
  | { kind: "existing"; id: string }
export interface ContactAudiencePreview {
  token: string
  name: string
  channel: BroadcastChannel
  scheduledAt: string | null
  added: number
  alreadyIncluded: number
  excluded: { name: string; reason: string }[]
  total: number
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getEditableBroadcasts() {
  const { supabase, orgId, subAccountId } = await getUserContext()
  const { data, error } = await supabase.from("broadcasts").select("id,name,channel,status,scheduled_at")
    .eq("org_id", orgId).eq("sub_account_id", subAccountId).in("status", ["draft", "scheduled"])
    .order("created_at", { ascending: false })
  return error ? { error: error.message } : { data: data ?? [] }
}

async function prepare(ids: string[], target: ContactBroadcastTarget) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(id => typeof id === "string" && uuid.test(id))) throw new Error("Select between 1 and 500 contacts.")
  if (!target || !["new", "existing"].includes(target.kind)) throw new Error("Choose a broadcast.")
  const ctx = await getUserContext()
  const { supabase, orgId, subAccountId } = ctx
  let broadcast
  if (target.kind === "existing") {
    if (!uuid.test(target.id)) throw new Error("Choose a valid broadcast.")
    const { data, error } = await supabase.from("broadcasts").select("id,name,channel,status,recipient_filter,scheduled_at,updated_at")
      .eq("id", target.id).eq("org_id", orgId).eq("sub_account_id", subAccountId).single()
    if (error || !data) throw new Error("Broadcast not found in this workspace.")
    if (!["draft", "scheduled"].includes(data.status)) throw new Error("This broadcast has started or is no longer editable.")
    broadcast = data
  } else {
    if (!uuid.test(target.draftId) || typeof target.name !== "string" || !target.name.trim() || target.name.length > 200 || !["email", "sms"].includes(target.channel)) throw new Error("Enter a broadcast name and choose email or SMS.")
    broadcast = { id: target.draftId, name: target.name.trim(), channel: target.channel, status: "draft", recipient_filter: { contact_ids: [] }, scheduled_at: null, updated_at: null }
  }
  if (!normalizeAudience(broadcast.recipient_filter)) throw new Error("The saved audience is invalid. Review it in Broadcasts first.")
  const uniqueIds = [...new Set(ids)].sort()
  const { data: contacts, error } = await supabase.from("contacts").select("id,first_name,last_name,email,phone,consent_status,tags,unsubscribe_token")
    .eq("org_id", orgId).eq("sub_account_id", subAccountId).in("id", uniqueIds).order("id")
  if (error) throw new Error("Could not verify selected contacts.")
  // Reject missing/foreign IDs without disclosing another workspace's records.
  if (contacts?.length !== uniqueIds.length) throw new Error("Some selected contacts are no longer available in this workspace. Refresh Contacts.")
  const { data: existing, error: existingError } = await getBroadcastRecipients(supabase, ctx, broadcast.recipient_filter, broadcast.channel, false, uniqueIds)
  if (existingError) throw new Error("Could not verify the existing audience.")
  const included = new Set((existing ?? []).map(c => c.id))
  const excluded: ContactAudiencePreview["excluded"] = []
  const eligible: string[] = []
  // Bounded concurrency for current suppression checks; no provider calls or sends.
  for (let offset = 0; offset < contacts.length; offset += 10) {
    const checked = await Promise.all(contacts.slice(offset, offset + 10).map(async contact => {
      let reason = ""
      if (!['explicit', 'implied'].includes(contact.consent_status)) reason = "Marketing consent required"
      else if (contact.tags?.includes("do-not-contact")) reason = "Do-not-contact tag"
      else if (!(broadcast.channel === "email" ? contact.email : contact.phone)?.trim()) reason = `Missing ${broadcast.channel === "email" ? "email address" : "phone number"}`
      else if (broadcast.channel === "email") {
        try { await assertMarketingEligibility(supabase, orgId, subAccountId, contact.id, contact.email!, contact.unsubscribe_token) }
        catch (error) { reason = error instanceof Error ? error.message : "Email eligibility could not be verified" }
      }
      return { contact, reason }
    }))
    for (const { contact, reason } of checked) {
      if (reason) excluded.push({ name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed contact", reason })
      else eligible.push(contact.id)
    }
  }
  const additions = eligible.filter(id => !included.has(id)).sort()
  const merged = mergeAudience(broadcast.recipient_filter, additions)
  if (!merged) throw new Error("Could not preserve the existing audience.")
  const { count, error: countError } = await getBroadcastRecipients(supabase, ctx, merged, broadcast.channel, true)
  if (countError) throw new Error("Could not count the revised audience.")
  const preview: ContactAudiencePreview = {
    token: createHash("sha256").update(JSON.stringify({ target, ids: uniqueIds, revision: broadcast.updated_at, merged, eligible: eligible.sort(), excluded, total: count ?? 0 })).digest("hex"),
    name: broadcast.name, channel: broadcast.channel as BroadcastChannel, scheduledAt: broadcast.scheduled_at,
    added: additions.length, alreadyIncluded: eligible.length - additions.length, excluded, total: count ?? 0,
  }
  return { ctx, broadcast, merged, preview }
}

export async function previewContactAudience(ids: string[], target: ContactBroadcastTarget) {
  try { return { data: (await prepare(ids, target)).preview } }
  catch (error) { return { error: error instanceof Error ? error.message : "Could not preview recipients." } }
}

export async function addContactsToBroadcast(ids: string[], target: ContactBroadcastTarget, token: string) {
  try {
    const { ctx, broadcast, merged, preview } = await prepare(ids, target)
    if (preview.token !== token) throw new Error("The audience or broadcast changed. Preview again before adding contacts.")
    if (!preview.added) throw new Error("No new eligible contacts to add.")
    const { supabase, orgId, subAccountId } = ctx
    if (target.kind === "new") {
      const { error } = await supabase.from("broadcasts").insert({ id: broadcast.id, org_id: orgId, sub_account_id: subAccountId,
        name: broadcast.name, channel: broadcast.channel, status: "draft", recipient_filter: merged, stats: { total: 0, sent: 0, failed: 0 } })
      if (error) {
        // A retried create uses the same UUID. Never make a duplicate draft.
        const { data: created } = await supabase.from("broadcasts").select("id").eq("id", broadcast.id).eq("org_id", orgId).eq("sub_account_id", subAccountId).maybeSingle()
        if (!created) throw new Error(error.message)
      }
    } else {
      const { data, error } = await supabase.from("broadcasts").update({ recipient_filter: merged, updated_at: new Date().toISOString() })
        .eq("id", broadcast.id).eq("org_id", orgId).eq("sub_account_id", subAccountId)
        .eq("status", broadcast.status).eq("updated_at", broadcast.updated_at).select("id")
      if (error) throw new Error(error.message)
      if (!data?.length) throw new Error("This broadcast changed or started sending. Refresh and preview again.")
    }
    revalidatePath("/broadcasts")
    revalidatePath(`/broadcasts/${broadcast.id}`)
    return { data: { id: broadcast.id, added: preview.added } }
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not add contacts." } }
}
