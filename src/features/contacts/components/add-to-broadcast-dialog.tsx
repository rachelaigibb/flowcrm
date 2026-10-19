"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { addContactsToBroadcast, getEditableBroadcasts, previewContactAudience, type ContactAudiencePreview, type ContactBroadcastTarget } from "@/features/broadcasts/contact-audience-actions"

type Destination = { id: string; name: string; channel: string; status: string; scheduled_at: string | null }
export function AddToBroadcastDialog({ ids, timezone = "UTC", onClose, onAdded }: { ids: string[]; timezone?: string; onClose: () => void; onAdded: () => void }) {
  const router = useRouter()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [destination, setDestination] = useState("new")
  const [name, setName] = useState("")
  const [channel, setChannel] = useState<"email" | "sms">("email")
  const [draftId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<{ key: string; data: ContactAudiencePreview } | null>(null)
  const target: ContactBroadcastTarget = destination === "new" ? { kind: "new", name, channel, draftId } : { kind: "existing", id: destination }
  const key = JSON.stringify({ ids: [...ids].sort(), target })
  const current = preview?.key === key ? preview.data : null
  useEffect(() => {
    let cancelled = false
    getEditableBroadcasts().then(result => {
      if (cancelled) return
      if (result.error) setError(result.error)
      else setDestinations(result.data ?? [])
    }).catch(() => { if (!cancelled) setError("Could not load broadcasts. Close and try again.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  async function review() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(""); setPreview(null)
    try {
      const result = await previewContactAudience(ids, target)
      if (result.error) setError(result.error)
      else if (result.data) setPreview({ key, data: result.data })
    } catch { setError("Could not preview contacts. Try again.") }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function confirm() {
    if (!current || inFlight.current) return
    inFlight.current = true; setBusy(true); setError("")
    try {
      const result = await addContactsToBroadcast(ids, target, current.token)
      if (result.error) { setError(result.error); setPreview(null); return }
      if (result.data) {
        toast.success(`${result.data.added} contact(s) added to broadcast`)
        onAdded(); onClose()
        router.push(`/broadcasts/${result.data.id}`)
        router.refresh()
      }
    } catch { setError("Could not confirm the addition. Try again; the new-draft identifier is preserved.") }
    finally { inFlight.current = false; setBusy(false) }
  }
  function schedule(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long", timeZone: timezone }).format(new Date(value))
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90dvh] grid-cols-1 overflow-x-hidden overflow-y-auto sm:max-w-lg [&>*]:min-w-0">
      <DialogHeader><DialogTitle>Add to broadcast</DialogTitle><DialogDescription>{ids.length} selected contact(s). Preview additions before confirming. No messages are sent here.</DialogDescription></DialogHeader>
      <label className="flex flex-col gap-1 text-sm">Destination
        <select aria-label="Broadcast destination" className="w-full min-w-0 max-w-full rounded border bg-background p-2" value={destination} disabled={busy || loading} onChange={e => { setDestination(e.target.value); setError("") }}>
          <option value="new">Create a new broadcast</option>
          {destinations.map(b => <option key={b.id} value={b.id}>{b.name} · {b.channel} · {b.status}{b.scheduled_at ? ` · ${schedule(b.scheduled_at)}` : ""}</option>)}
        </select>
      </label>
      {destination === "new" && <>
        <label className="flex flex-col gap-1 text-sm">Broadcast name<Input value={name} maxLength={200} disabled={busy} onChange={e => setName(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Channel<select aria-label="Broadcast channel" className="w-full min-w-0 max-w-full rounded border bg-background p-2" value={channel} disabled={busy} onChange={e => setChannel(e.target.value as "email" | "sms")}><option value="email">Email</option><option value="sms">SMS</option></select></label>
      </>}
      {loading && <p className="text-sm">Loading draft and scheduled broadcasts…</p>}
      {current && <div className="space-y-2 rounded border p-3 text-sm" aria-label="Audience preview">
        <p><strong>{current.name}</strong> · {current.channel}</p>
        <p>{current.added} to add · {current.alreadyIncluded} already included · {current.excluded.length} excluded</p>
        <p>Revised audience: {current.total} contact(s) before final send checks.</p>
        <p>{current.scheduledAt ? `Schedule stays unchanged: ${schedule(current.scheduledAt)}.` : destination === "new" ? "A new draft will be created." : "This broadcast stays a draft."}</p>
        <p>Existing audience rules and contacts stay intact. Eligibility is checked again before sending.</p>
        {!!current.excluded.length && <details><summary>View exclusions</summary><ul className="mt-2 space-y-1">{current.excluded.map((contact, i) => <li key={i}>{contact.name}: {contact.reason}</li>)}</ul></details>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="flex-wrap"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="outline" disabled={busy || loading || !ids.length || (destination === "new" && !name.trim())} onClick={review}>{busy ? "Working…" : "Preview audience"}</Button><Button disabled={busy || !current?.added} onClick={confirm}>{destination === "new" ? "Create draft with contacts" : "Add contacts"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
