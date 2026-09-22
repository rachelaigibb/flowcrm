// Unsubscribe links for broadcast and automation emails. The page at
// /u/<token> asks for a click; /api/unsubscribe/<token> accepts the
// one-click POST mail clients send from the List-Unsubscribe header.

export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (raw) return raw.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export function unsubscribeUrlFor(token: string | null | undefined): string | null {
  if (!token) return null
  return `${appBaseUrl()}/u/${token}`
}

export function unsubscribeHeaders(token: string | null | undefined): Record<string, string> | undefined {
  if (!token) return undefined
  return {
    "List-Unsubscribe": `<${appBaseUrl()}/api/unsubscribe/${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
