import { describe, it, expect } from "vitest"
import { textToHtml, buildEmailContent, escapeHtml } from "@/lib/messaging/html"

describe("textToHtml", () => {
  it("turns blank lines into paragraphs and single breaks into <br>", () => {
    expect(textToHtml("Hi Sam,\nThanks.\n\nRachel")).toBe(
      '<p style="margin:0 0 1em 0;">Hi Sam,<br>Thanks.</p><p style="margin:0 0 1em 0;">Rachel</p>'
    )
  })

  it("escapes HTML so a pasted tag cannot inject markup", () => {
    expect(textToHtml("<script>x</script> & co")).toContain("&lt;script&gt;x&lt;/script&gt; &amp; co")
  })

  it("links URLs and email addresses, keeping trailing punctuation outside the link", () => {
    const html = textToHtml("See https://rachelgibbrealtor.ca/deals. Or www.example.com, or write info@rachelgibbrealtor.com.")
    expect(html).toContain('<a href="https://rachelgibbrealtor.ca/deals">https://rachelgibbrealtor.ca/deals</a>.')
    expect(html).toContain('<a href="https://www.example.com">www.example.com</a>,')
    expect(html).toContain('<a href="mailto:info@rachelgibbrealtor.com">info@rachelgibbrealtor.com</a>.')
  })

  it("escapeHtml handles quotes", () => {
    expect(escapeHtml('a "b"')).toBe("a &quot;b&quot;")
  })
})

describe("buildEmailContent", () => {
  it("appends the signature after a -- separator in text and a bordered block in HTML", () => {
    const { text, html } = buildEmailContent("Hello", "Rachel Gibb\nrachelgibbrealtor.com")
    expect(text).toBe("Hello\n\n-- \nRachel Gibb\nrachelgibbrealtor.com")
    expect(html).toContain("border-top")
    expect(html).toContain("Rachel Gibb<br>rachelgibbrealtor.com")
  })

  it("omits the signature block when there is no signature", () => {
    const { text, html } = buildEmailContent("Hello\n", null)
    expect(text).toBe("Hello")
    expect(html).not.toContain("border-top")
  })
})

describe("buildEmailContent with a marketing footer", () => {
  it("adds the sender line and unsubscribe link to both text and HTML", () => {
    const { text, html } = buildEmailContent("Body", null, {
      senderLine: "Rachel Gibb · info@example.com",
      unsubscribeUrl: "https://crm.example.com/u/abc",
    })
    expect(text).toBe("Body\n\nRachel Gibb · info@example.com\nUnsubscribe: https://crm.example.com/u/abc")
    expect(html).toContain('<a href="https://crm.example.com/u/abc"')
    expect(html).toContain("Rachel Gibb · info@example.com")
  })
})
