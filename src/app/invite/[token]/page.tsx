import { createClient } from "@/lib/supabase/server"
import { FlowCRMMark } from "@/components/shared/flowcrm-mark"
import { InviteAcceptPage } from "@/features/invitations/components/invite-accept-page"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.rpc("get_invitation_preview", { p_token: token })
  const invitation = data as { email?: string; org_name?: string; error?: string } | null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <FlowCRMMark />
            <span className="text-xl font-semibold tracking-tight">
              FlowCRM
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-first CRM and business operating system
          </p>
        </div>
        <InviteAcceptPage token={token} currentEmail={user?.email} invitation={invitation} />
      </div>
    </div>
  )
}
