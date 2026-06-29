"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import type { CreateContactInput, UpdateContactInput } from "./types"

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
      consent_status: input.consent_status ?? "none",
      metadata: {},
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
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

  revalidatePath("/contacts")
  return { data: contact }
}

export async function updateContact(
  id: string,
  input: UpdateContactInput
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

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

  revalidatePath("/contacts")
  revalidatePath(`/contacts/${id}`)
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

export async function importContacts(
  rows: Record<string, string | null>[]
) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  let imported = 0
  let failed = 0
  const errors: string[] = []

  // Process in batches of 50
  const batchSize = 50
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)

    const contactInserts = batch.map((row) => ({
      org_id: orgId,
      sub_account_id: subAccountId,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      email: row.email || null,
      phone: row.phone || null,
      company: row.company || null,
      source: row.source || null,
      tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
      consent_status: "none" as const,
      metadata: {},
    }))

    const { data: contacts, error } = await supabase
      .from("contacts")
      .insert(contactInserts)
      .select("id")

    if (error) {
      failed += batch.length
      errors.push(`Batch starting at row ${i + 1}: ${error.message}`)
      continue
    }

    imported += contacts.length

    // Create system activities for imported contacts
    const activityInserts = contacts.map((c) => ({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: c.id,
      user_id: userId,
      type: "system" as const,
      content: "Contact imported via CSV",
      metadata: {},
    }))

    await supabase.from("activities").insert(activityInserts)
  }

  revalidatePath("/contacts")
  return { imported, failed, errors }
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
