"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { triggerAutomations } from "@/features/automations/engine"
import type { CreateContactInput, UpdateContactInput } from "./types"
import type { ConsentStatus } from "@/types/database"
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, type CallOutcome } from "@/features/calls/outcomes"

// Auto-register any new tags in sub-account settings (with default gray color)
async function syncNewTags(
  supabase: Awaited<ReturnType<typeof getUserContext>>["supabase"],
  orgId: string,
  subAccountId: string,
  tags: string[]
) {
  if (!tags.length) return

  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", subAccountId)
    .single()

  const settings = (subAccount?.settings ?? {}) as Record<string, unknown>
  const existingTags = (settings.tags as Array<{ id: string; name: string; color: string }>) ?? []
  const existingNames = new Set(existingTags.map((t) => t.name.toLowerCase()))

  const newTags = tags.filter((t) => !existingNames.has(t.toLowerCase()))
  if (!newTags.length) return

  const tagsToAdd = newTags.map((name) => ({
    id: crypto.randomUUID(),
    name,
    color: "#6b7280", // default gray — user can change color in settings
  }))

  await supabase
    .from("sub_accounts")
    .update({
      settings: { ...settings, tags: [...existingTags, ...tagsToAdd] },
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)
}

export async function createContact(input: CreateContactInput) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      first_name: input.first_name || null,
      last_name: input.last_name || null,
      email: input.email || null,
      phone: input.phone || null,
      company: input.company || null,
      source: input.source || null,
      tags: input.tags ?? [],
      birthday: input.birthday || null,
      consent_status: input.consent_status ?? "none",
      metadata: {},
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Sync any new tags to settings
  if (input.tags?.length) {
    await syncNewTags(supabase, orgId, subAccountId, input.tags)
  }

  // Create system activity
  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    contact_id: contact.id,
    user_id: userId,
    type: "system",
    content: "Contact created",
    metadata: {},
  })

  await triggerAutomations(supabase, { orgId, subAccountId, userId }, {
    type: "contact_created",
    contactId: contact.id,
  })

  revalidatePath("/contacts")
  revalidatePath("/settings")
  return { data: contact }
}

export async function updateContact(
  id: string,
  input: UpdateContactInput
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  // Snapshot existing tags so we can detect newly added ones for automations
  let previousTags: string[] = []
  if (input.tags) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("tags")
      .eq("id", id)
      .eq("sub_account_id", subAccountId)
      .single()
    previousTags = (existing?.tags as string[]) ?? []
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Sync any new tags to settings
  if (input.tags?.length) {
    await syncNewTags(supabase, orgId, subAccountId, input.tags)
  }

  // Create system activity
  await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    contact_id: id,
    user_id: userId,
    type: "system",
    content: "Contact updated",
    metadata: {},
  })

  if (input.tags) {
    const previousLower = new Set(previousTags.map((t) => t.toLowerCase()))
    const addedTags = input.tags.filter((t) => !previousLower.has(t.toLowerCase()))
    for (const tagName of addedTags) {
      await triggerAutomations(supabase, { orgId, subAccountId, userId }, {
        type: "tag_added",
        contactId: id,
        tagName,
      })
    }
  }

  revalidatePath("/contacts")
  revalidatePath(`/contacts/${id}`)
  revalidatePath("/settings")
  return { data: contact }
}

export async function deleteContact(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/contacts")
  return { success: true }
}

// Google Contacts labels arrive as "** Clients ::: Imported on 8/26 ::: * myContacts". Turn them
// into clean tags and drop Google's bookkeeping labels.
function labelsToTags(raw: string): string[] {
  return raw
    .split(/:::|,|;/)
    .map((t) => t.replace(/[*✖︎✓]/g, "").trim())
    .filter((t) => t && !/^(mycontacts|imported on|import from|starred)/i.test(t))
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
}

function parseDateLoose(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/) // M/D/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
  const y = t.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
  if (y) return `${y[1]}-${y[2].padStart(2, "0")}-${y[3].padStart(2, "0")}`
  return null
}

