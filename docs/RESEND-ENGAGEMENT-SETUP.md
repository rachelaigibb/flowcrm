# Resend broadcast engagement — local release candidate

October 5, 2026 · v0.9.6 candidate · branch `feature/resend-engagement`, based on `5e8f767`.

## Implemented locally

- `POST /api/webhooks/resend` verifies the **raw** body with the installed Resend SDK, including timestamp/replay checks. Missing configuration returns 503, bad signatures/payloads return 400, database failures return 503 for provider retry. Acknowledgement follows durable insertion.
- Signed send tags identify an existing FlowCRM broadcast/contact snapshot before its provider ID is saved. Legacy untagged events are accepted only when their provider ID already belongs to a FlowCRM email broadcast. Unrelated account mail is ignored. No new email or provider API call is needed to verify a signature.
- Migration `00022_resend_engagement.sql` adds an append-only event ledger keyed by `svix-id`, with provider-message indexing and RLS through existing tenant-scoped email recipients. Duplicate events cannot overwrite stored evidence. A unique recipient provider-ID index prevents one message being assigned to multiple recipients. Anonymous/users cannot write events; service role can only insert/read this ledger.
- Reads associate events by provider ID, so early events become visible after send-result persistence without a queue, cron, or race-prone reconciliation. Database failures remain visible errors. Paginated reads avoid silently capped recipient/event totals.
- Reports derive delivery, issues, unique clickers, unique links per recipient, and first/latest click times from immutable evidence, independent of arrival order. Send-loop stats remain acceptance/failure counts and no longer write `opened: 0`. Delivery/click evidence survives send completion because it is not in those stats.
- Campaign recipients filter by delivery/click evidence, link text, send status and manual outcome. Filtered visible selections use the existing dated-task/manual-outcome/follow-up-draft actions. Contacts preserves engagement/link filters; contact detail shows campaign evidence and links. Event timestamps use workspace timezone.
- Fixed selected-recipient draft subject/body fields being disabled. The fixed audience remains locked and consent is rechecked by the existing sending workflow.
- Opens remain disabled. No-event/history gaps remain unknown; no unread/not-interested label or inferred human intent. A click can be a scanner. Delivered means receiving-server acceptance, not inbox placement or reading. Reply/interested outcomes remain manual. No automatic suppression/consent mutation or follow-up send is added.
- Stores only event ID, message ID, event type, provider time, clicked URL and receipt time. No IP, device/user-agent, email body, recipient address or raw webhook payload. Signed tags are used for scoping but not retained in the ledger. Existing URLs may contain personal query tokens; RLS protects them and the route does not log payloads/links.

## Verified locally

- TypeScript passed; 59 Vitest tests passed at this checkpoint (including signature tampering/stale replay, durable acknowledgement, unrelated-event rejection, early matching, duplicate/out-of-order handling, unknown history, and fixed-audience draft editing).
- Production build passed after allowing access to the existing Google Inter font. Existing middleware-to-proxy deprecation warning remains.
- Full lint: baseline `main` has 27 errors / 29 warnings; candidate has 26 errors / 29 warnings. Exact file/rule/severity comparison: no added issues; one existing recipient-list effect error resolved. Unrelated baseline errors remain a release-check limitation.
- Isolated PGlite PostgreSQL verification passed migration syntax, early matching, duplicate immutability, tenant isolation, anonymous/client-write denial, append-only service permissions, provider-ID uniqueness and manual-outcome preservation. This uses a minimal synthetic baseline, not the production schema or a migration applied to production.
- In-app browser verified the real components in `tests/browser`: clicked filter, selected visible recipients, clicked URL expansion, Vancouver timestamps, unknown history, editable selected-recipient subject/body and locked audience. All fixture writes/sends are stubbed. The first fixture load exposed an incomplete action stub; fixed and rechecked. This is component/browser proof, not authenticated live-data proof.
- Built Next app login loaded locally. Logged-out POST to `/api/webhooks/resend` returned JSON 503 `Webhook not configured`, without redirect. No webhook secret was set.

Reproduce unit checks: `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

Browser fixture: `node node_modules/vite/bin/vite.js --config tests/browser/vite.config.mts` then `http://127.0.0.1:4173`. No route is added to the production app for this fixture.

Isolated SQL check: install `@electric-sql/pglite` into a temporary directory outside the project, then `PGLITE_MODULE=/tmp/flowcrm-db-verify/node_modules/@electric-sql/pglite/dist/index.js node tests/features/broadcasts/engagement-db.mjs`. No production dependency was added. Supabase CLI was unavailable in this environment; migration follows the repository's established numbered-file convention.

## Pending production work — explicit approval required

1. Review this candidate and approve applying migration 00022 and deploying the feature branch. Before migration, check for duplicate non-null `broadcast_recipients.provider_id` values; resolve only on reviewed evidence, never delete history to make the index pass. Apply/record the migration using the project's existing one-transaction procedure, then verify actual grants/RLS. Manual TypeScript interfaces are updated; production type regeneration was not performed.
2. After action-time confirmation, create a Resend webhook pointing to `https://crm.getflowplan.app/api/webhooks/resend`. Subscribe to `email.sent`, `email.delivered`, `email.clicked`, `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed`, `email.suppressed` — **not** `email.opened`.
3. Rachel privately enters the endpoint signing secret as sensitive **Production** `RESEND_WEBHOOK_SECRET` on the existing Vercel FlowCRM project. Placeholder documentation only: `RESEND_WEBHOOK_SECRET=<enter privately in Vercel>`. Do not paste it into chat or commit it. The route reuses the existing production-only `SUPABASE_SERVICE_ROLE_KEY`; no new API key or expanded persistent account access is needed. Production secrets are not retrieved/copied locally.
4. Deploy through the existing Vercel CLI workflow after the migration and environment value are ready. Keep clicks ON and opens OFF for `rachelgibbrealtor.com`; DNS/tracking setup was supplied as already verified by the parent, not reconfigured here. Do not push/merge/deploy without the requested release approval.
5. Verify Ready, webhook retry/error visibility, RLS with actual workspace identities, and authenticated campaign/contact UI. Provider dashboard synthetic messages without a matching campaign are deliberately ignored. A complete real-email/click test needs separate approval for its exact recipient/send, or use a subsequently authorized campaign. Replay stored delivery events only if approved and available; historical missing clicks cannot be reconstructed.
6. If setup is incomplete, UI read errors must not be reported as zero engagement. New events can be replayed after transient storage failures. There is no automatic cleanup/retry sender. Retain minimal unmatched early events to avoid losing delayed persistence; future retention changes require a reviewed policy. Rollback app code if needed; preserve the ledger/history and disable the webhook only with approval.

No production migration, webhook creation, signing secret/key configuration, real message, broadcast schedule, push, merge, commit or deployment was performed by this task. Pre-existing `AGENTS.md` edits are untouched.

References: [Resend signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests), installed `resend` event types/SDK, installed Next.js route-handler documentation, [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## October 5 release authorization and preflight

Rachel approved feature-branch commit/push, production migration, CLI deployment and Resend webhook creation. Secret entry remains a private user handoff; no email is authorized. Remote main still matches 5e8f767; production database target verified as jsnufxpzeuoybgksgnon, migration 00021 latest, 10 recipient rows, zero duplicate provider-ID groups, no existing event ledger. Existing Vercel production remains Ready. Connector team access returned 403; the existing approved CLI token successfully verified team/project deployments without credential disclosure.
