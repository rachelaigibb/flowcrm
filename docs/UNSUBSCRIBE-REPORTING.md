# Current unsubscribe reporting and send-time checks

October 7, 2026 — v0.9.9 local candidate; production remains v0.9.8. Rachel approved reporting and the send-time safeguard, with deployment held for review.

## Behaviour

- Broadcast → Recipients appends **N recipients currently unsubscribed** to the existing delivery/click summary. It counts distinct recorded contacts whose current consent is withdrawn, independent of the visible filters.
- Consent → **Unsubscribed** intersects send status, engagement, link and manual follow-up filters. Open in Contacts preserves the consent filter; Contacts offers the same filter.
- Recipient rows show Unsubscribed and the recorded withdrawal timestamp in the workspace timezone. Missing dates and missing/deleted contact consent stay unknown. Re-consented contacts are no longer counted; an old withdrawal timestamp alone does not establish current withdrawal.
- These are current contact statuses, not campaign-attributed events or a campaign unsubscribe rate. Existing reusable contact-token links cannot reliably establish which campaign caused withdrawal. No historical attribution is inferred.
- Existing accepted/delivered/click history and manual interested/replied outcomes remain unchanged. Existing follow-up tasks are not cancelled. New follow-up drafts/tasks retain their current eligibility checks.

## Send boundary

The shared marketing email sender performs fresh tenant-scoped checks **after queue waits and before each provider attempt**, including explicit rate-limit retries. This covers direct/scheduled broadcasts, selected failed-recipient retries, automation email steps and marketing compose. Test previews retain their existing synthetic-recipient behaviour; non-marketing correspondence and SMS are unchanged.

Checks require a current contact with explicit/implied consent, no do-not-contact tag, and unchanged email address/unsubscribe token. Recorded signed bounce, complaint or suppression evidence also blocks sending. Reads fail closed. The final contact read follows suppression checks. A refusal returns a clear “Marketing email not sent” error, not a claim of uncertain provider acceptance, and does not write a sent activity. Broadcasts record the failed row; automation runs use their existing failed-send handling. There is no automatic retry of these refusals.

The same per-process queue, minimum 600ms provider-start spacing, bounded explicit-429 retry policy, immutable payload/idempotency key, selected-recipient claim and accepted-result preservation remain in place. A blocked check releases the queue for subsequent independent work.

Limits: checking and the remote provider request cannot be one atomic transaction; withdrawal after the final read cannot recall an accepted email. Suppression checks use the existing broadcast evidence ledger, not a newly synchronized provider-wide list. Automation/non-broadcast events and not-yet-associated early webhook events may not be available there; Resend still enforces its own suppression rules. No new API permissions, secrets, schema, provider configuration or attribution-token system were introduced.

## Verification

- 121 mocked/unit/component tests pass, including queue withdrawal, 429-backoff withdrawal/suppression, changed address/token, missing contacts, unavailable reads, tenant predicates, stable payload/key, queue recovery, count deduplication, chunked contact reads, unknown dates, reconsent, filter intersections and manual-outcome preservation.
- TypeScript and production Next.js build pass. The build needed network permission for the existing Google Fonts dependency.
- Full lint retains the pre-existing 26 errors / 29 warnings; no additional findings.
- Actual production recipient component exercised in the isolated Vite fixture with cached Playwright/Chromium, desktop 1440px and mobile 390px. Summary, timezone date, unknown date, filter intersection/reset and Contacts-link propagation pass; no page errors. All fixture actions and sends are mocked; non-localhost requests blocked.
- Local screenshots: `/tmp/flowcrm-unsubscribe-desktop.png`, `/tmp/flowcrm-unsubscribe-mobile.png`. Browser harness: `/tmp/flowcrm-unsubscribe-browser.cjs`; reusable fixture: `tests/browser/`.
- No real sends, live campaign/consent edits or schema writes were performed. Production authenticated UI has not been verified for this candidate because it is not deployed.

## Release plan

Review this scoped commit on `feature/resend-engagement`, approve deployment, then deploy the exact reviewed SHA using the existing Vercel project. No migration, new secrets or provider setup is required. Verify the production Recipients summary/filter/date and Contacts-link handoff read-only. Do not send a test or campaign as a release check without separate approval. Rollback is the prior v0.9.8 deployment; no data rollback is needed. Main remains unmerged.
