"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, MessageSquarePlus, Plus, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addDealContact, listDealContacts, logInquiry, removeDealContact, searchContacts } from "../actions"
import { DEFAULT_DEAL_ROLES, INQUIRY_ROLE, dealRoleLabel } from "../deal-roles"
import type { DealContact } from "@/types/database"

type ContactHit = { id: string; first_name: string | null; last_name: string | null; email: string | null; company: string | null }
const nameOf = (c: { first_name?: string | null; last_name?: string | null; company?: string | null; email?: string | null } | null | undefined) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.company || c?.email || "Unnamed"

interface DealPeopleCardProps {
  dealId: string
  dealTitle: string
  dealRoles?: string[]
  onChanged?: () => void
}

/**
 * People linked to a deal (deal_contacts): the seller's co-owner, buyer inquiries on a listing,
 * the other side's agent, a lawyer… Each link has a role from the workspace's list.
 */
export function DealPeopleCard({ dealId, dealTitle, dealRoles = DEFAULT_DEAL_ROLES, onChanged }: DealPeopleCardProps) {
  const router = useRouter()
  const [rows, setRows] = useState<DealContact[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const reload = useCallback(async () => {
    const res = await listDealContacts(dealId)
    setRows(res.data ?? [])
    setLoading(false)
  }, [dealId])
  useEffect(() => { setLoading(true); void reload() }, [reload])

  // --- Add person (existing contact)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<ContactHit[]>([])
  const [role, setRole] = useState<string>(dealRoles[0] ?? "contact")
  useEffect(() => {
    if (!addOpen) return
    const h = setTimeout(async () => setHits(await searchContacts(query)), 200)
    return () => clearTimeout(h)
  }, [query, addOpen])

  function link(contactId: string) {
    startTransition(async () => {
      const res = await addDealContact(dealId, contactId, role)
      if (res.error) toast.error(res.error)
      else { toast.success("Linked"); setAddOpen(false); setQuery(""); await reload(); onChanged?.() }
    })
  }
  function unlink(id: string) {
    startTransition(async () => {
      const res = await removeDealContact(id)
      if (res.error) toast.error(res.error)
      else { await reload(); onChanged?.() }
    })
  }

  // --- Log inquiry (existing or new person + note + follow-up)
  const [inqOpen, setInqOpen] = useState(false)
  const [inqMode, setInqMode] = useState<"existing" | "new">("new")
  const [inqQuery, setInqQuery] = useState("")
  const [inqHits, setInqHits] = useState<ContactHit[]>([])
  const [inqContact, setInqContact] = useState<ContactHit | null>(null)
  const [first, setFirst] = useState(""); const [last, setLast] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("")
  const [note, setNote] = useState(""); const [followUp, setFollowUp] = useState("2")
  useEffect(() => {
    if (!inqOpen || inqMode !== "existing") return
    const h = setTimeout(async () => setInqHits(await searchContacts(inqQuery)), 200)
    return () => clearTimeout(h)
  }, [inqQuery, inqOpen, inqMode])
  function resetInquiry() { setInqMode("new"); setInqQuery(""); setInqContact(null); setFirst(""); setLast(""); setEmail(""); setPhone(""); setNote(""); setFollowUp("2") }
  function submitInquiry() {
    startTransition(async () => {
      const res = await logInquiry(dealId, {
        contactId: inqMode === "existing" ? inqContact?.id ?? null : null,
        newContact: inqMode === "new" ? { first_name: first, last_name: last, email, phone } : undefined,
        note, followUpDays: followUp === "" ? null : Number(followUp), role: INQUIRY_ROLE,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success("Inquiry logged"); setInqOpen(false); resetInquiry(); await reload(); onChanged?.(); router.refresh()
    })
  }

  const inquiries = rows.filter((r) => r.role === INQUIRY_ROLE).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          People
          {rows.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {rows.length}{inquiries > 0 ? ` · ${inquiries} inquir${inquiries === 1 ? "y" : "ies"}` : ""}
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { resetInquiry(); setInqOpen(true) }}>
            <MessageSquarePlus className="size-3.5" data-icon="inline-start" />
            Log inquiry
          </Button>
          <Popover open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setQuery("") }}>
            <PopoverTrigger render={<Button size="sm" variant="ghost" />}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Add person
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center gap-2 border-b p-2">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={role} onValueChange={(v: string | null) => v && setRole(v)}>
                  <SelectTrigger size="sm" className="h-7 flex-1 text-xs"><SelectValue>{dealRoleLabel(role)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {dealRoles.map((r) => <SelectItem key={r} value={r}>{dealRoleLabel(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search contacts…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <CommandEmpty>No contacts found</CommandEmpty>
                  <CommandGroup>
                    {hits.map((c) => (
                      <CommandItem key={c.id} value={c.id} onSelect={() => link(c.id)} disabled={isPending}>
                        <div className="min-w-0">
                          <p className="truncate text-sm">{nameOf(c)}</p>
                          {c.email && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
                        </div>
                        {rows.some((r) => r.contact_id === c.id) && <Check className="ml-auto size-3.5 text-muted-foreground" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one linked yet. Log an inquiry or add a person with a role.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button type="button" className="min-w-0 flex-1 truncate text-left text-primary hover:underline" onClick={() => router.push(`/contacts/${r.contact_id}`)}>
                {nameOf(r.contact)}
              </button>
              <Badge variant="outline" className="text-[10px]">{dealRoleLabel(r.role)}</Badge>
              {r.note && <span className="hidden truncate text-xs text-muted-foreground sm:inline" title={r.note}>{r.note}</span>}
              <button type="button" aria-label="Unlink" className="text-muted-foreground hover:text-destructive" onClick={() => unlink(r.id)} disabled={isPending}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={inqOpen} onOpenChange={setInqOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log inquiry</DialogTitle>
            <DialogDescription>Someone asked about {dealTitle}. Links them to the deal, saves the note and books a follow-up.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1 rounded-md border p-0.5 text-xs">
              <button type="button" className={`flex-1 rounded px-2 py-1 ${inqMode === "new" ? "bg-muted font-medium" : "text-muted-foreground"}`} onClick={() => setInqMode("new")}>New person</button>
              <button type="button" className={`flex-1 rounded px-2 py-1 ${inqMode === "existing" ? "bg-muted font-medium" : "text-muted-foreground"}`} onClick={() => setInqMode("existing")}>Existing contact</button>
            </div>
            {inqMode === "new" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus /></div>
                <div className="space-y-1"><Label className="text-xs">Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search contacts…" value={inqQuery} onValueChange={setInqQuery} />
                  <CommandList className="max-h-40">
                    <CommandEmpty>No contacts found</CommandEmpty>
                    <CommandGroup>
                      {inqHits.map((c) => (
                        <CommandItem key={c.id} value={c.id} onSelect={() => setInqContact(c)}>
                          <span className="truncate">{nameOf(c)}</span>
                          {inqContact?.id === c.id && <Check className="ml-auto size-3.5" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {inqContact && <p className="border-t px-3 py-1.5 text-xs">Selected: <span className="font-medium">{nameOf(inqContact)}</span></p>}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">What did they ask?</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Saw it on Realtor.ca, wants a showing Saturday afternoon…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Follow up in (days)</Label>
              <Input type="number" min={0} value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="w-24" placeholder="none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInqOpen(false)}>Cancel</Button>
            <Button onClick={submitInquiry} disabled={isPending || (inqMode === "new" ? !first.trim() : !inqContact)}>
              {isPending ? "Saving…" : "Log inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
