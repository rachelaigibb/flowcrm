"use client"

import { useState } from "react"
import { ChevronsUpDown, Check, Building2Icon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import type { SubAccount } from "@/types/database"

interface SubAccountSwitcherProps {
  subAccounts: SubAccount[]
  currentSubAccountId: string | null
}

export function SubAccountSwitcher({
  subAccounts,
  currentSubAccountId,
}: SubAccountSwitcherProps) {
  const [open, setOpen] = useState(false)

  const currentSubAccount = subAccounts.find(
    (sa) => sa.id === currentSubAccountId
  )

  function handleSelect(subAccountId: string) {
    document.cookie = `flowcrm_sub_account_id=${subAccountId}; path=/; max-age=${60 * 60 * 24 * 365}`
    setOpen(false)
    window.location.reload()
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
          />
        }
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2Icon className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">
            {currentSubAccount?.name ?? "Select account"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {currentSubAccount?.currency ?? ""}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--anchor-width] min-w-56"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel>Sub-accounts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {subAccounts.map((sa) => (
          <DropdownMenuItem
            key={sa.id}
            onClick={() => handleSelect(sa.id)}
          >
            <Building2Icon className="size-4" />
            <span className="flex-1 truncate">{sa.name}</span>
            {sa.id === currentSubAccountId && (
              <Check className="size-4 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
        {subAccounts.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No sub-accounts found
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
