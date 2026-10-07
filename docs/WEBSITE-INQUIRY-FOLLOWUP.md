# Vancouver website inquiry follow-up — local release candidate

October 7, 2026. Approved internal workflow for Command Center `re-lead-route`. **Not configured or deployed in production.** Production remains v0.9.9. No live form submission, email, consent edit, task creation, migration or configuration write was performed.

## Discovery and scope

Native configuration cannot meet the requirements: intake only queues `contact_created` automation for newly created contacts; existing contacts are missed. Native `create_task` sets no due date, assigns the executing user rather than a configured owner, and lacks per-inquiry replay protection. The website previously supplied no event ID. Its route could report success even when CRM persistence failed.

Read-only current checks: Vancouver workspace `060de0c6-8d30-4cfc-be60-2fcbdebab042`, organization `ce925b6d-692d-4820-b7fd-caa14ccbe540`, timezone America/Vancouver. The only automation (`new contact notification`) is disabled. No follow-up setting is enabled. Public .ca/contact and FlowCRM /api/intake GET both returned 200; these do not prove authenticated intake delivery. Historical intake sources include contact-form and deal-list, with key label rachelgibbrealtor.ca.

Candidate choices, explicitly reported for review:
- **One task per genuinely new contact/property inquiry**, even from an existing contact or one with an open task. Same-ID retries never create another task, activity or contact. Same ID with different content is a conflict.
- Only the configured Vancouver workspace and existing `.ca` intake key label qualify. Exact contact-form source and property- source prefix qualify. Imports, Dubai, Deal Sheet signups and valuation-report requests do not qualify. The optional scope question was unanswered; this is the narrow contact-response-promise interpretation, not a claim that valuation follow-up was declined.
- The selected assignee ID `362192e1-4db4-4d4b-97ef-4cdd39c7c7ef` is the sole organization owner. Its display-name fields were blank. **Confirm in authenticated settings that this is Rachel before activation.** Automatic approval review rejected private auth-email retrieval as unnecessary; no email/credential was retrieved for this lookup.

## Business-day definition

Tasks are due at **5 p.m. America/Vancouver on the next business date** after receipt. Business dates are Monday–Friday excluding all 11 BC statutory holiday dates. Friday October 9, Saturday October 10 and Thanksgiving Monday October 12, 2026 are due Tuesday October 13 at 5 p.m. An after-hours inquiry is also due the next business date. This is a next-business-date promise, not an eight-working-hour stopwatch.

The calendar covers New Year’s Day, Family Day, Good Friday, Victoria Day, Canada Day, BC Day, Labour Day, National Day for Truth and Reconciliation, Thanksgiving, Remembrance Day and Christmas. Easter Monday and Boxing Day are not BC statutory holidays. No additional office closure/substitute day is assumed: BC substitutes require agreement. Review this policy if Rachel observes extra closures or legislation changes. Time conversion uses the database’s America/Vancouver timezone data.

Source checked: [BC statutory holidays, 2026 and 2027](https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/statutory-holidays). The 5 p.m. deadline and narrow form scope are implementation assumptions reported before publication, not additional user-confirmed business hours.

## Implementation

FlowCRM migration `20261007220056_website_inquiry_followups.sql` adds a private receipt table and business-date helpers, and extends the existing key-authenticated intake transaction. Existing endpoint credentials and access boundary remain unchanged; no new service client, key, grants to read private receipts, or background job. Receipt RLS is enabled and direct anon/authenticated access denied. The existing intake function creates contact/activity/task/receipt atomically. Task failure rolls everything back. Advisory locks serialize same-ID retries and same-workspace/email creation; the receipt primary key persists replay protection. No historical backfill.

Rules are opt-in in existing workspace settings. The migration enables nothing. Qualifying inquiry intake creates the task directly and skips generic contact-created automation enrollment. Existing consent capture is unchanged; the workflow itself sends no client message or marketing enrollment. Existing internal intake notifications continue for first acceptance, not accepted retries. The receipt stores only IDs/hash/timestamps, not raw message/IP/device data. Task description points to the inquiry activity, preserving the original message in its existing timeline location. Deleting/completing a task does not permit a retry to recreate it.

