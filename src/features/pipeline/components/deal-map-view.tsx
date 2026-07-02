"use client"

import "leaflet/dist/leaflet.css"

import { useMemo } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import { LatLngBounds } from "leaflet"
import { formatCurrencyCompact } from "@/lib/utils/currency"

interface DealMapViewProps {
  deals: Array<{
    id: string
    title: string
    value: number
    currency: string
    latitude: number
    longitude: number
    stage?: { id: string; name: string; color: string } | null
    contact?: {
      id: string
      first_name: string | null
      last_name: string | null
    } | null
  }>
}

const DEFAULT_CENTER: [number, number] = [25.2048, 55.2708] // Dubai
const DEFAULT_ZOOM = 3

export function DealMapView({ deals }: DealMapViewProps) {
  const { center, zoom, bounds } = useMemo(() => {
    if (deals.length === 0) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, bounds: undefined }
    }

    if (deals.length === 1) {
      return {
        center: [deals[0].latitude, deals[0].longitude] as [number, number],
        zoom: 14,
        bounds: undefined,
      }
    }

    // Calculate mean center
    const sumLat = deals.reduce((s, d) => s + d.latitude, 0)
    const sumLng = deals.reduce((s, d) => s + d.longitude, 0)
    const meanCenter: [number, number] = [
      sumLat / deals.length,
      sumLng / deals.length,
    ]

    // Build bounds to fit all markers
    const latLngs = deals.map(
      (d) => [d.latitude, d.longitude] as [number, number]
    )
    const mapBounds = new LatLngBounds(latLngs)

    return { center: meanCenter, zoom: DEFAULT_ZOOM, bounds: mapBounds }
  }, [deals])

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      bounds={bounds}
      boundsOptions={{ padding: [40, 40] }}
      scrollWheelZoom
      className="h-[600px] w-full rounded-lg border overflow-hidden z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {deals.map((deal) => {
        const color = deal.stage?.color ?? "#6b7280"
        const contactName = deal.contact
          ? [deal.contact.first_name, deal.contact.last_name]
              .filter(Boolean)
              .join(" ")
          : null

        return (
          <CircleMarker
            key={deal.id}
            center={[deal.latitude, deal.longitude]}
            radius={8}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.8,
              color: "#fff",
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold leading-tight">{deal.title}</p>
                <p className="mt-1 text-muted-foreground">
                  {formatCurrencyCompact(deal.value, deal.currency)}
                </p>
                {deal.stage && (
                  <p className="mt-1 flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {deal.stage.name}
                  </p>
                )}
                {contactName && (
                  <p className="mt-1 text-muted-foreground">{contactName}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
