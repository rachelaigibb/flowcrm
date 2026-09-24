import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { runSchedulerTick } from "@/features/scheduler/tick"

// Vercel Cron target (vercel.json, every 5 minutes). Vercel sends
// `Authorization: Bearer <CRON_SECRET>`; anything else gets 401. This is the
// only file allowed to import the service-role client.

export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const summary = await runSchedulerTick(createServiceClient())
    return NextResponse.json({ ok: !summary.error, ...summary }, { status: summary.error ? 500 : 200 })
  } catch (err) {
    console.error("[cron/tick] failed:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
