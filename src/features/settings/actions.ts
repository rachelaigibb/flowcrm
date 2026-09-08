"use server"

import { revalidatePath } from "next/cache"
import { TAG_COLORS } from "@/lib/constants/colors"
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


// Tags can reach contacts without passing through the app (CSV import used to, and the website
// lead pipe still writes with a service key). Make the Settings list the union of what is
// configured and what is actually in use, persisting any newcomers with the default grey.
export async function reconcileTagDefinitions() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const [{ data: subAccount }, { data: rows }] = await Promise.all([
    supabase.from("sub_accounts").select("settings").eq("id", subAccountId).single(),
    supabase.from("contacts").select("tags").eq("sub_account_id", subAccountId),
  ])

  const settings = (subAccount?.settings ?? {}) as Record<string, unknown>
  const existing = (settings.tags as Array<{ id: string; name: string; color: string }>) ?? []
  const known = new Set(existing.map((t) => t.name.toLowerCase()))
  const inUse = new Set<string>()
  for (const r of rows ?? []) for (const t of (r.tags as string[]) ?? []) if (t && !known.has(t.toLowerCase())) inUse.add(t)
  if (inUse.size === 0) return { data: existing }

  // Give each new tag a distinct palette colour (least-used first) rather than grey.
  const palette: string[] = TAG_COLORS.map((c) => c.value)
  const usage = new Map<string, number>(palette.map((c) => [c, 0]))
  for (const t of existing) if (usage.has(t.color)) usage.set(t.color, (usage.get(t.color) ?? 0) + 1)
  const added = Array.from(inUse).sort().map((name) => {
    const color = [...usage.entries()].sort((a, b) => a[1] - b[1] || palette.indexOf(a[0]) - palette.indexOf(b[0]))[0][0]
    usage.set(color, (usage.get(color) ?? 0) + 1)
    return { id: crypto.randomUUID(), name, color }
  })
  const merged = [...existing, ...added]
  await supabase
    .from("sub_accounts")
    .update({ settings: { ...settings, tags: merged }, updated_at: new Date().toISOString() })
    .eq("id", subAccountId)
    .eq("org_id", orgId)
  return { data: merged }
}

// Dashboard period (week / month / quarter / year / all / y:YYYY), stored per workspace.
export async function setDashboardRange(range: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()
  const ok = ["week", "month", "quarter", "year", "all"].includes(range) || /^y:\d{4}$/.test(range)
  if (!ok) return { error: "Invalid range" }
  const { data: subAccount } = await supabase.from("sub_accounts").select("settings").eq("id", subAccountId).single()
  const settings = (subAccount?.settings ?? {}) as Record<string, unknown>
  const { error } = await supabase
    .from("sub_accounts")
    .update({ settings: { ...settings, dashboard_range: range }, updated_at: new Date().toISOString() })
    .eq("id", subAccountId)
    .eq("org_id", orgId)
  if (error) return { error: error.message }
  revalidatePath("/dashboard")
  return { data: range }
}
