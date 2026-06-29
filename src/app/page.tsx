import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // User is authenticated — the (dashboard)/page.tsx will render via the layout
  // But since this root page.tsx takes priority over the route group,
  // we redirect to a named dashboard route
  redirect("/dashboard")
}
