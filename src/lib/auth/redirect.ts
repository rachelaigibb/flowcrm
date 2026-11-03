export function safeRedirect(value?: string | null, fallback = "/") {
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) ? value : fallback
}

export function authSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "")
}
