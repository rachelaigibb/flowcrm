"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { triggerAutomations } from "@/features/automations/engine"
import type { CreateDealInput, UpdateDealInput } from "./types"
import type { DealStatus, DealContact } from "@/types/database"

async function getContext() {
  return getUserContext()
}

// Free geocoding via OpenStreetMap Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "FlowCRM/1.0" } }
    )
    const data = await res.json()
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch {
    // Geocoding failed — not critical
  }
  return null
}

export async function createDeal(input: CreateDealInput) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

  // Geocode address if provided
  let latitude: number | null = null
  let longitude: number | null = null
  if (input.address?.trim()) {
    const coords = await geocodeAddress(input.address.trim())
    if (coords) {
      latitude = coords.lat
      longitude = coords.lng
    }
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      title: input.title,
      value: input.value,
      currency: input.currency,
      stage_id: input.stage_id,
      priority: input.priority,
      status: "open" as const,
      expected_close: input.expected_close,
      contact_id: input.contact_id,
      address: input.address?.trim() || null,
      side: input.side ?? null,
      latitude,
      longitude,
      metadata: {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create deal: ${error.message}`)
  }

  // Create activity for deal creation
  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    deal_id: deal.id,
    contact_id: input.contact_id,
    user_id: userId,
    type: "system",
    content: "Deal created",
    metadata: {},
  })

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
  return deal
}

export async function updateDeal(dealId: string, input: UpdateDealInput) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

  // Re-geocode if address changed
  if (input.address !== undefined) {
    if (input.address?.trim()) {
      const coords = await geocodeAddress(input.address.trim())
      if (coords) {
        input.latitude = coords.lat
        input.longitude = coords.lng
      } else {
        input.latitude = null
        input.longitude = null
      }
    } else {
      input.address = null
      input.latitude = null
      input.longitude = null
    }
  }

  const { data: deal, error } = await supabase
    .from("deals")
    .update(input)
    .eq("id", dealId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update deal: ${error.message}`)
  }

  // Create activity for update
  const changedFields = Object.keys(input).join(", ")
  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    deal_id: deal.id,
    contact_id: deal.contact_id,
    user_id: userId,
    type: "system",
    content: `Deal updated: ${changedFields}`,
    metadata: { changes: input },
  })

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
  return deal
}

export async function moveDeal(dealId: string, newStageId: string) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

  // Get the stage name for the activity log
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("name")
    .eq("id", newStageId)
    .single()

  // Landing in a stage named Won / Lost is a status change too — otherwise the pipeline shows
  // the deal as won while Reports (which read `status`) still count it as open.
  const stageName = (stage?.name ?? "").trim().toLowerCase()
  const statusPatch =
    stageName === "won" ? { status: "won" as const, closed_at: new Date().toISOString().slice(0, 10) }
    : stageName === "lost" ? { status: "lost" as const }
    : {}

  const { error } = await supabase
    .from("deals")
    .update({ stage_id: newStageId, ...statusPatch })
    .eq("id", dealId)
    .eq("sub_account_id", subAccountId)

  if (error) {
    throw new Error(`Failed to move deal: ${error.message}`)
  }

  // Get deal for contact_id
  const { data: deal } = await supabase
    .from("deals")
    .select("contact_id")
    .eq("id", dealId)
    .single()

  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    deal_id: dealId,
    contact_id: deal?.contact_id ?? null,
    user_id: userId,
    type: "status_change",
    content: `Deal moved to ${stage?.name ?? "unknown stage"}`,
    metadata: { new_stage_id: newStageId },
  })

  if (deal?.contact_id) {
    await triggerAutomations(supabase, { orgId, subAccountId, userId }, {
      type: "deal_stage_change",
      contactId: deal.contact_id,
      stageId: newStageId,
    })
  }

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
}

export async function updateDealStatus(dealId: string, status: DealStatus) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

  const { data: deal, error } = await supabase
    .from("deals")
    .update({ status })
    .eq("id", dealId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update deal status: ${error.message}`)
  }

  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    deal_id: dealId,
    contact_id: deal.contact_id,
    user_id: userId,
    type: "status_change",
    content: `Deal marked as ${status}`,
    metadata: { status },
  })

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
  return deal
}

export async function deleteDeal(dealId: string) {
  const { supabase, subAccountId } = await getContext()

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", dealId)
    .eq("sub_account_id", subAccountId)

  if (error) {
    throw new Error(`Failed to delete deal: ${error.message}`)
  }

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
}

export async function addDealNote(dealId: string, content: string) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

  const { data: deal } = await supabase
    .from("deals")
    .select("contact_id")
    .eq("id", dealId)
    .single()

  const { error } = await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    deal_id: dealId,
    contact_id: deal?.contact_id ?? null,
    user_id: userId,
    type: "note",
    content,
    metadata: {},
  })

  if (error) {
    throw new Error(`Failed to add note: ${error.message}`)
  }

  revalidatePath("/pipeline")
  revalidatePath("/calendar")
}

export async function fetchDealActivities(dealId: string) {
  const { supabase } = await getContext()

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`)
  }

  return data
}

