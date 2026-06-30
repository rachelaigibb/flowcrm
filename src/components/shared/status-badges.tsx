import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PRIORITY_COLORS, STATUS_COLORS } from "@/lib/constants/colors"
import type { PriorityKey, StatusKey } from "@/lib/constants/colors"

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = PRIORITY_COLORS[priority as PriorityKey] ?? PRIORITY_COLORS.medium
  return (
    <Badge variant="outline" className={cn("border", config.badge, className)}>
      {config.label}
    </Badge>
  )
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_COLORS[status as StatusKey] ?? STATUS_COLORS.open
  return (
    <Badge variant="outline" className={cn("border", config.badge, className)}>
      {config.label}
    </Badge>
  )
}
