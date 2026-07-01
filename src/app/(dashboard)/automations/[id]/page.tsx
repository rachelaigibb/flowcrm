import { getUserContext } from "@/lib/supabase/get-user-context"
import { notFound } from "next/navigation"
import { AutomationBuilderPage } from "@/features/automations/components/automation-builder-page"
import type {
  Automation,
  AutomationStep,
  AutomationRun,
  EmailTemplate,
  SmsTemplate,
  Form,
  PipelineStage,
  Contact,
} from "@/types/database"

export default async function AutomationEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Fetch all data in parallel
  const [
    { data: automation, error: automationError },
    { data: steps, error: stepsError },
    { data: runs },
    { data: emailTemplates },
    { data: smsTemplates },
    { data: forms },
    { data: stages },
  ] = await Promise.all([
    supabase
      .from("automations")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId)
      .single(),
    supabase
      .from("automation_steps")
      .select("*")
      .eq("automation_id", id)
      .order("position"),
    supabase
      .from("automation_runs")
      .select("*, contact:contacts(id, first_name, last_name, email)")
      .eq("automation_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_templates")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId),
    supabase
      .from("sms_templates")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId),
    supabase
      .from("forms")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId),
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId),
  ])

  if (automationError || !automation) {
    notFound()
  }

  return (
    <AutomationBuilderPage
      automation={automation as Automation}
      steps={(steps ?? []) as AutomationStep[]}
      runs={
        (runs ?? []) as (AutomationRun & {
          contact: Pick<Contact, "id" | "first_name" | "last_name" | "email"> | null
        })[]
      }
      emailTemplates={(emailTemplates ?? []) as Pick<EmailTemplate, "id" | "name">[]}
      smsTemplates={(smsTemplates ?? []) as Pick<SmsTemplate, "id" | "name">[]}
      forms={(forms ?? []) as Pick<Form, "id" | "name">[]}
      stages={(stages ?? []) as Pick<PipelineStage, "id" | "name">[]}
    />
  )
}
