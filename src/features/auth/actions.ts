"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function login(formData: FormData) {
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
  redirect("/")
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: "Signup failed. Please try again." }
  }

  // Create the org with defaults via RPC
  const { error: orgError } = await supabase.rpc("create_org_with_defaults", {
    owner_id: data.user.id,
    org_name: email.split("@")[0] + "'s Org",
  })

  if (orgError) {
    return { error: "Account created but org setup failed: " + orgError.message }
  }

  revalidatePath("/", "layout")
  redirect("/")
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string

  if (!email) {
    return { error: "Email is required." }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: "Check your email for the magic link." }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
