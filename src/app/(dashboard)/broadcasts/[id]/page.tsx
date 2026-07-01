import { getUserContext } from "@/lib/supabase/get-user-context"
import { redirect, notFound } from "next/navigation"
import { BroadcastEditorPage } from "@/features/broadcasts/components/broadcast-editor-page"
import type { Broadcast, EmailTemplate, SmsTemplate } from "@/types/database"

export default async function BroadcastDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let ctx: Awaited<ReturnType<typeof getUserContext>>
  try {
    ctx = await getUserContext()
  } catch {
    redirect("/login")
  }

  const { orgId, subAccountId, supabase } = ctx

  // Fetch broadcast + templates + contacts data in parallel
  const [
    { data: broadcast, error: broadcastError },
    { data: emailTemplates },
    { data: smsTemplates },
    { data: contactTagRows },
    { data: contactSourceRows },
  ] = await Promise.all([
    supabase
      .from("broadcasts")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId)
      .single(),
    supabase
      .from("email_templates")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("name"),
    supabase
      .from("sms_templates")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("name"),
    supabase
      .from("contacts")
      .select("tags")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("contacts")
      .select("source")
      .eq("sub_account_id", subAccountId)
      .not("source", "is", null),
  ])

  if (broadcastError || !broadcast) {
    notFound()
  }

  // Extract unique tags from contact tag arrays
  const tagSet = new Set<string>()
  if (contactTagRows) {
    for (const row of contactTagRows) {
      const tags = row.tags as string[] | null
      if (tags) {
        for (const tag of tags) {
          tagSet.add(tag)
        }
      }
    }
  }
  const availableTags = Array.from(tagSet).sort()

  // Extract unique sources
  const sourceSet = new Set<string>()
  if (contactSourceRows) {
    for (const row of contactSourceRows) {
      if (row.source) {
        sourceSet.add(row.source as string)
      }
    }
  }
  const availableSources = Array.from(sourceSet).sort()

  return (
    <BroadcastEditorPage
      broadcast={broadcast as Broadcast}
      emailTemplates={(emailTemplates ?? []) as EmailTemplate[]}
      smsTemplates={(smsTemplates ?? []) as SmsTemplate[]}
      availableTags={availableTags}
      availableSources={availableSources}
    />
  )
}
