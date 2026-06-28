"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Contact } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateContactDialog } from "./create-contact-dialog"
import { ImportCSVDialog } from "./import-csv-dialog"
import { formatDateShort } from "@/lib/utils/dates"
import {
  Search,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ContactsPageProps {
  contacts: Contact[]
}

export function ContactsPage({ contacts }: ContactsPageProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const contact of contacts) {
      if (contact.tags) {
        for (const tag of contact.tags) {
          tagSet.add(tag)
        }
      }
    }
    return Array.from(tagSet).sort()
  }, [contacts])

  // Filter contacts
  const filtered = useMemo(() => {
    let result = contacts

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase()
        const email = (c.email ?? "").toLowerCase()
        const company = (c.company ?? "").toLowerCase()
        return name.includes(q) || email.includes(q) || company.includes(q)
      })
    }

    if (tagFilter) {
      result = result.filter((c) => c.tags?.includes(tagFilter))
    }

    return result
  }, [contacts, search, tagFilter])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="size-3.5" data-icon="inline-start" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={tagFilter ?? ""}
              onValueChange={(v) => setTagFilter(v || null)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tagFilter && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTagFilter(null)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table or Empty State */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Users className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No contacts yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add your first contact manually or import from a CSV file to get started.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" data-icon="inline-start" />
              Import CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Add Contact
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No contacts match your search.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="hidden md:table-cell">Tags</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <TableCell className="font-medium">
                    {[contact.first_name, contact.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email ?? "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {contact.phone ?? "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {contact.company ?? "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {contact.source ?? "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      {contact.tags?.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {(contact.tags?.length ?? 0) > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{contact.tags!.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn("hidden sm:table-cell text-muted-foreground")}>
                    {formatDateShort(contact.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
