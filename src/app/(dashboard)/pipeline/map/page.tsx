import { getUserContext } from "@/lib/supabase/get-user-context"
import { DealMapPage } from "@/features/pipeline/components/deal-map-page"
import type { PipelineStage } from "@/types/database"

interface DealWithCoordinates {
  id: string
  title: string
  value: number
  currency: string
  latitude: number
  longitude: number
  stage: { id: string; name: string; color: string } | null
  contact: { id: string; first_name: string | null; last_name: string | null } | null
}

export default async function DealMapRoute() {
  const { orgId, subAccountId, supabase } = await getUserContext()

  const { data: deals } = await supabase
    .from("deals")
    .select(
      "*, stage:pipeline_stages(id, name, color), contact:contacts(id, first_name, last_name)"
    )
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .order("position")

  const typedDeals = (deals as DealWithCoordinates[] | null) ?? []
  const typedStages = (stages as PipelineStage[] | null) ?? []

  return <DealMapPage deals={typedDeals} stages={typedStages} />
}
