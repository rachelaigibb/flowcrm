"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import type { CreateTaskInput, UpdateTaskInput } from "./types"

/**
 * Normalise any date value to YYYY-MM-DD (or null).
 * Accepts ISO timestamps, Date-like strings, or already-formatted dates.
 */
function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  // ISO string or other parseable format — extract the date part
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return null
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  } catch {
    return null
  }
}

export async function createTask(input: CreateTaskInput) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      assigned_to: userId,
      title: input.title,
      description: input.description || null,
      due_date: toDateOnly(input.due_date),
      priority: input.priority,
      contact_id: input.contact_id || null,
      deal_id: input.deal_id || null,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  // Create activity on linked contact/deal
  if (input.contact_id || input.deal_id) {
    await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: input.contact_id || null,
      deal_id: input.deal_id || null,
      task_id: data.id,
      user_id: userId,
      type: "system",
      content: `Task created: ${input.title}`,
      metadata: {},
    })
  }

  revalidatePath("/tasks")
  return { data }
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Normalise due_date before saving
  const payload = { ...input }
  if ("due_date" in payload) {
    payload.due_date = toDateOnly(payload.due_date)
  }

  const { error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}

export async function toggleTaskStatus(id: string) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  // Get current task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, status, contact_id, deal_id")
    .eq("id", id)
    .eq("sub_account_id", subAccountId)
    .single()

  if (fetchError || !task) return { error: "Task not found" }

  const newStatus = task.status === "pending" ? "completed" : "pending"

  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", id)

  if (error) return { error: error.message }

  // Log activity
  const activityContent =
    newStatus === "completed"
      ? `Task completed: ${task.title}`
      : `Task reopened: ${task.title}`

  if (task.contact_id || task.deal_id) {
    await supabase.from("activities").insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      contact_id: task.contact_id,
      deal_id: task.deal_id,
      task_id: id,
      user_id: userId,
      type: "system",
      content: activityContent,
      metadata: {},
    })
  }

  revalidatePath("/tasks")
  return { success: true, newStatus }
}

export async function deleteTask(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}

export async function bulkDeleteTasks(ids: string[]) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("tasks")
    .delete()
    .in("id", ids)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}

export async function addTaskNote(taskId: string, content: string) {
  const { userId, orgId, subAccountId, supabase } = await getUserContext()

  // Get the task to link contact/deal context
  const { data: task } = await supabase
    .from("tasks")
    .select("id, contact_id, deal_id")
    .eq("id", taskId)
    .eq("sub_account_id", subAccountId)
    .single()

  const { error } = await supabase.from("activities").insert({
    org_id: orgId,
    sub_account_id: subAccountId,
    contact_id: task?.contact_id ?? null,
    deal_id: task?.deal_id ?? null,
    task_id: taskId,
    user_id: userId,
    type: "note",
    content,
    metadata: {},
  })

  if (error) return { error: error.message }

  revalidatePath("/tasks")
  return { success: true }
}

export async function fetchTaskActivities(taskId: string) {
  const { supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }

  return { data: data ?? [] }
}
