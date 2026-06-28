import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { ContactsPage } from "@/features/contacts/components/contacts-page"
import type { Contact } from "@/types/database"

export default async function ContactsRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()
  if (!subAccountId) redirect("/settings")

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
