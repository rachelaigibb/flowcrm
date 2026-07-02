"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft, Loader2, MapPin } from "lucide-react"
import type { PipelineStage } from "@/types/database"

const MapView = dynamic(
  () => import("./deal-map-view").then((m) => m.DealMapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

interface DealForMap {
  id: string
  title: string
  value: number
  currency: string
  latitude: number
  longitude: number
  stage?: { id: string; name: string; color: string } | null
  contact?: { id: string; first_name: string | null; last_name: string | null } | null
}

interface DealMapPageProps {
  deals: DealForMap[]
  stages: PipelineStage[]
}

export function DealMapPage({ deals, stages }: DealMapPageProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Pipeline
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deal Map</h1>
            <p className="text-sm text-muted-foreground">
              {deals.length} deal{deals.length !== 1 ? "s" : ""} with locations
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      {deals.length === 0 ? (
        <div className="flex h-[600px] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30">
          <MapPin className="size-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium">No deals with locations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add addresses to your deals to see them on the map.
            </p>
          </div>
        </div>
      ) : (
        <MapView deals={deals} />
      )}

      {/* Stage legend */}
      {stages.length > 0 && deals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            Stages:
          </span>
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-xs text-muted-foreground">
                {stage.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Only deals with addresses appear on the map. Add addresses in the deal
        details.
      </p>
    </div>
  )
}