Website companion: isolated worktree `/tmp/rachelgibb-inquiry-ids`, branch `feature/inquiry-submission-ids`, candidate `f6037a6423e270274a2d22c2a28e58f8ea98c492`, based on `3e58395`. Actual LeadForm generates one UUID per payload and retains it across unchanged retries within that form instance. Changed content gets a new ID. The website endpoint requires it for contact/property inquiries; stale forms must refresh. The CRM adapter forwards it and suppresses duplicate fallback notifications. Identified inquiries cannot fall back to the legacy contact-only writer. Unconfirmed CRM delivery returns 503 so the form can retry the same ID. A fresh page load is a new form instance, not a durable cross-browser inquiry identity; intentionally submitting again creates another inquiry. No content/time-window guesses collapse distinct inquiries.

## Verification

- FlowCRM: 129 Vitest tests including the optional cross-repository website contract checks; TypeScript and production build pass. Full lint stays at baseline 26 errors / 29 warnings.
- Isolated PGlite SQL suite passes real function/table/transaction checks: fresh/existing contacts; same-ID replay and changed-payload conflict; task rollback; scoped sources/workspaces/assignees; disabled configuration; no retrospective tasks or inquiry automation enrollment; receipt access denial; all 11 official 2026 holidays and Vancouver date/year boundaries. PGlite runs one connection; production concurrent advisory-lock behavior is structurally reviewed, not a multi-connection load test.
- Website candidate: TypeScript, targeted lint, and production webpack build pass with no copied .env secrets. Local Chromium ran the actual LeadForm and proved unchanged retries reuse UUID and changed content gets a new UUID. All form requests were intercepted and external network blocked.
- Reproduce: `CA_INQUIRY_WORKTREE=/tmp/rachelgibb-inquiry-ids npm test`; `PGLITE_MODULE=/tmp/flowcrm-db-verify/node_modules/@electric-sql/pglite/dist/index.js node tests/features/intake/followup-db.mjs`. Website fixture instructions are in its `tests/browser/` files.
- No assertion of live end-to-end task creation is made.

## Required publication steps (not yet authorized for execution)

1. Confirm Rachel’s assignee identity and the proposed form scope/deadline; review both repository commits. Preserve unrelated changes and v0.9.9 rollback deployment.
2. Approve and apply **only** this additive FlowCRM migration, initially with the rule absent/disabled. Verify migration history, receipt RLS/grants, function owner/search path and existing intake-key boundary. Existing project types are manually maintained; the changed intake response is typed in `notify.ts`. Generate/reconcile database types from the target after migration without replacing unrelated manual interfaces blindly.
3. Deploy the exact reviewed FlowCRM API candidate, then the `.ca` submission-ID companion from clean worktrees. Existing intake configuration must be present; do not configure/retrieve new credentials. Verify project/alias/SHA and public GET health. With the rule still disabled, no new follow-up task is created.
4. Activate only the Vancouver rule below, preserving all other workspace settings, then read back just the rule fields. Configuration authority is approved, but activation is intentionally held until schema/code publication and assignee checks are complete.
5. Verify end-to-end on the **next genuine inquiry**, read-only: `.ca` source and submission ID → correct Vancouver contact/activity → exactly one task assigned to Rachel → correct business-day due date. No test form submission or real email is authorized. If a controlled test is needed instead, request explicit authorization first. Only then may `re-lead-route` be closed. Local tests/configuration alone are insufficient.

Proposed rule (no secrets):
```json
{"enabled":true,"assigned_to":"362192e1-4db4-4d4b-97ef-4cdd39c7c7ef","key_labels":["rachelgibbrealtor.ca"],"sources":["rachelgibbrealtor.ca:contact-form"],"source_prefixes":["rachelgibbrealtor.ca:property-"]}
```

Set this under `settings.intake.follow_up` only for the verified Vancouver workspace, merging rather than replacing `settings.intake` (which holds existing notification settings). Do not enable generic contact-created automation. Rollback: disable this rule first, preserve receipts and already-created tasks, then revert application deployments if required. Do not drop receipt history or mass-delete tasks. If a receipt was accepted before activation it remains accepted without a task on replay; this prevents a retrospective flood.
