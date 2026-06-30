"use client"

import * as React from "react"
import { toast } from "sonner"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  PlusIcon,
  UsersIcon,
  ImageIcon,
  Building2Icon,
} from "lucide-react"
import { updateOrganization } from "../actions"
import type { Organization, Membership } from "@/types/database"

interface AgencySettingsPageProps {
  org: Organization
  members: (Membership & { email?: string })[]
}

export function AgencySettingsPage({ org, members }: AgencySettingsPageProps) {
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings Agency</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization name, branding, and team
        </p>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2Icon className="size-4" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Your agency name and branding
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

      {/* Members */}
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
                      Joined {new Date(member.created_at).toLocaleDateString()}
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
