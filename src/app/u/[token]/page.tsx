import { createAnonClient } from "@/lib/supabase/anon"
import { UnsubscribeForm } from "@/features/broadcasts/components/unsubscribe-form"

// Public unsubscribe page linked from every broadcast and automation email.
// GET shows who is asking and a single button; the button calls the
// unsubscribe action. Mail clients' one-click POST goes to /api/unsubscribe.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Lookup {
  first_name: string | null
  email: string | null
  consent_status: string
  from_name: string | null
  sub_account_name: string | null
}

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (token === "preview") {
    return (
      <Shell title="Test link">
        <p className="text-gray-600">
          This is the unsubscribe link as it appears in a test send. Real emails carry a link that is unique to each recipient.
        </p>
      </Shell>
    )
  }

  let info: Lookup | null = null
  if (UUID_RE.test(token)) {
    const supabase = createAnonClient()
    const { data } = await supabase.rpc("unsubscribe_lookup", { p_token: token })
    info = (data as Lookup | null) ?? null
  }

  if (!info || !info.email) {
    return (
      <Shell title="Link not recognised">
        <p className="text-gray-600">This unsubscribe link is not valid. If you copied it from an email, open the email and click the link directly.</p>
      </Shell>
    )
  }

  const sender = info.from_name || info.sub_account_name || "this sender"

  if (info.consent_status === "withdrawn") {
    return (
      <Shell title="You are unsubscribed">
        <p className="text-gray-600">
          {info.email} will not receive further marketing email from {sender}.
        </p>
      </Shell>
    )
  }

  return (
    <Shell title="Unsubscribe">
      <p className="text-gray-600">
        Stop marketing email from <span className="font-medium text-gray-900">{sender}</span> to{" "}
        <span className="font-medium text-gray-900">{info.email}</span>?
      </p>
      <UnsubscribeForm token={token} />
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <div className="mt-3 space-y-4 text-sm">{children}</div>
      </div>
    </div>
  )
}
