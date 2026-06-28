import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { PipelinePage } from "@/features/pipeline/components/pipeline-page"
import type { DealWithContact } from "@/features/pipeline/types"
import type { PipelineStage } from "@/types/database"

export default async function PipelineRoute() {
  const cookieStore = await cookies()
  const subAccountId = cookieStore.get("flowcrm_sub_account_id")?.value

  if (!subAccountId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No sub account selected.</p>
      </div>
    )
  }

  const supabase = await createClient()

  // Fetch pipeline stages ordered by position
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("position", { ascending: true })

  // Fetch deals with contact join
  const { data: deals } = await supabase
    .from("deals")
    .select("*, contact:contacts(*)")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })

  return (
    <PipelinePage
      stages={(stages as PipelineStage[]) ?? []}
      deals={(deals as DealWithContact[]) ?? []}
    />
  )
}
