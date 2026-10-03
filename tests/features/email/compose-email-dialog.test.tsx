import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ComposeEmailDialog } from "@/features/email/components/compose-email-dialog"

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock("@/features/email/actions", () => ({
  sendEmail: mocks.sendEmail,
  getEmailTemplates: async () => ({ data: [] }),
  getComposeDefaults: async () => ({ copyTo: null, hasSignature: false, maxBytes: 10485760 }),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe("compose attachments", () => {
  it("keeps the selected files after clearing the live input, supports remove, and submits retained bytes", async () => {
    mocks.sendEmail.mockResolvedValue({ error: "Keep draft for inspection" })
    const { container } = render(<StrictMode><ComposeEmailDialog open onOpenChange={() => {}} contactId="test" contactEmail="delivered@resend.dev" contactName="Test" /></StrictMode>)
    await screen.findByText("No signature set yet — add one in Settings → Email Settings.")
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const first = new File(["report bytes"], "report.pdf", { type: "application/pdf" })
    const second = new File(["remove me"], "extra.txt")
    let liveFiles = [first, second]
    const liveList = { get length() { return liveFiles.length }, get 0() { return liveFiles[0] }, get 1() { return liveFiles[1] } }
    Object.defineProperty(input, "files", { configurable: true, get: () => liveList })
    Object.defineProperty(input, "value", { configurable: true, get: () => "selected", set: () => { liveFiles = [] } })
    fireEvent.change(input)
    expect(await screen.findByText("report.pdf")).toBeTruthy()
    expect(screen.getByText("extra.txt")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove extra.txt" }))
    expect(screen.queryByText("extra.txt")).toBeNull()
    fireEvent.change(screen.getByPlaceholderText("Email subject"), { target: { value: "Hello {{first_name}}" } })
    fireEvent.change(screen.getByPlaceholderText("Write your email..."), { target: { value: "Report attached" } })
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }))
    await waitFor(() => expect(mocks.sendEmail).toHaveBeenCalledOnce())
    const payload = mocks.sendEmail.mock.calls[0][0] as FormData
    expect(payload.getAll("files")).toEqual([first])
    expect(payload.get("marketing")).toBe("true")
    expect(container).toBeTruthy()
  }, 20000)
})


describe("compose failures", () => {
  for (const transportFailure of [false, true]) {
    it(`keeps the draft and releases Send after ${transportFailure ? "a rejected request" : "a validation error"}`, async () => {
      if (transportFailure) mocks.sendEmail.mockRejectedValue(new Error("network failure"))
      else mocks.sendEmail.mockResolvedValue({ error: "Marketing email requires explicit or implied consent." })
      render(<ComposeEmailDialog open onOpenChange={() => {}} contactId="test" contactEmail="delivered@resend.dev" contactName="Test" />)
      fireEvent.change(screen.getByPlaceholderText("Email subject"), { target: { value: "Test subject" } })
      fireEvent.change(screen.getByPlaceholderText("Write your email..."), { target: { value: "Keep my draft" } })
      fireEvent.click(screen.getByRole("button", { name: /^Send$/ }))
      expect(await screen.findByRole("alert")).toHaveTextContent(transportFailure ? "Could not confirm whether this email was sent" : "requires explicit or implied consent")
      await waitFor(() => expect(screen.getByRole("button", { name: /^Send$/ })).toBeEnabled())
      expect(screen.getByPlaceholderText("Write your email...")).toHaveValue("Keep my draft")
      expect(mocks.sendEmail).toHaveBeenCalledOnce()
    })
  }
})
