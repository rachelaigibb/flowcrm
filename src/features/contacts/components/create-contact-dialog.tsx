"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createContact } from "../actions"
import { SOURCE_OPTIONS } from "../types"
import type { ConsentStatus } from "@/types/database"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface CreateContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateContactDialog({
  open,
  onOpenChange,
}: CreateContactDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [source, setSource] = useState("")
  const [tags, setTags] = useState("")
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("none")

  function resetForm() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setCompany("")
    setSource("")
    setTags("")
    setConsentStatus("none")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!firstName.trim() && !lastName.trim()) {
      toast.error("Please provide at least a first or last name")
      return
    }

    startTransition(async () => {
      const result = await createContact({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        source: source || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        consent_status: consentStatus,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Contact created")
        resetForm()
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) {
          onOpenChange(v)
          if (!v) resetForm()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Create a new contact in your CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 604 555 0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              placeholder="Acme Inc."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="investor, dubai, hot (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Consent Status</Label>
            <Select
              value={consentStatus}
              onValueChange={(v) => setConsentStatus(v as ConsentStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="explicit">Explicit</SelectItem>
                <SelectItem value="implied">Implied</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Create Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
