import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ContactsPage } from "@/features/contacts/components/contacts-page"
import type { Contact } from "@/types/database"

export default async function ContactsRoute() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value
  if (!subAccountId) {
    redirect("/settings")
  }

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load contacts. Please try again.
        </p>
      </div>
    )
  }

  return <ContactsPage contacts={(contacts ?? []) as Contact[]} />
}
