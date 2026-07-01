"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { createClient } from "@/lib/supabase/server"
import type { FormField, FormSettings } from "@/types/database"

// ── Form CRUD ──

export async function getForms() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("forms")
    .select("*, form_submissions(count)")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getForm(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (error) return { error: error.message }
  return { data }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export async function createForm(input: { name: string; description?: string }) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const slug = generateSlug(input.name) + "-" + Date.now().toString(36)

  const defaultSettings: FormSettings = {
    submit_button_text: "Submit",
    success_message: "Thank you for your submission.",
    redirect_url: null,
    create_contact: true,
    notify_email: null,
  }

  const { data, error } = await supabase
    .from("forms")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      fields: [],
      settings: defaultSettings,
      published: false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/forms")
  return { data }
}

export async function updateForm(
  id: string,
  input: {
    name?: string
    description?: string | null
    fields?: FormField[]
    settings?: Partial<FormSettings>
    published?: boolean
  }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Build updates object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.fields !== undefined) updates.fields = input.fields
  if (input.published !== undefined) updates.published = input.published

  // Merge settings if provided
  if (input.settings !== undefined) {
    const { data: existing } = await supabase
      .from("forms")
      .select("settings")
      .eq("id", id)
      .single()

    const currentSettings = (existing?.settings ?? {}) as FormSettings
    updates.settings = { ...currentSettings, ...input.settings }
  }

  const { data, error } = await supabase
    .from("forms")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/forms")
  revalidatePath(`/forms/${id}`)
  return { data }
}

export async function deleteForm(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("forms")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/forms")
  return { success: true }
}

// ── Form Submissions ──

export async function getFormSubmissions(formId: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("form_submissions")
    .select("*, contact:contacts(id, first_name, last_name, email)")
    .eq("form_id", formId)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function deleteFormSubmission(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("form_submissions")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/forms")
  return { success: true }
}

// ── Public Form Submission (no auth required) ──

export async function submitPublicForm(
  formId: string,
  data: Record<string, string | boolean>
) {
  // Use anon client — no auth required
  const supabase = await createClient()

  // Fetch the form to validate it exists and is published
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", formId)
    .eq("published", true)
    .single()

  if (formError || !form) {
    return { error: "Form not found or not published" }
  }

  const typedForm = form as { id: string; org_id: string; sub_account_id: string; fields: FormField[]; settings: FormSettings }

  // Validate required fields
  const fields = typedForm.fields
  for (const field of fields) {
    if (field.required) {
      const value = data[field.id]
      if (value === undefined || value === "" || value === false) {
        return { error: `${field.label} is required` }
      }
    }
  }

  // Auto-create contact if enabled
  let contactId: string | null = null
  if (typedForm.settings.create_contact) {
    const emailField = fields.find((f) => f.type === "email")
    const emailValue = emailField ? (data[emailField.id] as string) : null

    // Try to find existing contact by email
    if (emailValue) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("sub_account_id", typedForm.sub_account_id)
        .eq("email", emailValue)
        .limit(1)

      if (existing && existing.length > 0) {
        contactId = existing[0].id
      }
    }

    // Create new contact if not found
    if (!contactId) {
      const nameField = fields.find((f) => f.type === "text" && f.label.toLowerCase().includes("name"))
      const phoneField = fields.find((f) => f.type === "phone")

      const nameValue = nameField ? (data[nameField.id] as string) : null
      const phoneValue = phoneField ? (data[phoneField.id] as string) : null

      // Split name into first/last
      const nameParts = nameValue?.trim().split(/\s+/) ?? []
      const firstName = nameParts[0] || null
      const lastName = nameParts.slice(1).join(" ") || null

      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          org_id: typedForm.org_id,
          sub_account_id: typedForm.sub_account_id,
          first_name: firstName,
          last_name: lastName,
          email: emailValue || null,
          phone: phoneValue || null,
          source: "form",
          tags: [],
          consent_status: "implied",
          metadata: { form_id: formId },
        })
        .select("id")
        .single()

      if (newContact) contactId = newContact.id
    }
  }

  // Insert submission
  const { error: submitError } = await supabase
    .from("form_submissions")
    .insert({
      org_id: typedForm.org_id,
      sub_account_id: typedForm.sub_account_id,
      form_id: formId,
      contact_id: contactId,
      data,
    })

  if (submitError) {
    return { error: "Failed to submit form" }
  }

  return {
    success: true,
    message: typedForm.settings.success_message,
    redirect_url: typedForm.settings.redirect_url,
  }
}
