"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ACTIVITY_TYPE_COLORS } from "@/lib/constants/colors"
import { formatSmartDate } from "@/lib/utils/dates"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { Activity } from "@/types/database"

const COLLAPSED_COUNT = 5

export function CollapsibleActivityList({
  activities,
}: {
  activities: Activity[]
}) {
  const [expanded, setExpanded] = useState(false)

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent activity</p>
    )
  }

  const hasMore = activities.length > COLLAPSED_COUNT
  const visible = expanded ? activities : activities.slice(0, COLLAPSED_COUNT)

  return (
    <div className="space-y-3">
      <div className={expanded ? "max-h-96 overflow-y-auto space-y-3" : "space-y-3"}>
        {visible.map((activity) => {
          const colorClass =
            ACTIVITY_TYPE_COLORS[
              activity.type as keyof typeof ACTIVITY_TYPE_COLORS
            ] ?? ACTIVITY_TYPE_COLORS.system

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 text-sm"
            >
              <Badge variant="secondary" className={`mt-0.5 shrink-0 ${colorClass}`}>
                {activity.type}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">
                  {activity.content ?? "No description"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSmartDate(activity.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp className="ml-1 size-3" />
            </>
          ) : (
            <>
              Show all {activities.length} activities
              <ChevronDown className="ml-1 size-3" />
            </>
          )}
        </Button>
      )}
    </div>
  )
}