export async function importContacts(
  rows: Record<string, string | null>[],
  options: { defaultConsent?: ConsentStatus; importTag?: string | null } = {}
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()
  const defaultConsent: ConsentStatus = options.defaultConsent ?? "none"
  const importTag = options.importTag?.trim() || null

  let imported = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  // Existing emails in this workspace — rows matching one are skipped, not duplicated
  const { data: existingRows } = await supabase
    .from("contacts")
    .select("email")
    .eq("sub_account_id", subAccountId)
    .not("email", "is", null)
  const seen = new Set((existingRows ?? []).map((r) => (r.email as string).toLowerCase()))

  const batchSize = 50
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    const prepared = batch.flatMap((row) => {
      const email = row.email?.trim().toLowerCase() || null
      if (email && seen.has(email)) { skipped++; return [] }
      if (email) seen.add(email)
      const first = row.first_name?.trim() || null
      const last = row.last_name?.trim() || null
      const company = row.company?.trim() || null
      if (!first && !last && !email && !company) { skipped++; return [] }

      const tags = new Set<string>(row.tags ? labelsToTags(row.tags) : [])
      if (importTag) tags.add(importTag)
      const consentRaw = row.consent_status?.trim().toLowerCase()
      const consent: ConsentStatus = (["explicit", "implied", "none", "withdrawn"] as const).find((c) => c === consentRaw) ?? defaultConsent
      const displayRaw = row.consent_to_display_sale?.trim().toLowerCase()
      const display = displayRaw === "yes" || displayRaw === "no" ? displayRaw : "pending"

      return [{
        insert: {
          org_id: orgId,
          sub_account_id: subAccountId,
          first_name: first ?? (company && !last ? company : null),
          last_name: last,
          email,
          phone: row.phone?.trim() || null,
          company,
          source: row.source?.trim() || null,
          tags: Array.from(tags),
          birthday: parseDateLoose(row.birthday),
          last_contact: parseDateLoose(row.last_contact),
          consent_status: consent,
          consent_to_display_sale: display,
          metadata: row.address?.trim() ? { address: { formatted: row.address.trim() } } : {},
        },
        notes: row.notes?.trim() || null,
      }]
    })
    if (prepared.length === 0) continue

    const { data: contacts, error } = await supabase
      .from("contacts")
      .insert(prepared.map((p) => p.insert))
      .select("id")

    if (error) {
      failed += prepared.length
      errors.push(`Batch starting at row ${i + 1}: ${error.message}`)
      continue
    }

    imported += contacts.length

    // Register any new tags so they appear in Settings (same as create/update)
    await syncNewTags(supabase, orgId, subAccountId, Array.from(new Set(prepared.flatMap((p) => p.insert.tags))))

    const activityInserts = contacts.flatMap((c, idx) => {
      const base = { org_id: orgId, sub_account_id: subAccountId, contact_id: c.id, user_id: userId }
      const list: Array<Record<string, unknown>> = [
        { ...base, type: "system", content: "Contact imported via CSV", metadata: importTag ? { import: importTag } : {} },
      ]
      const note = prepared[idx]?.notes
      if (note) list.push({ ...base, type: "note", content: note, metadata: { import: "notes" } })
      return list
    })
    await supabase.from("activities").insert(activityInserts)
  }

  revalidatePath("/contacts")
  revalidatePath("/settings")
  return { imported, skipped, failed, errors }
}

// One-tap call logging for the daily call block: writes a `call` activity,
// stamps last_contact = today, and optionally creates the next-step task.
export async function logCall(
  contactId: string,
  input: {
    outcome: CallOutcome
    note?: string
    nextStep?: { title: string; due_date: string | null }
  }
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  if (!CALL_OUTCOMES.includes(input.outcome)) {
    return { error: "Unknown call outcome" }
  }

  const today = new Date().toISOString().slice(0, 10)
  const summary = CALL_OUTCOME_LABELS[input.outcome]
  const content = input.note?.trim() ? `${summary} — ${input.note.trim()}` : summary

  const { error: actError } = await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    contact_id: contactId,
    user_id: userId,
    type: "call",
    content,
    metadata: { outcome: input.outcome, logged_on: today },
  })
  if (actError) return { error: actError.message }

  const { error: upError } = await supabase
    .from("contacts")
    .update({ last_contact: today, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("sub_account_id", subAccountId)
  if (upError) return { error: upError.message }

  if (input.nextStep?.title.trim()) {
    const { error: taskError } = await supabase.from("tasks").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      assigned_to: userId,
      title: input.nextStep.title.trim(),
      description: null,
      due_date: input.nextStep.due_date,
      priority: "medium",
      contact_id: contactId,
      deal_id: null,
      status: "pending",
    })
    if (taskError) return { error: `Call logged, but the task failed: ${taskError.message}` }
  }

  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/contacts")
  revalidatePath("/calls")
  revalidatePath("/tasks")
  return { success: true }
}

// Today's call queue: contacts carrying a tag, never-contacted first, then longest since last contact.
export async function getCallQueue(tag: string | null, limit = 10) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  let q = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, tags, last_contact, source")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .not("phone", "is", null)
    .order("last_contact", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(limit)
  if (tag) q = q.contains("tags", [tag])

  const { data, error } = await q
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function addNote(contactId: string, content: string) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  if (!content.trim()) {
    return { error: "Note content is required" }
  }

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: contactId,
      user_id: userId,
      type: "note",
      content: content.trim(),
      metadata: {},
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/contacts/${contactId}`)
  return { data: activity }
}

export async function editNote(noteId: string, content: string) {
  const { supabase } = await getUserContext()

  if (!content.trim()) {
    return { error: "Note content is required" }
  }

  const { error } = await supabase
    .from("activities")
    .update({ content: content.trim() })
    .eq("id", noteId)
    .eq("type", "note")

  if (error) return { error: error.message }

  // Get the contact_id to revalidate the right path
  const { data: activity } = await supabase
    .from("activities")
    .select("contact_id")
    .eq("id", noteId)
    .single()

  if (activity?.contact_id) {
    revalidatePath(`/contacts/${activity.contact_id}`)
  }
  return { success: true }
}

export async function deleteNote(noteId: string) {
  const { supabase } = await getUserContext()

  // Get contact_id before deleting for revalidation
  const { data: activity } = await supabase
    .from("activities")
    .select("contact_id")
    .eq("id", noteId)
    .single()

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", noteId)
    .eq("type", "note")

  if (error) return { error: error.message }

  if (activity?.contact_id) {
    revalidatePath(`/contacts/${activity.contact_id}`)
  }
  return { success: true }
}
