import { getUserContext } from "@/lib/supabase/get-user-context"
import { redirect } from "next/navigation"
import { BroadcastsPage } from "@/features/broadcasts/components/broadcasts-page"
import type { Broadcast } from "@/types/database"

export default async function BroadcastsRoute() {
  let ctx: Awaited<ReturnType<typeof getUserContext>>
  try {
    ctx = await getUserContext()
  } catch {
    redirect("/login")
  }

  const { orgId, subAccountId, supabase } = ctx

  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Failed to load broadcasts. Please try again.
        </p>
      </div>
    )
  }

  const typedBroadcasts = (broadcasts ?? []) as Broadcast[]

  return <BroadcastsPage broadcasts={typedBroadcasts} />
}
