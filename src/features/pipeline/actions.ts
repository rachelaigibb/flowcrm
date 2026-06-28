"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import type { CreateDealInput, UpdateDealInput } from "./types"
import type { DealStatus } from "@/types/database"

async function getContext() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value

  if (!subAccountId) {
    throw new Error("No sub account selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // Get org_id from sub_account
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("org_id")
    .eq("id", subAccountId)
    .single()

  if (!subAccount) {
    throw new Error("Sub account not found")
  }

  return { supabase, userId: user.id, orgId: subAccount.org_id, subAccountId }
}

export async function createDeal(input: CreateDealInput) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

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
  return deal
}

export async function updateDeal(dealId: string, input: UpdateDealInput) {
  const { supabase, userId, orgId, subAccountId } = await getContext()

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

  const { error } = await supabase
    .from("deals")
    .update({ stage_id: newStageId })
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

  revalidatePath("/pipeline")
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
}

export async function fetchDealActivities(dealId: string) {
  const supabase = await createClient()

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
  const supabase = await createClient()
  const cookieStore = await cookies()
  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value

  if (!subAccountId) return []

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
