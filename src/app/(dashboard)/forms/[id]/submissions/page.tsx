import { getUserContext } from "@/lib/supabase/get-user-context"
import { notFound } from "next/navigation"
import { FormSubmissionsPage } from "@/features/forms/components/form-submissions-page"
import type { Form, FormSubmission } from "@/types/database"

interface SubmissionWithContact extends FormSubmission {
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

export default async function FormSubmissionsRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { orgId, subAccountId, supabase } = await getUserContext()

  const [{ data: form, error: formError }, { data: submissions, error: submissionsError }] =
    await Promise.all([
      supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .single(),
      supabase
        .from("form_submissions")
        .select("*, contact:contacts(id, first_name, last_name, email)")
        .eq("form_id", id)
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .order("created_at", { ascending: false }),
    ])

  if (formError || !form) {
    notFound()
  }

  const typedForm = form as unknown as Form
  const typedSubmissions = (submissions ?? []) as unknown as SubmissionWithContact[]

  return (
    <FormSubmissionsPage
      form={typedForm}
      submissions={typedSubmissions}
    />
  )
}
