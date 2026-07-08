import { describe, it, expect } from "vitest"
import { renderTemplate, type MessageContact } from "@/lib/messaging/send"

const contact: MessageContact = {
  id: "c1",
  first_name: "Rachel",
  last_name: "Gibb",
  email: "rachel@example.com",
  phone: "+16045551234",
}

describe("renderTemplate", () => {
  it("replaces all supported tokens", () => {
    const result = renderTemplate(
      "Hi {{first_name}} {{last_name}} ({{full_name}}), we'll reach you at {{email}} or {{phone}}.",
      contact
    )
    expect(result).toBe(
      "Hi Rachel Gibb (Rachel Gibb), we'll reach you at rachel@example.com or +16045551234."
    )
  })

  it("is whitespace-tolerant and case-insensitive", () => {
    expect(renderTemplate("Hi {{ First_Name }}!", contact)).toBe("Hi Rachel!")
  })

  it("renders empty string for null fields", () => {
    const bare: MessageContact = { id: "c2", first_name: null, last_name: null, email: null, phone: null }
    expect(renderTemplate("Hi {{first_name}}, bye", bare)).toBe("Hi , bye")
  })

  it("builds full_name from available parts only", () => {
    const firstOnly: MessageContact = { ...contact, last_name: null }
    expect(renderTemplate("{{full_name}}", firstOnly)).toBe("Rachel")
  })

  it("leaves unknown tokens untouched", () => {
    expect(renderTemplate("{{company}} {{first_name}}", contact)).toBe("{{company}} Rachel")
  })
})
