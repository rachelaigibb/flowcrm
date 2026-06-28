import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { ContactDetailPage } from "@/features/contacts/components/contact-detail-page"
import type { ContactWithRelations } from "@/features/contacts/types"

export default async function ContactDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Fetch contact
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("sub_account_id", subAccountId)
    .single()

  if (contactError || !contact) {
    notFound()
  }

  // Fetch activities
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })

  // Fetch deals
  const { data: deals } = await supabase
    .from("deals")
    .select("*, stage:pipeline_stages(*)")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })

  // Fetch tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })

  const contactWithRelations: ContactWithRelations = {
    ...contact,
    activities: activities ?? [],
    deals: deals ?? [],
    tasks: tasks ?? [],
  }

  return <ContactDetailPage contact={contactWithRelations} />
}
