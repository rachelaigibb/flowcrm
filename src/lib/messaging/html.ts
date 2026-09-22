// Turns the plain text people type into the compose box (or a template) into
// an HTML email body, and appends the workspace signature to both forms.
// No rich-text editor: line breaks become <br>, blank lines become paragraphs,
// and bare URLs / email addresses become links.

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}"'])/gi
const EMAIL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Escapes a line and links its URLs and email addresses.
function lineToHtml(line: string): string {
  const parts: string[] = []
  let rest = line
  while (rest.length > 0) {
    URL_RE.lastIndex = 0
    EMAIL_RE.lastIndex = 0
    const url = URL_RE.exec(rest)
    const mail = EMAIL_RE.exec(rest)
    const next = [url, mail].filter(Boolean).sort((a, b) => a!.index - b!.index)[0]
    if (!next) {
      parts.push(escapeHtml(rest))
      break
    }
    parts.push(escapeHtml(rest.slice(0, next.index)))
    const raw = next[0]
    if (next === url) {
      const href = raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw
      parts.push(`<a href="${escapeHtml(href)}">${escapeHtml(raw)}</a>`)
    } else {
      parts.push(`<a href="mailto:${escapeHtml(raw)}">${escapeHtml(raw)}</a>`)
    }
    rest = rest.slice(next.index + raw.length)
  }
  return parts.join("")
}

export function textToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/)
  return paragraphs
    .map((p) => `<p style="margin:0 0 1em 0;">${p.split("\n").map(lineToHtml).join("<br>")}</p>`)
    .join("")
}

export interface EmailContent {
  text: string
  html: string
}

// Builds the final text + HTML bodies. The signature is separated by the
// conventional "-- " line in text and a bordered block in HTML.
export interface EmailFooter {
  // Who is sending and how to reach them (CASL identification), plus the
  // unsubscribe link. Rendered in small grey type under a rule.
  senderLine: string
  unsubscribeUrl: string
}

export function buildEmailContent(body: string, signature?: string | null, footer?: EmailFooter | null): EmailContent {
  const trimmedBody = body.trim()
  const sig = signature?.trim() ?? ""
  let text = sig ? `${trimmedBody}\n\n-- \n${sig}` : trimmedBody
  const bodyHtml = textToHtml(trimmedBody)
  const sigHtml = sig
    ? `<div style="margin-top:1.5em;padding-top:0.75em;border-top:1px solid #e5e7eb;color:#4b5563;">${textToHtml(sig)}</div>`
    : ""
  let footerHtml = ""
  if (footer) {
    text += `\n\n${footer.senderLine}\nUnsubscribe: ${footer.unsubscribeUrl}`
    footerHtml = `<div style="margin-top:2em;padding-top:0.75em;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(footer.senderLine)}<br><a href="${escapeHtml(footer.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a></div>`
  }
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827;">${bodyHtml}${sigHtml}${footerHtml}</div>`
  return { text, html }
}
