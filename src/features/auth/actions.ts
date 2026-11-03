"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { safeRedirect, authSiteUrl } from "@/lib/auth/redirect"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function login(formData: FormData, redirectTo?: string) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect(safeRedirect(redirectTo))
}

export async function signup(formData: FormData, redirectTo?: string) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }

  const next = safeRedirect(redirectTo)
  const isInvite = /^\/invite\/[A-Za-z0-9]+$/.test(next)
  if (isInvite) {
    const { data: preview } = await supabase.rpc("get_invitation_preview", { p_token: next.split("/")[2] })
    const invitation = preview as { email?: string } | null
    if (!invitation?.email || invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
      return { error: "Use the invited email address and a valid, pending invitation." }
    }
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${authSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: "Signup failed. Please try again." }
  }

  if (!data.session) {
    return { success: "Check your email to confirm your account, then return to your invitation. If you already have an account, sign in or reset your password instead." }
  }
  if (isInvite) {
    revalidatePath("/", "layout")
    redirect(next)
  }

  // Create the org with defaults via RPC
  const { error: orgError } = await supabase.rpc("create_org_with_defaults", {
    p_user_id: data.user.id,
    p_org_name: email.split("@")[0] + "'s Org",
  })

  if (orgError) {
    return { error: "Account created but org setup failed: " + orgError.message }
  }

  revalidatePath("/", "layout")
  redirect("/")
}

export async function signInWithMagicLink(formData: FormData, redirectTo?: string) {
  const supabase = await createClient()

  const email = formData.get("email") as string

  if (!email) {
    return { error: "Email is required." }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${authSiteUrl()}/auth/confirm?next=${encodeURIComponent(safeRedirect(redirectTo))}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: "Check your email for the magic link." }
}

export async function requestPasswordReset(formData: FormData, redirectTo?: string) {
  const supabase = await createClient()

  const email = formData.get("email") as string

  if (!email) {
    return { error: "Email is required." }
  }

  const siteUrl = authSiteUrl()
  const resetPath = `/reset-password?redirect=${encodeURIComponent(safeRedirect(redirectTo))}`
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(resetPath)}`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: "If that email exists, a password reset link is on its way." }
}

export async function updatePassword(formData: FormData, redirectTo?: string) {
  const supabase = await createClient()

  const password = formData.get("password") as string

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }

  // Requires an active session — set by the recovery link via /auth/confirm.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Your reset link has expired. Please request a new one." }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect(safeRedirect(redirectTo))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

export async function switchInvitationAccount(token: string) {
  if (!/^[A-Za-z0-9]+$/.test(token)) return { error: "Invalid invitation" }
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: "local" })
  if (error) return { error: error.message }
  ;(await cookies()).delete("flowcrm_sub_account_id")
  revalidatePath("/", "layout")
  redirect(`/invite/${token}`)
}
