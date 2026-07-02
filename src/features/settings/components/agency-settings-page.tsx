"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import {
  PlusIcon,
  TrashIcon,
  UsersIcon,
  MailIcon,
  CopyIcon,
  Loader2,
  CheckIcon,
  XIcon,
  ClockIcon,
  ImageIcon,
  Building2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateShort } from "@/lib/utils/dates"
import { updateOrganization } from "../actions"
import {
  sendInvitation,
  getInvitations,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/features/invitations/actions"
import type {
  Organization,
  SubAccount,
  Invitation,
  OrgRole,
  SubAccountRole,
} from "@/types/database"

interface AgencySettingsPageProps {
  org: Organization
  members: Array<{ id: string; user_id: string; role: string; email?: string }>
  subAccounts: SubAccount[]
}

export function AgencySettingsPage({
  org,
  members,
  subAccounts,
}: AgencySettingsPageProps) {
  const [name, setName] = React.useState(org.name)
  const [saving, setSaving] = React.useState(false)

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<OrgRole>("member")
  const [inviteSubAccountIds, setInviteSubAccountIds] = React.useState<
    Set<string>
  >(new Set())
  const [inviteSubAccountRole, setInviteSubAccountRole] =
    React.useState<SubAccountRole>("collaborator")
  const [sendingInvite, setSendingInvite] = React.useState(false)
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [linkCopied, setLinkCopied] = React.useState(false)

  // Invitations list
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [loadingInvitations, setLoadingInvitations] = React.useState(true)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  // Members
  const [removeMemberId, setRemoveMemberId] = React.useState<string | null>(
    null
  )
  const [removingMember, setRemovingMember] = React.useState(false)
  const [updatingRoleId, setUpdatingRoleId] = React.useState<string | null>(
    null
  )

  // Current user id (for self-detection)
  const currentUserId = React.useMemo(() => {
    // The server enriches the current user's email, so find the member with email set
    const self = members.find((m) => m.email)
    return self?.user_id ?? null
  }, [members])

  // Load invitations on mount
  React.useEffect(() => {
    async function load() {
      setLoadingInvitations(true)
      const result = await getInvitations()
      if (result.data) {
        setInvitations(result.data as Invitation[])
      }
      setLoadingInvitations(false)
    }
    load()
  }, [])

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

  function resetInviteForm() {
    setInviteEmail("")
    setInviteRole("member")
    setInviteSubAccountIds(new Set())
    setInviteSubAccountRole("collaborator")
    setInviteLink(null)
    setLinkCopied(false)
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) {
      toast.error("Email is required")
      return
    }
    setSendingInvite(true)
    const result = await sendInvitation({
      email: inviteEmail,
      role: inviteRole,
      subAccountIds: Array.from(inviteSubAccountIds),
      subAccountRole: inviteSubAccountRole,
    })
    setSendingInvite(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Invitation sent")

    // Show the invite link
    if (result.inviteUrl) {
      setInviteLink(result.inviteUrl)
    }

    // Refresh invitations list
    const refreshed = await getInvitations()
    if (refreshed.data) {
      setInvitations(refreshed.data as Invitation[])
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    toast.success("Invite link copied")
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)
    const result = await revokeInvitation(id)
    setRevokingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Invitation revoked")
    // Refresh
    const refreshed = await getInvitations()
    if (refreshed.data) {
      setInvitations(refreshed.data as Invitation[])
    }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return
    setRemovingMember(true)
    const result = await removeMember(removeMemberId)
    setRemovingMember(false)
    setRemoveMemberId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Member removed")
  }

  async function handleRoleChange(membershipId: string, newRole: OrgRole) {
    setUpdatingRoleId(membershipId)
    const result = await updateMemberRole(membershipId, newRole)
    setUpdatingRoleId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Role updated")
  }

  function toggleSubAccount(id: string) {
    setInviteSubAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const pendingInvitations = invitations.filter((i) => i.status === "pending")
  const pastInvitations = invitations.filter((i) => i.status !== "pending")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Settings Agency
        </h1>
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
          <CardDescription>Your agency name and branding</CardDescription>
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
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4" />
              Members
            </CardTitle>
            <CardDescription>
              People with access to this organization
            </CardDescription>
          </div>
          <CardAction>
            <Dialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open)
                if (!open) resetInviteForm()
              }}
            >
              <DialogTrigger
                render={
                  <Button size="sm" variant="outline">
                    <PlusIcon className="size-4" />
                    Invite Member
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization
                  </DialogDescription>
                </DialogHeader>

                {inviteLink ? (
                  /* ── Success state: show link ── */
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckIcon className="size-4 text-green-500" />
                        <p className="text-sm font-medium">Invitation sent</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Share this link if the email does not arrive:
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={inviteLink}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyLink}
                        >
                          {linkCopied ? (
                            <CheckIcon className="size-3.5" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetInviteForm()
                        }}
                      >
                        Invite Another
                      </Button>
                      <Button onClick={() => setInviteOpen(false)}>Done</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  /* ── Invite form ── */
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Organization Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v: string | null) => {
                          if (v) setInviteRole(v as OrgRole)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {inviteRole === "admin" ? "Admin" : "Member"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Admins can manage settings and invite members. Members
                        can only access assigned sub-accounts.
                      </p>
                    </div>

                    {subAccounts.length > 0 && (
                      <>
                        <Separator />

                        <div className="flex flex-col gap-2">
                          <Label>Sub-Account Access</Label>
                          <p className="text-xs text-muted-foreground">
                            Select which sub-accounts this member can access
                          </p>
                          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-md border border-border p-2">
                            {subAccounts.map((sa) => (
                              <label
                                key={sa.id}
                                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={inviteSubAccountIds.has(sa.id)}
                                  onCheckedChange={() =>
                                    toggleSubAccount(sa.id)
                                  }
                                />
                                <span className="text-sm">{sa.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {inviteSubAccountIds.size > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <Label>Sub-Account Role</Label>
                            <Select
                              value={inviteSubAccountRole}
                              onValueChange={(v: string | null) => {
                                if (v)
                                  setInviteSubAccountRole(
                                    v as SubAccountRole
                                  )
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {inviteSubAccountRole === "admin"
                                    ? "Admin"
                                    : "Collaborator"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="collaborator">
                                  Collaborator
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Applied to all selected sub-accounts
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setInviteOpen(false)}
                        disabled={sendingInvite}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendInvite}
                        disabled={sendingInvite || !inviteEmail.trim()}
                      >
                        {sendingInvite && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        <MailIcon className="size-3.5" />
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {members.map((member) => {
              const isOwner = member.role === "owner"
              const isSelf = member.user_id === currentUserId

              return (
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
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(
                          (member as Record<string, unknown>).created_at as string
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Badge variant="default">Owner</Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(v: string | null) => {
                          if (v && v !== member.role) {
                            handleRoleChange(member.id, v as OrgRole)
                          }
                        }}
                        disabled={updatingRoleId === member.id}
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue>
                            {member.role === "admin" ? "Admin" : "Member"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {!isOwner && !isSelf && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveMemberId(member.id)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">No members found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <MailIcon className="size-4" />
              Invitations
            </CardTitle>
            <CardDescription>
              Pending and past invitations to your organization
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadingInvitations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invitations yet
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Pending */}
              {pendingInvitations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pending
                  </p>
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/10">
                          <ClockIcon className="size-3.5 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inv.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inv.role} &middot; Expires{" "}
                            {formatDateShort(inv.expires_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={revokingId === inv.id}
                      >
                        {revokingId === inv.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <XIcon className="size-3.5" />
                        )}
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Past invitations */}
              {pastInvitations.length > 0 && (
                <div className="flex flex-col gap-2">
                  {pendingInvitations.length > 0 && <Separator />}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    History
                  </p>
                  {pastInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3 opacity-60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full",
                            inv.status === "accepted" &&
                              "bg-green-500/10",
                            inv.status === "expired" &&
                              "bg-muted",
                            inv.status === "revoked" &&
                              "bg-red-500/10"
                          )}
                        >
                          {inv.status === "accepted" && (
                            <CheckIcon className="size-3.5 text-green-500" />
                          )}
                          {inv.status === "expired" && (
                            <ClockIcon className="size-3.5 text-muted-foreground" />
                          )}
                          {inv.status === "revoked" && (
                            <XIcon className="size-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.role} &middot;{" "}
                            {formatDateShort(inv.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          inv.status === "accepted"
                            ? "default"
                            : "secondary"
                        }
                        className="shrink-0"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove member confirmation */}
      <DeleteConfirmDialog
        open={removeMemberId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberId(null)
        }}
        title="Remove Member"
        description="This member will lose access to the organization and all sub-accounts. This action cannot be undone."
        onConfirm={handleRemoveMember}
        isPending={removingMember}
      />
    </div>
  )
}
