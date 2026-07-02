"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { createClient } from "@/lib/supabase/server"
import { getResendClient } from "@/lib/resend/client"
import type { OrgRole, SubAccountRole } from "@/types/database"

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// ── Get invitations for current org ──

export async function getInvitations() {
  const { orgId, supabase } = await getUserContext()

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ── Send invitation ──

export async function sendInvitation(input: {
  email: string
  role: OrgRole
  subAccountIds: string[]
  subAccountRole: SubAccountRole
}) {
  const { userId, orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only owners and admins can send invitations" }
  }

  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return { error: "Invalid email address" }
  }

  // Check if there's already a pending invitation for this email
  const { data: existing } = await supabase
    .from("invitations")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .eq("status", "pending")
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: "An invitation is already pending for this email" }
  }

  // Check if user is already a member
  const { data: members } = await supabase
    .from("memberships")
    .select("id, user_id")
    .eq("org_id", orgId)

  // Look up if any user with this email exists
  // We can't query auth.users directly, but we can check if any existing member has this email
  // For now, we just create the invitation

  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 day expiry

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      org_id: orgId,
      email,
      role: input.role === "owner" ? "admin" : input.role, // Can't invite as owner
      sub_account_ids: input.subAccountIds,
      sub_account_role: input.subAccountRole,
      token,
      status: "pending",
      invited_by: userId,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Get org name for the email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single()

  const orgName = org?.name ?? "FlowCRM"

  // Get email settings for sending
  // Use the first sub-account's email settings, or fall back
  const { data: subAccounts } = await supabase
    .from("sub_accounts")
    .select("settings")
    .eq("org_id", orgId)
    .limit(1)

  const emailSettings = (subAccounts?.[0]?.settings as Record<string, unknown>)?.email as
    | { from_name?: string; from_email?: string }
    | undefined

  const fromEmail = emailSettings?.from_email
  const fromName = emailSettings?.from_name || orgName

  // Build invite URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000"
  const inviteUrl = `${baseUrl}/invite/${token}`

  // Send invitation email via Resend (if configured)
  if (fromEmail) {
    try {
      const resend = getResendClient()
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: `You're invited to join ${orgName} on FlowCRM`,
        text: `Hi,\n\nYou've been invited to join ${orgName} on FlowCRM as a ${input.role}.\n\nClick the link below to accept your invitation:\n${inviteUrl}\n\nThis invitation expires in 7 days.\n\nBest,\n${fromName}`,
      })
    } catch {
      // Email sending failed but invitation was created — user can still share the link
    }
  }

  revalidatePath("/agency/settings")
  return { data: invitation, inviteUrl }
}

// ── Revoke invitation ──

export async function revokeInvitation(id: string) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only owners and admins can revoke invitations" }
  }

  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("status", "pending")

  if (error) return { error: error.message }

  revalidatePath("/agency/settings")
  return { success: true }
}

// ── Accept invitation (called from the invite page) ──

export async function acceptInvitation(token: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "You must be logged in to accept an invitation", requiresAuth: true }
  }

  // Call the SECURITY DEFINER function
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_user_id: user.id,
  })

  if (error) return { error: error.message }

  const result = data as { success?: boolean; error?: string; org_id?: string }

  if (result.error) return { error: result.error }

  return { success: true, orgId: result.org_id }
}

// ── Remove member from org ──

export async function removeMember(membershipId: string) {
  const { orgId, orgRole, userId, supabase } = await getUserContext()

  if (orgRole !== "owner" && orgRole !== "admin") {
    return { error: "Only owners and admins can remove members" }
  }

  // Get the membership to check it's in our org and not the owner
  const { data: membership } = await supabase
    .from("memberships")
    .select("*")
    .eq("id", membershipId)
    .eq("org_id", orgId)
    .single()

  if (!membership) return { error: "Membership not found" }
  if (membership.role === "owner") return { error: "Cannot remove the organization owner" }
  if (membership.user_id === userId) return { error: "Cannot remove yourself" }

  // Delete sub-account memberships first
  await supabase
    .from("sub_account_memberships")
    .delete()
    .eq("user_id", membership.user_id)

  // Delete org membership
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)

  if (error) return { error: error.message }

  revalidatePath("/agency/settings")
  return { success: true }
}

// ── Update member role ──

export async function updateMemberRole(membershipId: string, role: OrgRole) {
  const { orgId, orgRole, supabase } = await getUserContext()

  if (orgRole !== "owner") {
    return { error: "Only the owner can change member roles" }
  }

  if (role === "owner") {
    return { error: "Cannot assign owner role" }
  }

  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("org_id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/agency/settings")
  return { success: true }
}
