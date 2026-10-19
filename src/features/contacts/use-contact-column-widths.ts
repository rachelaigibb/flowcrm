"use client"

import { useMemo, useSyncExternalStore } from "react"
import { CONTACT_COLUMNS, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, type ContactSortField } from "./components/contact-column-header"

type ColumnWidths = Record<ContactSortField, number>
export const COLUMN_WIDTHS_KEY = "flowcrm.contacts.column-widths.v1"
const CHANGE_EVENT = "flowcrm:contact-column-widths"
// Retains the current resize even if storage is blocked or full.
let current: string | undefined

export function parseColumnWidths(saved: string | null): ColumnWidths {
  let values: Record<string, unknown> = {}
  try {
    const parsed: unknown = saved ? JSON.parse(saved) : null
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) values = parsed as Record<string, unknown>
  } catch { /* Invalid preferences fall back to defaults. */ }
  return Object.fromEntries(CONTACT_COLUMNS.map(column => {
    const value = values[column.key]
    return [column.key, typeof value === "number" && Number.isFinite(value)
      ? Math.round(Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, value)))
      : column.width]
  })) as ColumnWidths
}

function getSnapshot(): string | null {
  if (current !== undefined) return current
  try { return window.localStorage.getItem(COLUMN_WIDTHS_KEY) } catch { return null }
}
function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === COLUMN_WIDTHS_KEY || event.key === null) {
      current = undefined
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(CHANGE_EVENT, listener)
  }
}
const getServerSnapshot = () => null

export function useContactColumnWidths() {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const widths = useMemo(() => parseColumnWidths(saved), [saved])
  function resizeColumn(column: ContactSortField, width: number) {
    const next = JSON.stringify(parseColumnWidths(JSON.stringify({ ...parseColumnWidths(getSnapshot()), [column]: width })))
    try {
      window.localStorage.setItem(COLUMN_WIDTHS_KEY, next)
      current = undefined
    } catch { current = next } // Resizing still works for this visit.
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return { columnWidths: widths, resizeColumn }
}
