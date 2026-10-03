import type { SupabaseClient } from "@supabase/supabase-js"
import type { Document } from "@/types/database"
import { MAX_UPLOAD_BYTES } from "@/features/documents/store"

export interface UploadedEmailFile { path: string; name: string }
export function safeAttachmentName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "file"
}

// References are untrusted. Restrict them to this user, contact and workspace,
// verify actual storage sizes before downloading, then persist document rows.
export async function loadEmailAttachments(ctx: {
  supabase: SupabaseClient; orgId: string; subAccountId: string; userId: string
}, contactId: string, input: unknown): Promise<{ documents: Document[]; buffers: Buffer[] } | { error: string }> {
  if (!Array.isArray(input) || input.length > 20) return { error: "Invalid attachment list." }
  const prefix = `${ctx.subAccountId}/email/${contactId}/${ctx.userId}/`
  const files: UploadedEmailFile[] = []
  const sizes: number[] = []
  let total = 0
  for (const value of input) {
    if (!value || typeof value.path !== "string" || typeof value.name !== "string" || !value.name || value.name.length > 255 || !value.path.startsWith(prefix)) return { error: "Invalid attachment reference." }
    const suffix = value.path.slice(prefix.length)
    if (!/^[0-9a-f-]{36}\/[^/]+$/.test(suffix) || suffix.split("/")[1] !== safeAttachmentName(value.name) || files.some(f => f.path === value.path)) return { error: "Invalid attachment reference." }
    const { data, error } = await ctx.supabase.storage.from("documents").info(value.path)
    const size = data?.size
    if (error || typeof size !== "number" || size <= 0) return { error: "An attachment has not finished uploading. Please attach it again." }
    total += size
    if (total > MAX_UPLOAD_BYTES) return { error: "Attachments must total 10 MB or less." }
    sizes.push(size); files.push(value)
  }
  const documents: Document[] = [], buffers: Buffer[] = []
  for (const [i, file] of files.entries()) {
    const { data, error } = await ctx.supabase.storage.from("documents").download(file.path)
    if (error || !data || data.size !== sizes[i]) return { error: "Could not read an uploaded attachment. Email was not sent." }
    const buffer = Buffer.from(await data.arrayBuffer())
    const { data: existing } = await ctx.supabase.from("documents").select("*").eq("path", file.path).eq("sub_account_id", ctx.subAccountId).eq("contact_id", contactId).eq("created_by", ctx.userId).maybeSingle()
    let doc = existing
    if (!doc) {
      const result = await ctx.supabase.from("documents").insert({ org_id: ctx.orgId, sub_account_id: ctx.subAccountId, contact_id: contactId, name: file.name, path: file.path, size: buffer.length, mime_type: data.type || null, created_by: ctx.userId }).select("*").single()
      if (result.error || !result.data) return { error: "Could not record the attachment. Email was not sent." }
      doc = result.data
    }
    documents.push(doc as Document); buffers.push(buffer)
  }
  return { documents, buffers }
}
