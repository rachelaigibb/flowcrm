import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/documents/<id> — redirects the signed-in user to a short-lived
// signed URL for a file they can see (RLS on `documents` decides).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: doc } = await supabase.from("documents").select("path, name").eq("id", id).single()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.path, 120, { download: doc.name })
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Unavailable" }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
