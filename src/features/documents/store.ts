import type { createClient } from "@/lib/supabase/server"
import type { Document } from "@/types/database"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// 10 MB per upload / per email — matches the bucket's file_size_limit and
// keeps well under Resend's 40 MB message cap.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function totalSize(files: File[]) {
  return files.reduce((sum, f) => sum + f.size, 0)
}

function safeName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "file"
}

// Saves files to the private "documents" bucket under <sub_account_id>/ and
// records them in the documents table. Returns the rows and the raw bytes
// (so an email send can attach them without reading storage back).
export async function storeFiles(params: {
  supabase: SupabaseServerClient
  orgId: string
  subAccountId: string
  userId: string
  files: File[]
  contactId?: string | null
  dealId?: string | null
  activityId?: string | null
}): Promise<{ documents: Document[]; buffers: Buffer[] } | { error: string }> {
  const { supabase, orgId, subAccountId, userId, files } = params
  if (totalSize(files) > MAX_UPLOAD_BYTES) {
    return { error: `Files must total ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or less.` }
  }

  const documents: Document[] = []
  const buffers: Buffer[] = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const path = `${subAccountId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, buffer, { contentType: file.type || "application/octet-stream" })
    if (uploadError) return { error: `Upload failed: ${uploadError.message}` }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        org_id: orgId,
        sub_account_id: subAccountId,
        contact_id: params.contactId ?? null,
        deal_id: params.dealId ?? null,
        activity_id: params.activityId ?? null,
        name: file.name,
        path,
        size: file.size,
        mime_type: file.type || null,
        created_by: userId,
      })
      .select("*")
      .single()
    if (error || !data) {
      await supabase.storage.from("documents").remove([path])
      return { error: error?.message ?? "Could not record the file" }
    }
    documents.push(data as Document)
    buffers.push(buffer)
  }
  return { documents, buffers }
}
