"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { storeFiles, MAX_UPLOAD_BYTES } from "./store"
import type { Document } from "@/types/database"

export async function listDocuments(scope: { contactId?: string; dealId?: string }) {
  const { subAccountId, supabase } = await getUserContext()
  let q = supabase
    .from("documents")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
  if (scope.contactId) q = q.eq("contact_id", scope.contactId)
  else if (scope.dealId) q = q.eq("deal_id", scope.dealId)
  else return { data: [] as Document[] }
  const { data, error } = await q
  if (error) return { error: error.message }
  return { data: (data ?? []) as Document[] }
}

// Upload one or more files to a contact or deal. Called with FormData from
// the Documents card: fields contact_id | deal_id, and one or more "files".
export async function uploadDocuments(formData: FormData) {
  const ctx = await getUserContext()
  const contactId = (formData.get("contact_id") as string | null) || null
  const dealId = (formData.get("deal_id") as string | null) || null
  if (!contactId && !dealId) return { error: "Nothing to attach the file to." }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { error: "Choose at least one file." }

  const result = await storeFiles({ ...ctx, files, contactId, dealId })
  if ("error" in result) return { error: result.error }

  if (contactId) revalidatePath(`/contacts/${contactId}`)
  if (dealId) revalidatePath("/pipeline")
  return { data: result.documents }
}

export async function deleteDocument(id: string) {
  const { subAccountId, supabase } = await getUserContext()
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("sub_account_id", subAccountId)
    .single()
  if (!doc) return { error: "Document not found" }

  const { error: storageError } = await supabase.storage.from("documents").remove([doc.path])
  if (storageError) return { error: storageError.message }
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { error: error.message }

  if (doc.contact_id) revalidatePath(`/contacts/${doc.contact_id}`)
  return { success: true }
}

export async function getUploadLimit() {
  return MAX_UPLOAD_BYTES
}
