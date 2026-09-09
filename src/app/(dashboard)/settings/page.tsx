import { reconcileTagDefinitions } from "@/features/settings/actions"
import { listIntakeKeys } from "@/features/intake/actions"
import { IntakeCard } from "@/features/intake/components/intake-card"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getSubAccountId } from "@/lib/supabase/get-sub-account"
import { SubAccountSettingsPage } from "@/features/settings/components/sub-account-settings-page"
import type { SubAccount, PipelineStage, SubAccountMembership } from "@/types/database"

export const metadata = {
  title: "Settings Sub-Account | FlowCRM",
}

export default async function SettingsRoute() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const subAccountId = await getSubAccountId()

  if (!subAccountId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          No sub-account selected. Create one in Agency Home to get started.
        </p>
      </div>
    )
  }

  const [subAccountResult, stagesResult, membersResult] = await Promise.all([
    supabase.from("sub_accounts").select("*").eq("id", subAccountId).single(),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    supabase
      .from("sub_account_memberships")
      .select("*")
      .eq("sub_account_id", subAccountId),
  ])

  if (!subAccountResult.data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Sub-account not found.
        </p>
      </div>
    )
  }

  const enrichedMembers = (membersResult.data ?? []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email ?? undefined : undefined,
  })) as (SubAccountMembership & { email?: string })[]

  const subAccountData = subAccountResult.data as SubAccount & { settings?: Record<string, unknown> }
  // Union of configured tags and tags actually present on contacts (see reconcileTagDefinitions)
  const tags = (await reconcileTagDefinitions()).data ?? []

  const intakeKeys = (await listIntakeKeys(subAccountId)).data ?? []
  const intakeSettings = (subAccountData.settings?.intake ?? {}) as { notify_email?: string | null }
  const headerList = await headers()
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host") ?? "crm.getflowplan.app"}`

  return (
    <SubAccountSettingsPage
      subAccount={subAccountResult.data as SubAccount}
      stages={(stagesResult.data ?? []) as PipelineStage[]}
      members={enrichedMembers}
      tags={tags}
      intakeCard={
        <IntakeCard
          subAccountId={subAccountId}
          keys={intakeKeys}
          notifyEmail={intakeSettings.notify_email ?? ""}
          endpointUrl={`${origin.replace(/\/$/, "")}/api/intake`}
        />
      }
    />
  )
}
