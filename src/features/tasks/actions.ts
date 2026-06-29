"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import type { CreateTaskInput, UpdateTaskInput } from "./types"

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
      due_date: input.due_date || null,
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

  const { error } = await supabase
    .from("tasks")
    .update(input)
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
