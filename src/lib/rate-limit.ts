// Simple in-memory rate limiter for public routes. Serverless caveat: state is
// per-instance, so this is best-effort spam control alongside the honeypot and
// the intake key — not a hard guarantee. Swap for a KV store if abuse appears.

const hits = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10

export function rateLimit(key: string, max = MAX_PER_WINDOW): boolean {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now })
    return true
  }
  entry.count += 1
  return entry.count <= max
}

export function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}
