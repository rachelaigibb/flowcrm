import { createClient } from "@/lib/supabase/server"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const subAccountId = await getSubAccountId()
  if (!subAccountId) {
    redirect("/settings")
  }

  // Fetch contact + sub-account settings in parallel
  const [
    { data: contact, error: contactError },
    { data: subAccount },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("sub_account_id", subAccountId)
      .single(),
    supabase
      .from("sub_accounts")
      .select("settings")
      .eq("id", subAccountId)
      .single(),
  ])

  if (contactError || !contact) {
    notFound()
  }

  // Fetch related data in parallel
  const [{ data: activities }, { data: deals }, { data: tasks }, { data: stages }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("sub_account_id", subAccountId)
        .order("position"),
    ])

  const contactWithRelations: ContactWithRelations = {
    ...contact,
    activities: activities ?? [],
    deals: deals ?? [],
    tasks: tasks ?? [],
  }

  const tagColors = ((subAccount?.settings as Record<string, unknown>)?.tags as Array<{ id: string; name: string; color: string }>) ?? []
  const currency = (subAccount as { currency?: string } | null)?.currency ?? "USD"

  return (
    <ContactDetailPage
      contact={contactWithRelations}
      tagColors={tagColors}
      stages={(stages ?? []) as import("@/types/database").PipelineStage[]}
      defaultCurrency={currency}
    />
  )
}
