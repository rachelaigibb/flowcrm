# October 6 rate-limit recovery — v0.9.8

## Authorized scope and preflight

Rachel approved fixing pacing and retrying only two explicitly rejected emails, same original content/sender, from [Oct6 general launch](https://crm.getflowplan.app/broadcasts/03a0a345-0e48-4167-a11b-12d402846650). No resending20accepted, audience/consent/content/schedule changes, credential changes or main merge.

- Metro Vancouver Housing: `icentre@metrovancouver.org`, recipient `0fdc3818-2425-4760-87e4-12b85cc85875`, contact `c591a552-f28b-46da-b141-9248821ede89`.
- VRS Communities: `vanres@vrs.org`, recipient `172befa5-8cdc-46f6-a803-bc23ca5e9be9`, contact `ac7d207c-3bda-41d0-8a3d-74bee887c649`.
- Both still failed with explicit10requests/second error, null providerID/sent_at and0acceptedactivities. Current eligible addresses unchanged, implied consent, no do-not-contact. Provider list of all53sent messages contains neither; suppression lookups both404notfound. No acceptance ambiguity found for the authorized pair.
-20accepted snapshot fingerprint `822ee8045df1042806dbd12761e5c414`; original campaign excluding stats/updated_at fingerprint `8b8442844465035dd33182b28fb57ab8`. Preserve and recheck after retry.
- Original/current sender match `Rachel Gibb <info@rachelgibbrealtor.com>`. Original subject remains `Court-ordered sale: C-35 corner site in Guildford Town Centre`.
- Other20were accepted;19delivered and Panorama West still provider-delayed at preflight. Delayed is accepted and excluded from retry.

## Fix

Previous five-message concurrent batches could exceed the provider limit. Email broadcasts now use batch size1; the common send helper serializes email API requests with at least600ms between starts per process. Same process compose/automation traffic shares the queue. Other instances/apps still share the account limit: only explicit `rate_limit_exceeded`429 gets bounded exponential backoff+jitter, respecting Retry-After/reset, at most4attempts; waits beyond15seconds stop rather than violate Retry-After. Quotas/auth/5xx/transport ambiguity are not automatically retried. No distributed account-wide limit guarantee is claimed.

Every operation uses one idempotency key and unchanged payload across retry attempts; broadcasts use campaign/contact keys. Resend retains these for24hours, so this is not a permanent dedup store. Existing recipient state/atomic claims are the durable guard. Provider acceptance is preserved even if activity logging fails.

User-triggered Retry selected rate-limit failures is enabled only when every selected snapshot is explicitly rate rejected without a providerID/senttime. Server repeats those checks, tenant scopes the IDs, rechecks eligibility/exact address, prior accepted activities, known bounce/complaint/suppression evidence and sender consistency, then compare-and-swaps each failed row to pending before sending. Competing calls cannot claim the same row. Crashes/unknown outcomes are never automatically reclaimed. Accepted/delayed recipients cannot enter this path. Uses original campaign content and recorded audience, logs original rejection in successful activity metadata, updates only selected results and summary counts. No cron retries, new credential, schema or audience changes.

## Validation and remaining execution

97Vitest tests passed; TypeScript/build passed; targeted lint clean and full lint stays baseline26errors29warnings. Regression covers pacing, concurrent callers, retry headers/budget, same key/payload, quota/transport ambiguity, accepted-result logging failure, selected-only retry, prior acceptance/suppression/address/consent checks, no re-send after success, and UI confirmation/selection gating. No additional test emails.

Browser control is not currently exposed to this delegated environment. UI component tests pass, but live retry interaction/browser verification remains pending. Do not retrieve production secrets to bypass this limitation. Once deployed, open the campaign, filter Send status to failed, select only the two named rows, and invoke Retry selected rate-limit failures once. If the action times out, inspect records/provider acceptance before any further click. Then verify signed delivered/bounced/delayed evidence and the20accepted snapshot fingerprint above.

References: [Resend rate limits](https://resend.com/docs/api-reference/rate-limit), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), installed SDK response/error/header types.

### October 6 — v0.9.8 deployed, retry interaction blocked

Exact code `5c266343fc7c60d77335c8860aed79d1d2b613a8` deployed Ready as `dpl_FjL1x8fgRSsu9GLfPzjEvcDzPb3W`, https://flowcrm-ijknpmghf-rachelgibb.vercel.app, alias https://crm.getflowplan.app. Independent metadata confirms SHA/Ready/alias. Remote build/TypeScript passed; unsigned webhook400, login200. Bothfailed snapshots unchanged (`d1309c0cbe8646c7589b8b0828ccd7a9`),20accepted unchanged (`822ee8045df1042806dbd12761e5c414`), campaign content/audience/schedule fingerprint unchanged (`8b8442844465035dd33182b28fb57ab8`). No retry or other email sent by this task yet. Browser-control tools are absent in this environment; the parent/session with authenticated UI must invoke the already-authorized exact-two selection once, then return for acceptance/delivery verification. No further send approval is needed; no production secrets were retrieved to work around the tool limitation. See RATE-LIMIT-RETRY.md for exact IDs/action.
