import type { CreateEmailOptions, CreateEmailResponse, Resend } from 'resend'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
// Per-process queue shared by compose, automations and broadcasts. Other instances/apps
// still share Resend's account limit: explicit 429 backoff handles that contention.
export function createPacedSender(wait = sleep, now = Date.now, random = Math.random) {
  let tail: Promise<unknown> = Promise.resolve()
  let nextStart = 0
  return (client: Resend, payload: CreateEmailOptions, idempotencyKey: string): Promise<CreateEmailResponse> => {
    const run = tail.then(async () => {
      for (let attempt = 0; ; attempt++) {
        await wait(Math.max(0, nextStart - now()))
        nextStart = now() + 600
        // Transport/5xx uncertainty is NOT retried. One unchanged key/payload per operation.
        const result = await client.emails.send(payload, { idempotencyKey })
        if (result.error?.name !== 'rate_limit_exceeded' || result.error.statusCode !== 429 || attempt >= 3) return result
        const seconds = Number(result.headers?.['retry-after'] ?? result.headers?.['ratelimit-reset'] ?? 0)
        const delay = Math.max(1000 * 2 ** attempt + Math.floor(random() * 250), Number.isFinite(seconds) ? seconds * 1000 : 0)
        // Do not ignore a long Retry-After or keep a function asleep indefinitely.
        if (delay > 15000) return result
        nextStart = Math.max(nextStart, now() + delay)
      }
    })
    tail = run.catch(() => undefined)
    return run
  }
}
export const sendPaced = createPacedSender()
