import { createClient } from "@/lib/supabase/server"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { PipelinePage } from "@/features/pipeline/components/pipeline-page"
import type { DealWithContact } from "@/features/pipeline/types"
import type { PipelineStage, DealStatus } from "@/types/database"
import { parseDateRange } from "@/lib/utils/date-range"

export default async function PipelineRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const subAccountId = await getSubAccountId()

  if (!subAccountId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No sub-account selected.</p>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("position", { ascending: true })

  const { data: deals } = await supabase
    .from("deals")
    .select("*, contact:contacts!deals_contact_id_fkey(*)")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  return (
    <PipelinePage
      stages={(stages as PipelineStage[]) ?? []}
      deals={(deals as DealWithContact[]) ?? []}
      initialView={sp.view === "list" ? "list" : "kanban"}
      initialStatus={["open", "won", "lost"].includes(sp.status ?? "") ? (sp.status as DealStatus) : "all"}
      initialRange={parseDateRange(sp.range, "all")}
    />
  )
}
