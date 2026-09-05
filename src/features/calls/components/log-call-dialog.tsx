"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logCall } from "@/features/contacts/actions"
import { CALL_OUTCOMES, type CallOutcome } from "@/features/calls/outcomes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Phone } from "lucide-react"
import { cn } from "@/lib/utils"

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  reached: "Reached",
  voicemail: "Voicemail",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
  follow_up_booked: "Follow-up booked",
}

function inDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

interface LogCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  contactPhone: string | null
  onLogged?: () => void
}

export function LogCallDialog({ open, onOpenChange, contactId, contactName, contactPhone, onLogged }: LogCallDialogProps) {
  const router = useRouter()
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [note, setNote] = useState("")
  const [nextTitle, setNextTitle] = useState("")
  const [nextDue, setNextDue] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  function reset() {
    setOutcome(null); setNote(""); setNextTitle(""); setNextDue("")
  }

  function handleSave() {
    if (!outcome) return
    startTransition(async () => {
      const result = await logCall(contactId, {
        outcome,
        note,
        nextStep: nextTitle.trim() ? { title: nextTitle, due_date: nextDue || null } : undefined,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Call logged for ${contactName}`)
      reset()
      onOpenChange(false)
      onLogged?.()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) { if (!v) reset(); onOpenChange(v) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="size-4" />
            Log call — {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {contactPhone && (
            <Button variant="outline" size="sm" className="w-fit" render={<a href={`tel:${contactPhone}`} />}>
              <Phone className="size-3.5" /> Call {contactPhone}
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Outcome</Label>
            <div className="grid grid-cols-3 gap-2">
              {CALL_OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs transition-colors hover:bg-accent",
                    outcome === o && "border-primary bg-primary text-primary-foreground hover:bg-primary"
                  )}
                >
                  {OUTCOME_LABELS[o]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you learn?" className="min-h-20 text-sm" />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Next step (optional — becomes a task)</Label>
            <Input value={nextTitle} onChange={(e) => setNextTitle(e.target.value)} placeholder="e.g. Send market update" className="h-8 text-sm" />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[["Tomorrow", 1], ["3 days", 3], ["1 week", 7], ["1 month", 30]].map(([label, n]) => (
                <Button key={label as string} type="button" variant={nextDue === inDays(n as number) ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setNextDue(inDays(n as number))}>
                  {label as string}
                </Button>
              ))}
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="h-7 w-36 text-xs" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={!outcome || isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
