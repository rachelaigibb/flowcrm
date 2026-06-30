import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { CommandPalette } from "@/components/shared/command-palette"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import type { Organization, SubAccount, Membership } from "@/types/database"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch user's org membership
  const { data: memberships } = await supabase
    .from("memberships")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)

  const membership = memberships?.[0] as Membership | undefined

  if (!membership) {
    await supabase.auth.signOut()
    redirect("/login")
  }

  // Fetch the org
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .single()

  if (!org) {
    await supabase.auth.signOut()
    redirect("/login")
  }

  // Fetch sub-accounts for this org
  const { data: subAccounts } = await supabase
    .from("sub_accounts")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("name")

  const typedSubAccounts = (subAccounts ?? []) as SubAccount[]

  // Determine current sub-account from cookie
  const cookieStore = await cookies()
  const subAccountCookie = cookieStore.get("flowcrm_sub_account_id")
  let currentSubAccountId = subAccountCookie?.value ?? null

  // Validate the cookie value belongs to this org's sub-accounts
  if (
    currentSubAccountId &&
    !typedSubAccounts.some((sa) => sa.id === currentSubAccountId)
  ) {
    currentSubAccountId = null
  }

  // Fallback to first sub-account
  if (!currentSubAccountId && typedSubAccounts.length > 0) {
    currentSubAccountId = typedSubAccounts[0].id
  }

  return (
    <SidebarProvider>
      <AppSidebar
        org={org as Organization}
        subAccounts={typedSubAccounts}
        currentSubAccountId={currentSubAccountId}
        userEmail={user.email ?? ""}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {(() => {
            const currentSa = typedSubAccounts.find((sa) => sa.id === currentSubAccountId) as (SubAccount & { accent_color?: string }) | undefined
            const accentColor = currentSa?.accent_color ?? "#6366f1"
            return (
              <>
                <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
                <span className="text-sm font-medium text-muted-foreground">
                  {currentSa?.name ?? (org as Organization).name}
                </span>
              </>
            )
          })()}
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col overflow-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}
