"use client"

import { useState } from "react"
import { ChevronsUpDown, Check, Building2Icon } from "lucide-react"
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

  const getAccentColor = (sa: SubAccount) =>
    (sa as SubAccount & { accent_color?: string }).accent_color ?? "#6366f1"

  function handleSelect(subAccountId: string) {
    document.cookie = `flowcrm_sub_account_id=${subAccountId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    setOpen(false)
    window.location.href = window.location.pathname
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent transition-colors"
      >
        <div
          className="flex aspect-square size-8 items-center justify-center rounded-lg text-white text-xs font-semibold"
          style={{ backgroundColor: currentSubAccount ? getAccentColor(currentSubAccount) : "#6366f1" }}
        >
          {(currentSubAccount?.name ?? "?")[0].toUpperCase()}
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">
            {currentSubAccount?.name ?? "Select account"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {currentSubAccount?.currency ?? ""}
          </span>
        </div>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Sub-accounts
            </p>
            {subAccounts.map((sa) => (
              <button
                key={sa.id}
                type="button"
                onClick={() => handleSelect(sa.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <div
                  className="size-4 rounded-full shrink-0"
                  style={{ backgroundColor: getAccentColor(sa) }}
                />
                <span className="flex-1 truncate text-left">{sa.name}</span>
                {sa.id === currentSubAccountId && (
                  <Check className="size-4 text-muted-foreground" />
                )}
              </button>
            ))}
            {subAccounts.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No sub-accounts found
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
