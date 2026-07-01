"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Settings,
  LogOut,
  Building2,
  ChevronsUpDown,
  CalendarDays,
  FileText,
  Globe,
  Zap,
  Megaphone,
  BarChart3,
  Home,
  List,
  Lock,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { SubAccountSwitcher } from "@/components/shared/sub-account-switcher"
import { signOut } from "@/features/auth/actions"
import type { Organization, SubAccount } from "@/types/database"

const agencyNavItems = [
  { title: "Agency Home", href: "/agency", icon: Home },
  { title: "Sub-accounts", href: "/agency/sub-accounts", icon: List },
  { title: "Settings Agency", href: "/agency/settings", icon: Settings },
]

const subAccountNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Pipeline", href: "/pipeline", icon: Kanban },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Forms", href: "/forms", icon: FileText },
  { title: "Automations", href: "/automations", icon: Zap },
  { title: "Broadcasts", href: "/broadcasts", icon: Megaphone },
]

const comingSoonItems = [
  { title: "Website", icon: Globe },
  { title: "Reports", icon: BarChart3 },
]

interface AppSidebarProps {
  org: Organization
  subAccounts: SubAccount[]
  currentSubAccountId: string | null
  userEmail: string
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function AppSidebar({
  org,
  subAccounts,
  currentSubAccountId,
  userEmail,
}: AppSidebarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const orgInitials = getInitials(org.name || "O")
  const currentSubAccount = subAccounts.find(
    (sa) => sa.id === currentSubAccountId
  )

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
              <Building2 className="size-5 text-primary" />
              <span className="text-sm font-bold tracking-tight">FlowCRM</span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {/* AGENCY section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Agency
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agencyNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/agency" && pathname.startsWith(item.href))

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* SUB-ACCOUNT section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Sub-Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SubAccountSwitcher
                  subAccounts={subAccounts}
                  currentSubAccountId={currentSubAccountId}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {subAccountNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Coming Soon items */}
              {comingSoonItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton disabled className="opacity-40 cursor-not-allowed">
                    <item.icon />
                    <span className="flex-1">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Settings Sub-Account */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/settings"}
                  render={<Link href="/settings" />}
                >
                  <Settings />
                  <span>Settings Sub-Account</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent transition-colors"
              >
                {org.logo_url ? (
                  <Image
                    src={org.logo_url}
                    alt={org.name}
                    width={32}
                    height={32}
                    className="size-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                    {orgInitials}
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{org.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <ChevronsUpDown className="size-4 text-muted-foreground" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-md border bg-popover p-1 shadow-md">
                    <Link
                      href="/agency/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                    >
                      <Building2 className="size-4" />
                      Organization
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false)
                        await signOut()
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
