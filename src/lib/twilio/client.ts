import twilio from "twilio"

let twilioClient: ReturnType<typeof twilio> | null = null

export function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required")
    }
    twilioClient = twilio(accountSid, authToken)
  }
  return twilioClient
}
