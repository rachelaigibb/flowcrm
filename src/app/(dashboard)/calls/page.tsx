import { getCallQueue } from "@/features/contacts/actions"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { CallsPage } from "@/features/calls/components/calls-page"

export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams
  const selectedTag = tag === "all" ? null : (tag ?? "past-client")

  const { subAccountId, supabase } = await getUserContext()
  const { data: subAccount } = await supabase.from("sub_accounts").select("settings").eq("id", subAccountId).single()
  const tagDefs = (((subAccount?.settings as Record<string, unknown>)?.tags as { name: string }[]) ?? []).map((t) => t.name)

  const result = await getCallQueue(selectedTag, 10)

  return <CallsPage contacts={result.data ?? []} selectedTag={selectedTag} tagOptions={tagDefs} error={result.error} />
}
