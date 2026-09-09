"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog"
import { GlobeIcon, PlusIcon, TrashIcon, CopyIcon, CheckIcon } from "lucide-react"
import {
  createIntakeKey,
  revokeIntakeKey,
  updateIntakeNotifyEmail,
} from "@/features/intake/actions"
import type { IntakeKey } from "@/types/database"

interface IntakeCardProps {
  subAccountId: string
  keys: IntakeKey[]
  notifyEmail: string
  endpointUrl: string
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error("Copy failed — select the text and copy it manually")
        }
      }}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

export function IntakeCard({ subAccountId, keys: initialKeys, notifyEmail: initialNotify, endpointUrl }: IntakeCardProps) {
  const [keys, setKeys] = React.useState<IntakeKey[]>(initialKeys)
  const [notifyEmail, setNotifyEmail] = React.useState(initialNotify)
  const [savingNotify, setSavingNotify] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [label, setLabel] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [newSecret, setNewSecret] = React.useState<string | null>(null)
  const [revokeId, setRevokeId] = React.useState<string | null>(null)
  const [revoking, setRevoking] = React.useState(false)

  async function handleCreate() {
    setCreating(true)
    const result = await createIntakeKey(subAccountId, label)
    setCreating(false)
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    if ("data" in result && result.data) {
      setNewSecret(result.data.secret)
      setKeys((prev) => [
        {
          id: result.data!.id,
          org_id: "",
          sub_account_id: subAccountId,
          label: label.trim(),
          key_prefix: result.data!.secret.slice(0, 8),
          created_at: new Date().toISOString(),
          last_used_at: null,
          revoked_at: null,
        },
        ...prev,
      ])
      setLabel("")
    }
  }

  async function handleRevoke() {
    if (!revokeId) return
    setRevoking(true)
    const result = await revokeIntakeKey(revokeId)
    setRevoking(false)
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    setKeys((prev) => prev.map((k) => (k.id === revokeId ? { ...k, revoked_at: new Date().toISOString() } : k)))
    setRevokeId(null)
    toast.success("Key revoked — that website can no longer submit leads")
  }

  async function handleSaveNotify() {
    setSavingNotify(true)
    const result = await updateIntakeNotifyEmail(subAccountId, notifyEmail)
    setSavingNotify(false)
    if ("error" in result && result.error) toast.error(result.error)
    else toast.success("Notification email saved")
  }

  const active = keys.filter((k) => !k.revoked_at)
  const revoked = keys.filter((k) => k.revoked_at)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GlobeIcon className="size-4" />
          Website Intake
        </CardTitle>
        <CardDescription>
          Let your websites send form submissions straight into this workspace. Each site gets its own key; new
          people arrive as leads with explicit consent recorded, and you get an email copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Endpoint</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-xs">{endpointUrl}</code>
            <CopyButton value={endpointUrl} />
          </div>
          <p className="text-xs text-muted-foreground">
            Websites POST JSON here with <code>Authorization: Bearer &lt;key&gt;</code>. Fields: name, email, phone,
            message, source, tags, consent (must be true).
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-notify">Send a copy of each submission to</Label>
          <div className="flex gap-2">
            <Input
              id="intake-notify"
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="Defaults to the reply-to / from address in Email Settings"
            />
            <Button variant="outline" onClick={handleSaveNotify} disabled={savingNotify}>
              {savingNotify ? "Saving..." : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Copies are sent from the address in Email Settings, so that must be set for this workspace.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Keys</Label>
            <Button size="sm" onClick={() => { setNewSecret(null); setCreateOpen(true) }}>
              <PlusIcon className="size-3.5" />
              New key
            </Button>
          </div>
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
              No keys yet. Create one per website.
            </p>
          )}
          {active.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{k.label}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{k.key_prefix}…</code> · created {new Date(k.created_at).toLocaleDateString()} ·{" "}
                  {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Revoke key"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setRevokeId(k.id)}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </div>
          ))}
          {revoked.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Revoked: {revoked.map((k) => k.label).join(", ")}
            </p>
          )}
        </div>
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setNewSecret(null) } }}>
        <DialogContent>
          {newSecret ? (
            <>
              <DialogHeader>
                <DialogTitle>Copy your new key</DialogTitle>
                <DialogDescription>
                  This is the only time the key is shown. Paste it into the website&apos;s hosting settings as an
                  environment variable, then close this dialog.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted px-2 py-2 text-xs">{newSecret}</code>
                <CopyButton value={newSecret} />
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateOpen(false); setNewSecret(null) }}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New intake key</DialogTitle>
                <DialogDescription>Name it after the website that will use it.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="intake-label">Label</Label>
                <Input
                  id="intake-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. rachelgibbrealtor.ca"
                  onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) handleCreate() }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !label.trim()}>
                  {creating ? "Creating..." : "Create key"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => { if (!open) setRevokeId(null) }}
        title="Revoke this key?"
        description="The website using it will stop delivering leads to FlowCRM until you give it a new key."
        onConfirm={handleRevoke}
        isPending={revoking}
      />
    </Card>
  )
}