export async function searchContacts(query: string) {
  const { supabase, subAccountId } = await getContext()

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, company")
    .eq("sub_account_id", subAccountId)
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`
    )
    .limit(10)

  return data ?? []
}

// ── Deal associations (deal_contacts) ──

export async function listDealContacts(dealId: string) {
  const { supabase, subAccountId } = await getContext()
  const { data, error } = await supabase
    .from("deal_contacts")
    .select("*, contact:contacts(id, first_name, last_name, email, phone, company)")
    .eq("deal_id", dealId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: true })
  if (error) return { error: error.message, data: [] as DealContact[] }
  return { data: (data ?? []) as DealContact[] }
}

export async function addDealContact(dealId: string, contactId: string, role: string, note?: string) {
  const { supabase, userId, orgId, subAccountId } = await getContext()
  const cleanRole = role.trim().toLowerCase() || "contact"
  const { data: deal } = await supabase.from("deals").select("id, title").eq("id", dealId).eq("sub_account_id", subAccountId).single()
  if (!deal) return { error: "Deal not found" }
  const { data, error } = await supabase
    .from("deal_contacts")
    .insert({ org_id: orgId, sub_account_id: subAccountId, deal_id: dealId, contact_id: contactId, role: cleanRole, note: note?.trim() || null, created_by: userId })
    .select("*, contact:contacts(id, first_name, last_name, email, phone, company)")
    .single()
  if (error) return { error: error.code === "23505" ? "Already linked with that role" : error.message }
  await supabase.from("activities").insert({
    org_id: orgId, sub_account_id: subAccountId, contact_id: contactId, deal_id: dealId, user_id: userId,
    type: "system", content: `Linked to ${deal.title} as ${cleanRole}${note?.trim() ? ` — ${note.trim()}` : ""}`, metadata: { deal_contact_id: data.id, role: cleanRole },
  })
  revalidatePath("/pipeline"); revalidatePath(`/contacts/${contactId}`)
  return { data: data as DealContact }
}

export async function removeDealContact(id: string) {
  const { supabase, subAccountId } = await getContext()
  const { data: row } = await supabase.from("deal_contacts").select("contact_id").eq("id", id).eq("sub_account_id", subAccountId).single()
  const { error } = await supabase.from("deal_contacts").delete().eq("id", id).eq("sub_account_id", subAccountId)
  if (error) return { error: error.message }
  revalidatePath("/pipeline"); if (row?.contact_id) revalidatePath(`/contacts/${row.contact_id}`)
  return { success: true }
}

/**
 * Log an inquiry on a deal (e.g. a buyer asking about a listing): links an existing contact or
 * creates a new lead, records the note on both, and books a follow-up task.
 */
export async function logInquiry(dealId: string, input: {
  contactId?: string | null
  newContact?: { first_name: string; last_name?: string; email?: string; phone?: string }
  note?: string
  followUpDays?: number | null
  role?: string
}) {
  const { supabase, userId, orgId, subAccountId } = await getContext()
  const { data: deal } = await supabase.from("deals").select("id, title, address").eq("id", dealId).eq("sub_account_id", subAccountId).single()
  if (!deal) return { error: "Deal not found" }
  let contactId = input.contactId ?? null
  if (!contactId) {
    const nc = input.newContact
    if (!nc || !nc.first_name.trim()) return { error: "Choose a contact or enter a name" }
    const { data: created, error: cErr } = await supabase
      .from("contacts")
      .insert({
        org_id: orgId, sub_account_id: subAccountId, first_name: nc.first_name.trim(), last_name: nc.last_name?.trim() || null,
        email: nc.email?.trim() || null, phone: nc.phone?.trim() || null, source: "Listing inquiry",
        tags: ["lead", "inquiry"], consent_status: "implied", consent_to_display_sale: "pending", last_contact: new Date().toISOString().slice(0, 10), metadata: {},
      })
      .select("id")
      .single()
    if (cErr || !created) return { error: cErr?.message ?? "Could not create contact" }
    contactId = created.id
    await supabase.from("activities").insert({ org_id: orgId, sub_account_id: subAccountId, contact_id: contactId, user_id: userId, type: "system", content: "Contact created from a deal inquiry", metadata: {} })
  } else {
    await supabase.from("contacts").update({ last_contact: new Date().toISOString().slice(0, 10) }).eq("id", contactId).eq("sub_account_id", subAccountId)
  }
  if (!contactId) return { error: "No contact" }
  const role = (input.role ?? "inquiry").trim().toLowerCase()
  const link = await addDealContact(dealId, contactId, role, input.note)
  if ("error" in link && link.error && link.error !== "Already linked with that role") return { error: link.error }
  if (input.note?.trim()) {
    await supabase.from("activities").insert({ org_id: orgId, sub_account_id: subAccountId, contact_id: contactId, deal_id: dealId, user_id: userId, type: "note", content: input.note.trim(), metadata: { inquiry: true } })
  }
  if (input.followUpDays != null && input.followUpDays >= 0) {
    const due = new Date(); due.setDate(due.getDate() + input.followUpDays)
    const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", contactId).single()
    const who = [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "contact"
    await supabase.from("tasks").insert({
      org_id: orgId, sub_account_id: subAccountId, assigned_to: userId, title: `Follow up with ${who} re ${deal.title}`,
      due_date: due.toISOString().slice(0, 10), priority: "medium", contact_id: contactId, deal_id: dealId, status: "pending",
    })
  }
  revalidatePath("/pipeline"); revalidatePath("/tasks"); revalidatePath(`/contacts/${contactId}`)
  return { data: { contactId } }
}

/** Inquiry counts per deal for the pipeline board. */
export async function getDealPeopleCounts() {
  const { supabase, subAccountId } = await getContext()
  const { data } = await supabase.from("deal_contacts").select("deal_id, role").eq("sub_account_id", subAccountId)
  const counts: Record<string, { people: number; inquiries: number }> = {}
  for (const r of data ?? []) {
    const c = (counts[r.deal_id] ??= { people: 0, inquiries: 0 })
    c.people++; if (r.role === "inquiry") c.inquiries++
  }
  return counts
}
