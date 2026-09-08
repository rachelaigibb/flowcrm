"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarRange } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { setDashboardRange } from "@/features/settings/actions"
import { DATE_RANGE_OPTIONS, labelFor, type DateRange } from "@/lib/utils/date-range"

interface DashboardRangeSelectProps {
  value: DateRange
  years: number[]
}

// Period picker for the dashboard tiles. The choice is saved on the workspace so it
// sticks between visits (weekly / monthly / quarterly goals differ per business).
export function DashboardRangeSelect({ value, years }: DashboardRangeSelectProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Select
      value={value}
      onValueChange={(val: string | null) => {
        if (!val || val === value) return
        startTransition(async () => {
          await setDashboardRange(val as DateRange)
          router.push(`/dashboard?range=${encodeURIComponent(val)}`)
          router.refresh()
        })
      }}
    >
      <SelectTrigger className="w-[150px]" disabled={pending}>
        <CalendarRange className="size-3.5 text-muted-foreground" />
        <SelectValue>{labelFor(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {DATE_RANGE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
        {years.length > 0 && <Separator className="my-1" />}
        {years.map((y) => (
          <SelectItem key={y} value={`y:${y}`}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
