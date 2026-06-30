"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"

// ── Tag type for settings.tags JSONB array ──
interface SettingsTag {
  id: string
  name: string
  color: string
}

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
  const { userId, orgId, supabase } = await getUserContext()

  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  const { data: result, error } = await supabase.rpc(
    "create_sub_account_with_defaults",
    {
      p_org_id: orgId,
      p_user_id: userId,
      p_name: data.name,
      p_slug: slug,
      p_currency: data.currency,
      p_timezone: data.timezone,
    }
  )

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data: { id: result } }
}

export async function updateSubAccount(
  id: string,
  data: {
    name?: string
    currency?: string
    timezone?: string
    accent_color?: string
    logo_url?: string | null
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

// ── Theme (stored in sub_account settings JSONB) ──

export async function updateSubAccountTheme(
  subAccountId: string,
  theme: string
) {
  const { orgId, supabase } = await getUserContext()

  const { settings, error: fetchError } = await getSubAccountSettings(supabase, subAccountId, orgId)
  if (fetchError) return { error: fetchError }

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: { ...settings!, theme },
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Tags (stored in sub_account settings JSONB) ──

async function getSubAccountSettings(supabase: Awaited<ReturnType<typeof getUserContext>>["supabase"], id: string, orgId: string) {
  const { data, error } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", id)
    .eq("org_id", orgId)
    .single()

  if (error) return { error: error.message, settings: null }
  const settings = (data?.settings as Record<string, unknown>) ?? {}
  return { error: null, settings }
}

export async function createTag(
  subAccountId: string,
  name: string,
  color: string
) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage tags" }
  }

  const { settings, error: fetchError } = await getSubAccountSettings(supabase, subAccountId, orgId)
  if (fetchError) return { error: fetchError }

  const existingTags = (settings!.tags as SettingsTag[] | undefined) ?? []

  const newTag: SettingsTag = {
    id: crypto.randomUUID(),
    name,
    color,
  }

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: { ...settings!, tags: [...existingTags, newTag] },
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath(`/settings/sub-accounts/${subAccountId}`)
  return { data: newTag }
}

export async function updateTag(
  subAccountId: string,
  tagId: string,
  data: { name?: string; color?: string }
) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage tags" }
  }

  const { settings, error: fetchError } = await getSubAccountSettings(supabase, subAccountId, orgId)
  if (fetchError) return { error: fetchError }

  const existingTags = (settings!.tags as SettingsTag[] | undefined) ?? []
  const tagIndex = existingTags.findIndex((t) => t.id === tagId)

  if (tagIndex === -1) return { error: "Tag not found" }

  existingTags[tagIndex] = { ...existingTags[tagIndex], ...data }

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: { ...settings!, tags: existingTags },
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath(`/settings/sub-accounts/${subAccountId}`)
  return { success: true }
}

export async function deleteTag(subAccountId: string, tagId: string) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only admins can manage tags" }
  }

  const { settings, error: fetchError } = await getSubAccountSettings(supabase, subAccountId, orgId)
  if (fetchError) return { error: fetchError }

  const existingTags = (settings!.tags as SettingsTag[] | undefined) ?? []
  const filtered = existingTags.filter((t) => t.id !== tagId)

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: { ...settings!, tags: filtered },
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath(`/settings/sub-accounts/${subAccountId}`)
  return { success: true }
}
