"use client"

import * as React from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { CalendarIcon, PlusIcon, ChevronsUpDownIcon, CheckIcon } from "lucide-react"
import { createTask } from "../actions"
import type { DealPriority } from "@/types/database"

interface ContactOption {
  id: string
  first_name: string | null
  last_name: string | null
}

interface DealOption {
  id: string
  title: string
}

interface CreateTaskDialogProps {
  contacts: ContactOption[]
  deals: DealOption[]
  children?: React.ReactNode
}

export function CreateTaskDialog({
  contacts,
  deals,
  children,
}: CreateTaskDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [priority, setPriority] = React.useState<DealPriority>("medium")
  const [contactId, setContactId] = React.useState<string>("")
  const [dealId, setDealId] = React.useState<string>("")
  const [contactOpen, setContactOpen] = React.useState(false)
  const [dealOpen, setDealOpen] = React.useState(false)

  function resetForm() {
    setTitle("")
    setDescription("")
    setDueDate(undefined)
    setPriority("medium")
    setContactId("")
    setDealId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    setLoading(true)
    const result = await createTask({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate ? dueDate.toISOString() : null,
      priority,
      contact_id: contactId || null,
      deal_id: dealId || null,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Task created")
      resetForm()
      setOpen(false)
    }
  }

  function getContactLabel(c: ContactOption) {
    const parts = [c.first_name, c.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(" ") : "(Unnamed)"
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          children ? (
            <>{children}</>
          ) : (
            <Button size="sm">
              <PlusIcon className="size-4" />
              Add Task
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up with client..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="size-4" />
                      {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as DealPriority)}>
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

          <div className="flex flex-col gap-1.5">
            <Label>Contact (optional)</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="justify-between font-normal"
                  >
                    {contactId
                      ? getContactLabel(
                          contacts.find((c) => c.id === contactId)!
                        )
                      : "Select contact..."}
                    <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search contacts..." />
                  <CommandList>
                    <CommandEmpty>No contacts found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setContactId("")
                          setContactOpen(false)
                        }}
                      >
                        <span className="text-muted-foreground">None</span>
                      </CommandItem>
                      {contacts.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={getContactLabel(c)}
                          onSelect={() => {
                            setContactId(c.id)
                            setContactOpen(false)
                          }}
                          data-checked={contactId === c.id || undefined}
                        >
                          {getContactLabel(c)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Deal (optional)</Label>
            <Popover open={dealOpen} onOpenChange={setDealOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="justify-between font-normal"
                  >
                    {dealId
                      ? deals.find((d) => d.id === dealId)?.title ?? "Select deal..."
                      : "Select deal..."}
                    <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search deals..." />
                  <CommandList>
                    <CommandEmpty>No deals found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setDealId("")
                          setDealOpen(false)
                        }}
                      >
                        <span className="text-muted-foreground">None</span>
                      </CommandItem>
                      {deals.map((d) => (
                        <CommandItem
                          key={d.id}
                          value={d.title}
                          onSelect={() => {
                            setDealId(d.id)
                            setDealOpen(false)
                          }}
                          data-checked={dealId === d.id || undefined}
                        >
                          {d.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
