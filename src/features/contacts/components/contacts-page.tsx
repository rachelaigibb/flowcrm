"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Contact } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CreateContactDialog } from "./create-contact-dialog"
import { ImportCSVDialog } from "./import-csv-dialog"
import { formatDateShort } from "@/lib/utils/dates"
import {
  Search,
  Plus,
  Upload,
  Download,
  Users,
  X,
  ChevronUp,
  ChevronDown,
  Filter,
  Tag,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SOURCE_COLORS } from "@/lib/constants/colors"
import { toast } from "sonner"
import { deleteContact } from "../actions"

type SortField = "name" | "email" | "company" | "created_at"
type SortOrder = "asc" | "desc"

interface ContactsPageProps {
  contacts: Contact[]
}

export function ContactsPage({ contacts }: ContactsPageProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
        const tagMatch = c.tags?.some((t) => t.toLowerCase().includes(q)) ?? false
        return name.includes(q) || email.includes(q) || company.includes(q) || tagMatch
      })
    }

    if (selectedTags.size > 0) {
      result = result.filter((c) =>
        c.tags?.some((t) => selectedTags.has(t))
      )
    }

    return result
  }, [contacts, search, selectedTags])

  // Sort filtered contacts
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let aVal = ""
      let bVal = ""

      switch (sortField) {
        case "name":
          aVal = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim().toLowerCase()
          bVal = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim().toLowerCase()
          break
        case "email":
          aVal = (a.email ?? "").toLowerCase()
          bVal = (b.email ?? "").toLowerCase()
          break
        case "company":
          aVal = (a.company ?? "").toLowerCase()
          bVal = (b.company ?? "").toLowerCase()
          break
        case "created_at":
          aVal = a.created_at
          bVal = b.created_at
          break
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortField, sortOrder])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  function clearTagFilter() {
    setSelectedTags(new Set())
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map((c) => c.id)))
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    const ids = Array.from(selectedIds)

    for (const id of ids) {
      const result = await deleteContact(id)
      if (result.error) {
        toast.error(`Failed to delete contact: ${result.error}`)
        return
      }
    }

    toast.success(`Deleted ${count} contact${count !== 1 ? "s" : ""}`)
    setSelectedIds(new Set())
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null
    return sortOrder === "asc" ? (
      <ChevronUp className="size-3.5 inline-block ml-1" />
    ) : (
      <ChevronDown className="size-3.5 inline-block ml-1" />
    )
  }

  function exportToCsv(rows: Contact[]) {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Source", "Tags", "Consent Status", "Created At"]
    const csvRows = rows.map((c) => [
      c.first_name ?? "",
      c.last_name ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.company ?? "",
      c.source ?? "",
      (c.tags ?? []).join("; "),
      c.consent_status,
      c.created_at,
    ])
    const csv = [headers, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `contacts-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered)}>
            <Download className="size-3.5" data-icon="inline-start" />
            Export
          </Button>
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
            <Popover>
              <PopoverTrigger>
                <Button variant="outline" size="sm" type="button">
                  <Filter className="size-3.5" data-icon="inline-start" />
                  Tags
                  {selectedTags.size > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {selectedTags.size}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="flex flex-col gap-1">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Checkbox
                        checked={selectedTags.has(tag)}
                        onCheckedChange={() => toggleTag(tag)}
                      />
                      <Tag className="size-3.5 text-muted-foreground" />
                      <span className="truncate">{tag}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {selectedTags.size > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearTagFilter}
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIndicator field="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => handleSort("email")}
                  >
                    Email
                    <SortIndicator field="email" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => handleSort("company")}
                  >
                    Company
                    <SortIndicator field="company" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="hidden md:table-cell">Tags</TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => handleSort("created_at")}
                  >
                    Created
                    <SortIndicator field="created_at" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={cn(
                    "cursor-pointer",
                    selectedIds.has(contact.id) && "bg-muted/50"
                  )}
                >
                  <TableCell
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelectOne(contact.id)
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelectOne(contact.id)}
                    />
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {[contact.first_name, contact.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {contact.email ?? "-"}
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell text-muted-foreground"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {contact.phone ?? "-"}
                  </TableCell>
                  <TableCell
                    className="hidden lg:table-cell text-muted-foreground"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {contact.company ?? "-"}
                  </TableCell>
                  <TableCell
                    className="hidden lg:table-cell"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {contact.source ? (
                      <Badge
                        variant="outline"
                        className={
                          (SOURCE_COLORS[contact.source.toLowerCase()] ?? {
                            badge: "bg-muted text-muted-foreground border-border",
                          }).badge
                        }
                      >
                        {(SOURCE_COLORS[contact.source.toLowerCase()] ?? {
                          label: contact.source,
                        }).label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="hidden md:table-cell"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
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
                  <TableCell
                    className={cn("hidden sm:table-cell text-muted-foreground")}
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    {formatDateShort(contact.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" disabled>
            <Tag className="size-3.5" data-icon="inline-start" />
            Add Tag
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
          >
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
