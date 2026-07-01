import { createClient } from "@/lib/supabase/server"
import { PublicFormView } from "@/features/forms/components/public-form-view"
import type { Form } from "@/types/database"

export default async function PublicFormRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: form, error } = await supabase
    .from("forms")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .limit(1)
    .single()

  if (error || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Form not found
          </h1>
          <p className="mt-2 text-gray-500">
            This form may have been unpublished or the link is incorrect.
          </p>
        </div>
      </div>
    )
  }

  const typedForm = form as unknown as Form

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <PublicFormView form={typedForm} />
    </div>
  )
}
