"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { CalendarIcon, ChevronsUpDown, Check } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { createDeal, searchContacts } from "../actions"
import type { PipelineStage, Contact, DealPriority } from "@/types/database"

interface CreateDealDialogProps {
  stages: PipelineStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDealCreated: () => void
}

type ContactResult = Pick<Contact, "id" | "first_name" | "last_name" | "email" | "company">

export function CreateDealDialog({
  stages,
  open,
  onOpenChange,
  onDealCreated,
}: CreateDealDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [value, setValue] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [stageId, setStageId] = useState(stages[0]?.id ?? "")
  const [priority, setPriority] = useState<DealPriority>("medium")
  const [expectedClose, setExpectedClose] = useState<Date | undefined>()
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState("")
  const [contacts, setContacts] = useState<ContactResult[]>([])
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")

  function resetForm() {
    setTitle("")
    setValue("")
    setCurrency("USD")
    setStageId(stages[0]?.id ?? "")
    setPriority("medium")
    setExpectedClose(undefined)
    setContactId(null)
    setContactSearch("")
    setContacts([])
    setSelectedContactLabel("")
  }

  async function handleContactSearch(q: string) {
    setContactSearch(q)
    if (q.length < 2) {
      setContacts([])
      return
    }
    try {
      const results = await searchContacts(q)
      setContacts(results)
    } catch {
      setContacts([])
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !stageId) {
      toast.error("Title and stage are required")
      return
    }

    startTransition(async () => {
      try {
        await createDeal({
          title: title.trim(),
          value: parseFloat(value) || 0,
          currency,
          stage_id: stageId,
          priority,
          expected_close: expectedClose ? format(expectedClose, "yyyy-MM-dd") : null,
          contact_id: contactId,
        })
        toast.success("Deal created")
        resetForm()
        onOpenChange(false)
        onDealCreated()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create deal")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
          <DialogDescription>
            Add a new deal to your pipeline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Title</Label>
            <Input
              id="deal-title"
              placeholder="Deal title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-value">Value</Label>
              <Input
                id="deal-value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? "USD")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stageId} onValueChange={(v) => setStageId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {stages.find((s) => s.id === stageId)?.name ?? "Select stage"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority((v ?? "medium") as DealPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Expected Close</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expectedClose && "text-muted-foreground"
                    )}
                  />
                }
              >
                <CalendarIcon className="size-4" data-icon="inline-start" />
                {expectedClose ? format(expectedClose, "MMM d, yyyy") : "Select date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expectedClose}
                  onSelect={(date) => {
                    setExpectedClose(date ?? undefined)
                    setDatePopoverOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between font-normal",
                      !contactId && "text-muted-foreground"
                    )}
                  />
                }
              >
                {selectedContactLabel || "Search contacts..."}
                <ChevronsUpDown className="size-4 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onValueChange={handleContactSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {contactSearch.length < 2
                        ? "Type to search..."
                        : "No contacts found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {contacts.map((c) => {
                        const name = [c.first_name, c.last_name]
                          .filter(Boolean)
                          .join(" ")
                        const label = name || c.email || c.company || "Unnamed"
                        return (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            data-checked={contactId === c.id || undefined}
                            onSelect={() => {
                              setContactId(c.id)
                              setSelectedContactLabel(label)
                              setContactPopoverOpen(false)
                            }}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{label}</p>
                              {c.email && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {c.email}
                                </p>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "ml-auto size-4",
                                contactId === c.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
