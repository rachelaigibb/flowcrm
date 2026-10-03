"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { getEmailSettings, sendEmailToContact, renderTemplate } from "@/lib/messaging/send"
import { storeFiles, MAX_UPLOAD_BYTES } from "@/features/documents/store"
import { loadEmailAttachments, safeAttachmentName } from "./attachments"
import type { Document } from "@/types/database"

// ── Send Email ──
// Called with FormData from the compose dialog: contact_id, subject, body,
// send_copy ("true" BCCs the workspace copy address) and uploaded_files references.
// Legacy clients may still supply binary files within the platform payload limit.

// Only small metadata reaches Vercel. The signed URL permits one private object
// upload; workspace/contact/user identity comes from the authenticated session.
export async function prepareEmailAttachment(contactId: string, name: string, size: number) {
  const ctx = await getUserContext()
  if (!name || name.length > 255 || !Number.isSafeInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return { error: "Choose a file of 10 MB or less." }
  const { data: contact } = await ctx.supabase.from("contacts").select("id").eq("id", contactId).eq("sub_account_id", ctx.subAccountId).single()
  if (!contact) return { error: "Contact not found." }
  const path = `${ctx.subAccountId}/email/${contactId}/${ctx.userId}/${crypto.randomUUID()}/${safeAttachmentName(name)}`
  const { data, error } = await ctx.supabase.storage.from("documents").createSignedUploadUrl(path)
  if (error || !data) return { error: "Could not start the attachment upload. Please try again." }
  return { path, signedUrl: data.signedUrl }
}

export async function getComposeDefaults() {
  const { subAccountId, supabase } = await getUserContext()
  const settings = await getEmailSettings(supabase, subAccountId)
  return {
    configured: Boolean(settings),
    copyTo: settings?.copyTo ?? null,
    hasSignature: Boolean(settings?.signature),
    maxBytes: MAX_UPLOAD_BYTES,
  }
}

export async function sendEmail(formData: FormData) {
  const ctx = await getUserContext()
  const { orgId, subAccountId, supabase } = ctx
  const contactId = String(formData.get("contact_id") ?? "")
  const subject = String(formData.get("subject") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  const sendCopy = formData.get("send_copy") === "true"
  const marketing = formData.get("marketing") !== "false"
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)

  if (!contactId || !subject || !body) return { error: "Subject and message are required." }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, consent_status, unsubscribe_token")
    .eq("id", contactId)
    .eq("sub_account_id", subAccountId)
    .single()
  if (!contact) return { error: "Contact not found" }
  if (!contact.email) return { error: "Contact has no email address" }
  if (marketing && !["explicit", "implied"].includes(contact.consent_status)) {
    return { error: "Marketing email requires explicit or implied consent. This contact is not eligible." }
  }

  const settings = await getEmailSettings(supabase, subAccountId)
  if (!settings) {
    return { error: "Email sending is not configured. Set a verified sender email in Settings > Email." }
  }
  if (marketing && !settings.mailingAddress) return { error: "Add this workspace's mailing address in Settings > Email before sending marketing email." }
  if (marketing && !contact.unsubscribe_token) return { error: "This contact is missing an unsubscribe link. Email was not sent." }
  const renderedSubject = renderTemplate(subject, contact)
  const renderedBody = renderTemplate(body, contact)
  if (/\{\{[^{}]+\}\}/.test(renderedSubject + renderedBody)) {
    return { error: "An unrecognized merge field remains. Use first_name, last_name, full_name, email, phone or unsubscribe_url." }
  }

  // Record uploaded attachments before delivery. Direct uploads remain available
  // to the draft after a provider rejection; legacy uploads keep their cleanup.
  let stored: { documents: Document[]; buffers: Buffer[] } | null = null
  if (formData.has("uploaded_files")) {
    let input: unknown
    try { input = JSON.parse(String(formData.get("uploaded_files"))) } catch { return { error: "Invalid attachment list." } }
    const result = await loadEmailAttachments(ctx, contactId, input)
    if ("error" in result) return { error: result.error }
    stored = result
  } else if (files.length > 0) {
    const result = await storeFiles({ ...ctx, files, contactId })
    if ("error" in result) return { error: result.error }
    stored = result
  }

  const copyTo = sendCopy ? settings.copyTo : null
  const result = await sendEmailToContact({
    supabase,
    orgId,
    subAccountId,
    userId: ctx.userId,
    contact,
    settings,
    subject: renderedSubject,
    body: renderedBody,
    marketing,
    attachments: stored?.documents.map((d, i) => ({ filename: d.name, content: stored!.buffers[i] })),
    bcc: copyTo ? [copyTo] : undefined,
    activityMetadata: stored
      ? { attachments: stored.documents.map((d) => ({ id: d.id, name: d.name, size: d.size })) }
      : undefined,
  })

  if (!result.ok) {
    if (stored && !formData.has("uploaded_files")) {
      await supabase.storage.from("documents").remove(stored.documents.map((d) => d.path))
      await supabase.from("documents").delete().in("id", stored.documents.map((d) => d.id))
    }
    return { error: `Failed to send email: ${result.error}` }
  }

  if (stored && result.activityId) {
    await supabase
      .from("documents")
      .update({ activity_id: result.activityId })
      .in("id", stored.documents.map((d) => d.id))
  }

  revalidatePath(`/contacts/${contactId}`)
  return { success: true, copiedTo: copyTo }
}

// ── Email Template CRUD ──

export async function getEmailTemplates() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("name")

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function createEmailTemplate(input: {
  name: string
  subject: string
  body: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data }
}

export async function updateEmailTemplate(
  id: string,
  input: { name?: string; subject?: string; body?: string }
) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const updates: Record<string, string> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.subject !== undefined) updates.subject = input.subject.trim()
  if (input.body !== undefined) updates.body = input.body.trim()

  const { data, error } = await supabase
    .from("email_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data }
}

export async function deleteEmailTemplate(id: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

// ── Email Settings ──

export async function updateEmailSettings(settings: {
  from_name?: string
  from_email?: string
  reply_to?: string
  signature?: string
  mailing_address?: string
}) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Fetch current settings
  const { data: subAccount } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", subAccountId)
    .single()

  const currentSettings = (subAccount?.settings ?? {}) as Record<string, unknown>

  const { error } = await supabase
    .from("sub_accounts")
    .update({
      settings: {
        ...currentSettings,
        email: {
          ...((currentSettings.email ?? {}) as Record<string, unknown>),
          from_name: settings.from_name?.trim() || null,
          from_email: settings.from_email?.trim() || null,
          reply_to: settings.reply_to?.trim() || null,
          signature: settings.signature?.trim() || null,
          mailing_address: settings.mailing_address?.trim() || null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", subAccountId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}
