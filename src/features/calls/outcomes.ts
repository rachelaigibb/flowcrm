// Call outcomes shared by the server action (validation/labels) and the dialog (buttons).
// Lives outside actions.ts because a "use server" file may only export async functions.
export const CALL_OUTCOMES = [
  "reached",
  "voicemail",
  "no_answer",
  "wrong_number",
  "not_interested",
  "follow_up_booked",
] as const

export type CallOutcome = (typeof CALL_OUTCOMES)[number]

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  reached: "Reached",
  voicemail: "Left voicemail",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
  follow_up_booked: "Follow-up booked",
}
