"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, SearchIcon, ArrowRightIcon } from "lucide-react"
import { createSubAccount } from "@/features/settings/actions"
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency"
import { TIMEZONES } from "@/lib/constants/colors"
import type { SubAccount } from "@/types/database"

interface SubAccountsTableProps {
  subAccounts: (SubAccount & { accent_color?: string })[]
}

export function SubAccountsTable({ subAccounts }: SubAccountsTableProps) {
  const router = useRouter()
  const [filter, setFilter] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newCurrency, setNewCurrency] = React.useState("USD")
  const [newTimezone, setNewTimezone] = React.useState("America/New_York")
  const [creating, setCreating] = React.useState(false)

  const filtered = subAccounts.filter((sa) =>
    sa.name.toLowerCase().includes(filter.toLowerCase())
  )

  function handleOpen(subAccountId: string) {
    document.cookie = `flowcrm_sub_account_id=${subAccountId};path=/;max-age=${60 * 60 * 24 * 365}`
    router.push("/dashboard")
    router.refresh()
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Sub-account name is required")
      return
    }
    setCreating(true)
    const result = await createSubAccount({
      name: newName.trim(),
      currency: newCurrency,
      timezone: newTimezone,
    })
    setCreating(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Sub-account created")
      setNewName("")
      setNewCurrency("USD")
      setNewTimezone("America/New_York")
      setDialogOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sub-accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            One workspace per client. Each sub-account has its own contacts,
            pipeline, and team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-[180px] pl-8"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <PlusIcon className="size-4" />
                  New
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create sub-account</DialogTitle>
                <DialogDescription>
                  Each sub-account gets its own contacts, pipeline, and team.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sa-name">Name</Label>
                  <Input
                    id="sa-name"
                    placeholder="e.g. Acme Corp"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={newCurrency}
                    onValueChange={(v) => v && setNewCurrency(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Timezone</Label>
                  <Select
                    value={newTimezone}
                    onValueChange={(v) => v && setNewTimezone(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">
            {subAccounts.length === 0
              ? "No sub-accounts yet. Create one to get started."
              : "No sub-accounts match your filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sa, index) => (
                <TableRow key={sa.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{sa.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">active</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sa.timezone.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpen(sa.id)}
                    >
                      Open
                      <ArrowRightIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
