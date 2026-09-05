"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogCallDialog } from "./log-call-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateShort } from "@/lib/utils/dates"
import { Phone, PhoneCall, ArrowRight } from "lucide-react"

interface QueueContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  tags: string[]
  last_contact: string | null
  source: string | null
}

interface CallsPageProps {
  contacts: QueueContact[]
  selectedTag: string | null
  tagOptions: string[]
  error?: string
}

export function CallsPage({ contacts, selectedTag, tagOptions, error }: CallsPageProps) {
  const router = useRouter()
  const [active, setActive] = useState<QueueContact | null>(null)

  const name = (c: QueueContact) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "Unnamed"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><PhoneCall className="size-5" /> Today&apos;s calls</h1>
          <p className="text-sm text-muted-foreground">Ten people, never-contacted first, then longest since last contact. Log each call and the list refreshes.</p>
        </div>
        <Select value={selectedTag ?? "all"} onValueChange={(v) => router.push(`/calls?tag=${encodeURIComponent(v ?? "all")}`)}>
          <SelectTrigger className="w-48 h-8 text-sm"><SelectValue>{selectedTag ?? "All contacts"}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contacts</SelectItem>
            {tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {contacts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nobody left to call in this list — pick another tag or add contacts with phone numbers.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c, i) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-6 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{name(c)}</Link>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {c.phone && <span>{c.phone}</span>}
                    {c.company && <span>{c.company}</span>}
                    <span>{c.last_contact ? `Last contact ${formatDateShort(c.last_contact)}` : "Never contacted"}</span>
                  </div>
                </div>
                <div className="hidden md:flex flex-wrap gap-1 max-w-56">
                  {c.tags.slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
                {c.phone && (
                  <Button variant="outline" size="sm" render={<a href={`tel:${c.phone}`} />}><Phone className="size-3.5" /> Call</Button>
                )}
                <Button size="sm" onClick={() => setActive(c)}><ArrowRight className="size-3.5" /> Log call</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {active && (
        <LogCallDialog
          open={!!active}
          onOpenChange={(v) => { if (!v) setActive(null) }}
          contactId={active.id}
          contactName={name(active)}
          contactPhone={active.phone}
        />
      )}
    </div>
  )
}
