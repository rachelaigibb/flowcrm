"use server"

import { createHash, randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import type { IntakeKey } from "@/types/database"

function isAdmin(orgRole: string | null | undefined) {
  return orgRole === "owner" || orgRole === "admin"
}

export async function listIntakeKeys(subAccountId: string) {
  const { supabase } = await getUserContext()
  const { data, error } = await supabase
    .from("intake_keys")
    .select("id, org_id, sub_account_id, label, key_prefix, created_at, last_used_at, revoked_at")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data: (data ?? []) as IntakeKey[] }
}

// Generates a secret, stores only its hash, and returns the secret once.
export async function createIntakeKey(subAccountId: string, label: string) {
  const { orgId, orgRole, userId, supabase } = await getUserContext()
  if (!isAdmin(orgRole)) return { error: "Only admins can create intake keys" }
  const trimmed = label.trim()
  if (!trimmed) return { error: "Give the key a label (e.g. the website it is for)" }

  const secret = "fk_" + randomBytes(24).toString("base64url")
  const hash = createHash("sha256").update(secret).digest("hex")

  const { data, error } = await supabase
    .from("intake_keys")
    .insert({
      org_id: orgId,
      sub_account_id: subAccountId,
      label: trimmed,
      key_hash: hash,
      key_prefix: secret.slice(0, 8),
      created_by: userId,
    })
    .select("id")
    .single()
  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { data: { id: data.id, secret } }
}

export async function revokeIntakeKey(id: string) {
  const { orgRole, supabase } = await getUserContext()
  if (!isAdmin(orgRole)) return { error: "Only admins can revoke intake keys" }
  const { error } = await supabase
    .from("intake_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { success: true }
}

// Merges settings.intake.notify_email without clobbering other settings.
export async function updateIntakeNotifyEmail(subAccountId: string, email: string) {
  const { orgId, orgRole, supabase } = await getUserContext()
  if (!isAdmin(orgRole)) return { error: "Only admins can change intake settings" }
  const value = email.trim()
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: "Enter a valid email address" }

  const { data: row, error: readError } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("id", subAccountId)
    .eq("org_id", orgId)
    .single()
  if (readError) return { error: readError.message }

  const settings = (row?.settings ?? {}) as Record<string, unknown>
  const intake = (settings.intake ?? {}) as Record<string, unknown>
  const { error } = await supabase
    .from("sub_accounts")
    .update({ settings: { ...settings, intake: { ...intake, notify_email: value || null } } })
    .eq("id", subAccountId)
    .eq("org_id", orgId)
  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}
