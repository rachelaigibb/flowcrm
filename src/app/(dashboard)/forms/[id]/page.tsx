import { getUserContext } from "@/lib/supabase/get-user-context"
import { notFound } from "next/navigation"
import { FormBuilderPage } from "@/features/forms/components/form-builder-page"
import type { Form } from "@/types/database"

export default async function FormEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { orgId, subAccountId, supabase } = await getUserContext()

  // Fetch form + submission count in parallel
  const [{ data: form, error: formError }, { count }] = await Promise.all([
    supabase
      .from("forms")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("sub_account_id", subAccountId)
      .single(),
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form_id", id),
  ])

  if (formError || !form) {
    notFound()
  }

  const typedForm = form as Form

  return (
    <FormBuilderPage form={typedForm} submissionCount={count ?? 0} />
  )
}
