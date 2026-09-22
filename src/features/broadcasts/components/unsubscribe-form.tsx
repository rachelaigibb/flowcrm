"use client"

import { useState, useTransition } from "react"
import { confirmUnsubscribe } from "@/features/broadcasts/unsubscribe-actions"

export function UnsubscribeForm({ token }: { token: string }) {
  const [done, setDone] = useState<null | { already: boolean }>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-green-800">
        {done.already ? "You were already unsubscribed." : "Done. You will not receive further marketing email."}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await confirmUnsubscribe(token)
            if (result.ok) setDone({ already: result.already })
            else setError(result.error)
          })
        }
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {pending ? "Working…" : "Unsubscribe"}
      </button>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  )
}
