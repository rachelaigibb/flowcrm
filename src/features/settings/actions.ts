"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"

// ── Organization ──

export async function updateOrganization(data: {
  name?: string
  logo_url?: string | null
}) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can update organization settings" }
  }

  const { error } = await supabase
    .from("organizations")
    .update(data)
    .eq("id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Sub-accounts ──

export async function createSubAccount(data: {
  name: string
  currency: string
  timezone: string
}) {
  const { userId, orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can create sub-accounts" }
  }

  // Generate slug from name
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const { data: subAccount, error } = await supabase
    .from("sub_accounts")
    .insert({
      org_id: orgId,
      name: data.name,
      slug,
      currency: data.currency,
      timezone: data.timezone,
      settings: {},
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  // Create default pipeline stages
  const defaultStages = [
    { name: "New", position: 1, color: "#6366f1" },
    { name: "Contacted", position: 2, color: "#8b5cf6" },
    { name: "Qualified", position: 3, color: "#0ea5e9" },
    { name: "Proposal", position: 4, color: "#f59e0b" },
    { name: "Negotiation", position: 5, color: "#f97316" },
    { name: "Won", position: 6, color: "#22c55e" },
    { name: "Lost", position: 7, color: "#ef4444" },
  ]

  await supabase.from("pipeline_stages").insert(
    defaultStages.map((s) => ({
      org_id: orgId,
      sub_account_id: subAccount.id,
      ...s,
    }))
  )

  // Create sub-account membership for current user
  await supabase.from("sub_account_memberships").insert({
    user_id: userId,
    sub_account_id: subAccount.id,
    role: "admin",
  })

  revalidatePath("/settings")
  return { data: subAccount }
}

export async function updateSubAccount(
  id: string,
  data: {
    name?: string
    currency?: string
    timezone?: string
    settings?: Record<string, unknown>
  }
) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can update sub-account settings" }
  }

  const { error } = await supabase
    .from("sub_accounts")
    .update(data)
    .eq("id", id)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  revalidatePath(`/settings/sub-accounts/${id}`)
  return { success: true }
}

// ── Pipeline Stages ──

export async function createPipelineStage(
  subAccountId: string,
  name: string,
  color: string
) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage pipeline stages" }
  }

  // Get the next position
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("sub_account_id", subAccountId)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = stages && stages.length > 0 ? stages[0].position + 1 : 1

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name,
      color,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/settings/sub-accounts/${subAccountId}`)
  return { data }
}

export async function updatePipelineStage(
  id: string,
  data: { name?: string; color?: string }
) {
  const { orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage pipeline stages" }
  }

  const { error } = await supabase
    .from("pipeline_stages")
    .update(data)
    .eq("id", id)

  if (error) return { error: error.message }

  // Get the sub_account_id to revalidate the correct path
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("sub_account_id")
    .eq("id", id)
    .single()

  if (stage) {
    revalidatePath(`/settings/sub-accounts/${stage.sub_account_id}`)
  }
  return { success: true }
}

export async function reorderPipelineStages(
  stages: { id: string; position: number }[]
) {
  const { orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage pipeline stages" }
  }

  // Update each stage's position
  const updates = stages.map((s) =>
    supabase
      .from("pipeline_stages")
      .update({ position: s.position })
      .eq("id", s.id)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  // Get sub_account_id from first stage for revalidation
  if (stages.length > 0) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("sub_account_id")
      .eq("id", stages[0].id)
      .single()

    if (stage) {
      revalidatePath(`/settings/sub-accounts/${stage.sub_account_id}`)
    }
  }

  return { success: true }
}

export async function deletePipelineStage(id: string) {
  const { orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage pipeline stages" }
  }

  // Check if any deals reference this stage
  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id)

  if (count && count > 0) {
    return {
      error: `Cannot delete this stage — ${count} deal${count !== 1 ? "s" : ""} still reference${count === 1 ? "s" : ""} it. Move or delete the deals first.`,
    }
  }

  // Get sub_account_id before deleting
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("sub_account_id")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  if (stage) {
    revalidatePath(`/settings/sub-accounts/${stage.sub_account_id}`)
  }

  return { success: true }
}
