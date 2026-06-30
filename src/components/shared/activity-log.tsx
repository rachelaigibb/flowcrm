"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ACTIVITY_TYPE_COLORS } from "@/lib/constants/colors"
import { formatSmartDate } from "@/lib/utils/dates"
import {
  ChevronDown,
  MessageSquare,
  Mail,
  Send,
  Phone,
  Calendar,
  Settings,
  Activity as ActivityIcon,
  ArrowRight,
} from "lucide-react"
import type { Activity } from "@/types/database"

const TYPE_ICONS: Record<string, React.ReactNode> = {
  note: <MessageSquare className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  sms: <Send className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  meeting: <Calendar className="size-3.5" />,
  status_change: <ArrowRight className="size-3.5" />,
  system: <Settings className="size-3.5" />,
}

interface ActivityLogProps {
  activities: Activity[]
  defaultOpen?: boolean
}

export function ActivityLog({ activities, defaultOpen = false }: ActivityLogProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ActivityIcon className="size-4" />
            Activity ({activities.length})
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180"
              )}
            />
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                      ACTIVITY_TYPE_COLORS[activity.type as keyof typeof ACTIVITY_TYPE_COLORS] ??
                        ACTIVITY_TYPE_COLORS.system
                    )}
                  >
                    {TYPE_ICONS[activity.type] ?? <ActivityIcon className="size-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {activity.type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatSmartDate(activity.created_at)}
                      </span>
                    </div>
                    {activity.content && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {activity.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
