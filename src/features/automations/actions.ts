"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import type { AutomationTriggerType, AutomationStepActionType } from "@/types/database"

// ── Automation CRUD ──

export async function getAutomations() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("automations")
    .select("*, automation_runs(count)")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getAutomation(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (error) return { error: error.message }

  // Fetch steps separately, ordered by position
  const { data: steps, error: stepsError } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("automation_id", id)
    .order("position")

  if (stepsError) return { error: stepsError.message }

  return { data: { ...data, steps: steps ?? [] } }
}

export async function createAutomation(input: {
  name: string
  description?: string
  trigger_type: AutomationTriggerType
  trigger_config?: Record<string, unknown>
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("automations")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config ?? {},
      enabled: false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/automations")
  return { data }
}

export async function updateAutomation(
  id: string,
  input: {
    name?: string
    description?: string | null
    trigger_type?: AutomationTriggerType
    trigger_config?: Record<string, unknown>
    enabled?: boolean
  }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.trigger_type !== undefined) updates.trigger_type = input.trigger_type
  if (input.trigger_config !== undefined) updates.trigger_config = input.trigger_config
  if (input.enabled !== undefined) updates.enabled = input.enabled

  const { data, error } = await supabase
    .from("automations")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/automations")
  revalidatePath(`/automations/${id}`)
  return { data }
}

export async function deleteAutomation(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/automations")
  return { success: true }
}

// ── Automation Steps (replace-all pattern) ──

export async function saveAutomationSteps(
  automationId: string,
  steps: Array<{ action_type: AutomationStepActionType; config: Record<string, unknown> }>
) {
  const { orgId, supabase } = await getUserContext()

  // Delete all existing steps for this automation
  const { error: deleteError } = await supabase
    .from("automation_steps")
    .delete()
    .eq("automation_id", automationId)
    .eq("org_id", orgId)

  if (deleteError) return { error: deleteError.message }

  // Insert new steps with position = index
  if (steps.length > 0) {
    const rows = steps.map((step, index) => ({
      automation_id: automationId,
      org_id: orgId,
      position: index,
      action_type: step.action_type,
      config: step.config,
    }))

    const { error: insertError } = await supabase
      .from("automation_steps")
      .insert(rows)

    if (insertError) return { error: insertError.message }
  }

  revalidatePath("/automations")
  revalidatePath(`/automations/${automationId}`)
  return { success: true }
}

// ── Automation Runs ──

export async function getAutomationRuns(automationId: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("automation_runs")
    .select("*, contact:contacts(id, first_name, last_name, email)")
    .eq("automation_id", automationId)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("started_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function runAutomationManually(automationId: string, contactId: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      automation_id: automationId,
      contact_id: contactId,
      status: "running",
      started_at: new Date().toISOString(),
      current_step: 0,
      log: [{ event: "manual_trigger", timestamp: new Date().toISOString() }],
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // TODO: Phase 2+ — trigger actual step execution engine here

  revalidatePath("/automations")
  revalidatePath(`/automations/${automationId}`)
  return { data }
}
