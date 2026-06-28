"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  BuildingIcon,
  PlusIcon,
  UsersIcon,
  DollarSignIcon,
  ClockIcon,
  ImageIcon,
} from "lucide-react"
import { updateOrganization, createSubAccount } from "../actions"
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency"
import type { Organization, SubAccount, Membership } from "@/types/database"

const TIMEZONES = [
  "America/Vancouver",
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
]

interface SettingsPageProps {
  org: Organization
  subAccounts: SubAccount[]
  members: (Membership & { email?: string })[]
}

function OrgSettings({
  org,
  members,
}: {
  org: Organization
  members: (Membership & { email?: string })[]
}) {
  const [name, setName] = React.useState(org.name)
  const [saving, setSaving] = React.useState(false)
  const [inviteOpen, setInviteOpen] = React.useState(false)

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Organization name is required")
      return
    }
    setSaving(true)
    const result = await updateOrganization({ name: name.trim() })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Organization updated")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Manage your organization name and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt="Org logo"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Logo upload coming soon
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4" />
              Members
            </CardTitle>
            <CardDescription>
              People with access to this organization
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <PlusIcon className="size-4" />
                  Invite Member
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Member</DialogTitle>
                <DialogDescription>
                  Team invitations are coming soon. For now, members can be
                  added directly through Supabase.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {(member.email ?? "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.email ?? "Unknown user"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.user_id}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">No members found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SubAccountsTab({ subAccounts }: { subAccounts: SubAccount[] }) {
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newCurrency, setNewCurrency] = React.useState("CAD")
  const [newTimezone, setNewTimezone] = React.useState("America/Vancouver")

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Name is required")
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
      setNewCurrency("CAD")
      setNewTimezone("America/Vancouver")
      setCreateOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sub-accounts are isolated workspaces within your organization
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <PlusIcon className="size-4" />
                Create Sub-account
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sub-account</DialogTitle>
              <DialogDescription>
                Create a new workspace with its own contacts, deals, and pipeline
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sa-name">Name</Label>
                <Input
                  id="sa-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dubai Office"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <Select value={newCurrency} onValueChange={(v) => v && setNewCurrency(v)}>
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
                <Select value={newTimezone} onValueChange={(v) => v && setNewTimezone(v)}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {subAccounts.map((sa) => (
          <Link
            key={sa.id}
            href={`/settings/sub-accounts/${sa.id}`}
            className="block"
          >
            <Card className="transition-colors hover:border-foreground/20 cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BuildingIcon className="size-4 text-muted-foreground" />
                  {sa.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSignIcon className="size-3" />
                    {sa.currency}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {sa.timezone.replace(/_/g, " ")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {subAccounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BuildingIcon className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No sub-accounts yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create your first sub-account to get started
          </p>
        </div>
      )}
    </div>
  )
}

export function SettingsPage({ org, subAccounts, members }: SettingsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization and sub-accounts
        </p>
      </div>

      <Tabs defaultValue="organization">
        <TabsList variant="line">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="sub-accounts">Sub-accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-4">
          <OrgSettings org={org} members={members} />
        </TabsContent>

        <TabsContent value="sub-accounts" className="mt-4">
          <SubAccountsTab subAccounts={subAccounts} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
