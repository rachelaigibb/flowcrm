# FlowCRM — Development Handoff

**Written:** 2026-10-02 by Claude Code, for a new Codex session continuing development and fixes.
**State at handoff:** v0.9.0 live at https://crm.getflowplan.app, `main` = `9327268`, pushed. Production deploy ● Ready. The scheduler last succeeded 2026-10-02 15:15 PT with no error.

This file is the starting point. It does not replace `.claude/CLAUDE.md`, the architecture decision log, or `docs/BUILD-STATUS.md`. Read those too. Contains no secrets.

---

## 1. Read first, in this order

1. `AGENTS.md`: Next.js 16 warning, the Codex bridge, and the AIOS writeback routine (`/Users/rachelgibb/Projects/my-AIOS/references/cross-project-maintenance.md`).
2. `.claude/CLAUDE.md`: architecture rules and dated decision logs. The last two logs are the most relevant: 2026-09-22 (unsubscribe) and 2026-09-23 (scheduler). It says "Next.js 15"; the app actually runs **Next.js 16** (`proxy`/middleware, no `dynamic` segment config in the bundled docs). Check `node_modules/next/dist/docs/` before using any Next API.
3. `docs/BUILD-STATUS.md`: what shipped, version history, and what is not started.
4. `docs/USER-GUIDE.md`: Rachel-facing behaviour. Keep it accurate when behaviour changes.

## 2. Current direction (confirmed by Rachel, latest wins)

- **FlowCRM is for Rachel's internal use only.** Sales and client installs were shelved on 2026-09-28. Drop anything framed as "before the first paying install". Multi-tenant code and RLS stay as built; no new selling or licensing features.
- **Vancouver first.** The Dubai licence (BRN) is inactive. Client-facing text must never show the BRN. Signature line: `Greater Vancouver | Dubai | BCFSA Licence #182674`.
- **Real estate voice rules apply to any client-facing copy** (templates, broadcasts): no exclamation points, banned-word list, data-led. The app UI itself stays neutral SaaS (shadcn neutral theme, not the gold/black brand).
- **Never auto-send client-facing messages.** Drafts are written for Rachel to review. Sending, scheduling a real send, or enabling an automation that emails real contacts needs her explicit OK each time.

## 3. Environment and access

| Thing | Where / how |
|---|---|
| Repo | `github.com/rachelaigibb/flowcrm`, branch `main`. **Not Git-connected to Vercel**: pushing is a backup only. |
| Hosting | Vercel Pro team `rachelgibb` (`team_KT5JgsyfIWVu1ob63q2OyJ4R`), project `flowcrm` (`prj_J266tCuMOqTt6ErARufcVkVRcdYS`). |
| Deploy | `export VERCEL_TOKEN=$(grep -E '^VERCEL_TOKEN=' ~/Projects/rachelgibbrealtor.ca/.env.local \| cut -d= -f2- \| tr -d '"'"'"' ')` then `npx vercel deploy --prod --yes --scope rachelgibb`. Verify with `npx vercel ls flowcrm --scope rachelgibb` (● Ready) plus a live probe. Never print the token. |
| Database | Supabase `jsnufxpzeuoybgksgnon` (ca-central-1). Run SQL with `/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL"`, sourcing **only** that line from `.env.local` (`source <(grep -E '^SUPABASE_DB_URL=' .env.local)`). Never echo it. |
| Migrations | `supabase/migrations/000NN_name.sql`, latest `00020_scheduler.sql`. Apply in one psql transaction, then `INSERT INTO supabase_migrations.schema_migrations (version, name)` (latest recorded: `20260923100000 scheduler`). `src/types/database.ts` is **hand-maintained**; edit it alongside the migration. |
| Vercel-only secrets | `SUPABASE_SERVICE_ROLE_KEY` (saved by Rachel), `CRON_SECRET` (generated straight into Vercel, never seen). Neither exists in `.env.local`, so the cron route cannot run locally. Do not try to fetch or copy them. |
| Other env (names only) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`. Twilio is not configured. |
| Listing env names safely | `grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' <file>`. **Do not** use `awk -F= '{print $1}'`: it printed a whole bare-token line on 2026-09-23. |
| Vercel CLI | v54 installed (latest 62). It works; an upgrade is optional. |

**Workspaces (sub-accounts), org `ce925b6d-692d-4820-b7fd-caa14ccbe540`:**

| Workspace | id | timezone | Notes |
|---|---|---|---|
| Vancouver Real Estate | `060de0c6-8d30-4cfc-be60-2fcbdebab042` | America/Vancouver | Live data: 165 contacts, 51 won deals |
| Testing | `2e1b30b5-cf02-4f93-832f-1924a564b232` | America/Vancouver | Copy of the Vancouver import. Always run new campaign logic here first |
| Dubai Real Estate | `5a8aea9f-8cda-4f56-8f27-261ffff75313` | Asia/Dubai | 9 contacts from website intake |
| FlowPlan | `552c1d49-abc5-4b38-b185-a969e11fa62f` | America/Vancouver | Created 2026-09-27 outside this log. Confirm its purpose with Rachel and keep FlowPlan data separate from real estate (cross-brand firewall) |

## 4. Architecture map (where things live)

- **Messaging:** `src/lib/messaging/send.ts` (`sendEmailToContact`, `sendSmsToContact`, `renderTemplate`, `getEmailSettings`), `html.ts` (HTML + signature + CASL footer), `unsubscribe.ts` (URL + List-Unsubscribe headers). `marketing: true` = footer + headers; `includeSignature: false` for broadcasts; `skipActivity` only for test sends.
- **Broadcasts:**
  - `src/features/broadcasts/deliver.ts` (plain module): `checkBroadcastReady`, `getBroadcastRecipients`, and `deliverBroadcast`, which includes the atomic claim.
  - `actions.ts` (`"use server"`): CRUD, `sendBroadcast`, `scheduleBroadcast`, `unscheduleBroadcast`, `sendBroadcastTest`, `getRecipientCount`.
  - Editor: `components/broadcast-editor-page.tsx`.
- **Automations:**
  - `src/features/automations/engine.ts`: `triggerAutomations`, `executeAutomationRun` (paused → running claim; consent check on email), `processDueAutomationRuns` (per workspace, on page load).
  - Triggers: `contact_created`, `tag_added`, `deal_stage_change`, `form_submission`, `manual`.
  - Steps: `send_email`, `send_sms`, `wait`, `add_tag`, `remove_tag`, `create_task`.
- **Scheduler:**
  - `vercel.json` cron `*/5 * * * *` → `src/app/api/cron/tick/route.ts`. The route checks Bearer `CRON_SECRET` and is the **only** importer of `src/lib/supabase/service.ts`.
  - The route calls `src/features/scheduler/tick.ts` → `runSchedulerTick`: due scheduled broadcasts (5 per tick), then due paused runs (50 per tick), 240 s budget, attributed to the org owner.
  - Heartbeat: `system_jobs` row `scheduler_tick` → `src/features/scheduler/status.ts` + `components/scheduler-status-line.tsx`, shown under the Automations and Broadcasts titles.
  - **New timed work goes inside `runSchedulerTick`, not into a second cron.**
- **Unsubscribe:** `/u/[token]` page and `POST /api/unsubscribe/[token]`, through SECURITY DEFINER `unsubscribe_lookup` / `unsubscribe_contact` with the anon client (`src/lib/supabase/anon.ts`).
- **Website intake:** `POST /api/intake` → SECURITY DEFINER `intake_contact(p_key, p_payload)`, with per-workspace hashed keys (`intake_keys`).
- **Documents:** private `documents` bucket, `/api/documents/[id]` → 2-minute signed URL.
- **Public pages** must be allow-listed in `src/lib/supabase/middleware.ts` (`/f/`, `/u/`; `/api` is already open). Probe each logged out with curl; 307 means blocked.

## 5. Invariants (breaking these caused real bugs)

1. **Claim before you send.** Any work reachable by both the cron tick and a user action must be claimed with a conditional update that returns the row (`.eq('status','paused')…select('id')`). No row back means stop.
2. **Marketing consent** = `consent_status IN ('explicit','implied')`. Every marketing recipient query selects `unsubscribe_token`. Unsubscribed = `withdrawn`. Rachel decided on 2026-09-22 against any consent-refresh campaign; do not raise it again.
3. **Name the FK on deals → contacts embeds**: `contact:contacts!deals_contact_id_fkey(...)` (deals has two FKs to contacts). Check FKs in the **live** DB, not a schema file.
4. **Never export non-functions from a `"use server"` file.** Shared logic goes in plain modules (as `deliver.ts` does).
5. **Never trust client-side org/sub-account ids.** Derive them from `getUserContext()`. The service client appears only in the cron route.
6. **No raw SQL in components.** psql is for migrations and reviewed data loads only.
7. **Deals are numbered by the `assign_deal_number` trigger.** Never number them in app code.
8. Do not delete files, DB rows, Vercel projects or DNS without Rachel's explicit confirmation in the moment. Move files to `_archive/` (git-ignored) instead.

## 6. Open items

### A. Security: do these first (AIOS task `re-credential-review`)
1. **Update 2026-10-02: Rachel confirms Vercel token rotated; old-token revocation is reported by her confirmation, not independently inspected.** Previous finding: On 2026-10-02 `~/Projects/rachelgibbrealtor.ca/.env.local` still had one malformed line: the bare duplicate of the token that was exposed in a Claude session on 2026-09-23. Ask Rachel whether she rotated it.
   - Rotation steps: Vercel → Account Settings → Tokens → create `claude-cli-2026-09` (scope `rachelgibb`) → she replaces the `VERCEL_TOKEN=` value on line 1, deletes the bare line 2 and the empty line 15 → she deletes the old token.
   - Then run one deploy check. Do not read or print token values.
2. **Old Dubai intake key `dubai-sites` (prefix `fk_Pjdjn`) is still active**, last used 2026-09-10. The live key is `vercel-pro` (`fk_rtmX2`), used 2026-09-23 by the rachelgibbrealtor.com form.
   - buyingindubai.com has **not** yet been tested end to end on the new key.
   - Sequence: Rachel submits a test on buyingindubai.com/contact → confirm a contact note with source `buyingindubai.com:contact-form` and tag `buyingindubai-com` in Dubai → then Rachel revokes `dubai-sites` in Settings → Website Intake.
3. **`.ca` still carries `FLOWCRM_SUPABASE_SERVICE_KEY`** in its `.env.local` (legacy from before `/api/intake`). Check whether the `.ca` code still reads it. If not, propose removing it there and on its Vercel project. That work belongs to the `.ca` repo.

### B. Rachel's sends (her action; no code needed)
- Two Vancouver drafts are still **unsent**: "Market update — October 2026" (tag `sphere`, 61 eligible on Sep 22) and "Deal Sheet — Friday" (tag `deal-list`). Their signature lines were corrected to BCFSA on 2026-10-02. Both still contain [bracketed] placeholders.
- The AIOS plan now tracks this as `re-market-email` (due 2026-10-16: current primary-source data, consent and unsubscribe checks, then ask for send approval) and `re-deal-funnel-review` (due 2026-10-13).
- By mid-October, GVR's September stats are out. Credit GVR as the source (BCFSA advertising rules).

### C. Deferred 2026-10-02: date campaigns (version to be assigned) (spec confirmed by Rachel 2026-09-22/23)
Run in **Testing first**, then ask before enabling in Vancouver.
- **Birthday:** every contact with `birthday`, an email, and explicit/implied consent. Send at **09:00 in the workspace `sub_accounts.timezone`**.
  - Data today: 54 Vancouver contacts have a birthday; 37 are eligible.
  - 13 known birthdays are still missing from the import; that's a data gap, not a code task.
- **Closing anniversary:** from won deals' `closed_at`, **every year** (admin may restrict which years). **Buyers and sellers get separate templates.**
  - Buyer copy is about the home. Seller copy checks in on where life took them.
  - If the same person sold and bought within one month, send only the buyer email.
  - `deals.side` values: buyer 62, seller 38, tenant 2 (tenants are excluded unless Rachel says otherwise).
- **Mechanics:**
  - Add the new trigger types (the `automations_trigger_type_check` CHECK needs a migration).
  - Add trigger config: offset days, send hour, years, side.
  - Add merge fields `{{years}}`, `{{property_address}}`, `{{city}}`, `{{closed_year}}`.
  - Evaluate in `runSchedulerTick`.
  - **Idempotency:** a unique period key per contact/automation (e.g. `birthday:2026`, `anniversary:<deal_id>:2026`) in a new table with a UNIQUE constraint, inserted before sending (insert = claim).
  - Seed three **disabled** default automations per workspace (birthday, buyer anniversary, seller anniversary).
  - Draft the Vancouver templates in Rachel's voice for her approval. Never enable them yourself.
- **Leap-day birthdays:** decide Feb 28 vs Mar 1 and document it.

### D. Later (re-confirm priority with Rachel; internal use changes the calculus)
- Quarterly area updates, segmented by the city of the client's won deal. Sources: the GVR stats package (Vancouver) and Property Monitor (Dubai). Claude/Codex drafts, Rachel approves.
- Zoom events (v0.10). Registration on her own page posting to `/api/intake` with an event tag, Eventbrite by webhook, LinkedIn by CSV. Reminder sequence: confirmation, 1 week, 1 day, 1 hour, join-now, follow-up within 24 h, separate attended/no-show paths. Each new public page goes on the middleware allow-list.
- Gmail BCC logging address (Resend Receiving, needs Resend Pro). Google Calendar sync is parked.

### E. Known technical gaps (fix when touching the area)
- A run left in `running` after a crash, or a broadcast left in `sending` after a timeout, is never retried or surfaced. Consider a stale-claim sweep in the tick (e.g. `sending` with no stats update for 30 min → `failed` with a reason) that never re-sends automatically.
- `getRecipientCount` (actions.ts) duplicates the filter logic in `getBroadcastRecipients` (deliver.ts). Unify them.
- Broadcast schedule times display in the browser's timezone, not the workspace timezone.
- `tag` filters build the PostgREST `or()` string by joining raw tag names. A tag containing `,`, `{` or `)` would break it. Sanitise or quote.
- One-to-one send loops run inside a server action / the tick. That's fine for hundreds of recipients; thousands would need a queue.
- `.claude/CLAUDE.md` says "Never bypass RLS with service-role client except in Edge Functions for webhooks". The 2026-09-23 log supersedes this for the cron route only. Keep that exception narrow.

### F. Test data left on purpose (delete only with Rachel's OK)
- In Testing: contact `delivered@resend.dev` (Resend's sink, tags `scheduler-test` and `scheduler-ok`), broadcast "Scheduler test v0.9.0" (sent), enabled manual automation "Scheduler test v0.9.0" (an add-tag step), and an email sender set on Testing (`info@rachelgibbrealtor.com`).
- Older items: contact `intake-selftest@example.com` and the active intake key `intake-selftest` (`fk_test_`).

## 7. Dead ends and gotchas (do not repeat)
- **Removing a domain before re-adding it on another Vercel team** took the CRM offline. Use the `_vercel` TXT verification route instead.
- **Vercel "Sensitive" variables cannot be read back.** Moving accounts means rotating keys at their source.
- **Vercel Pro can block CLI deploys** with `seatBlock TEAM_ACCESS_REQUIRED` (commit author not a team member). A retry worked; it is not deterministic.
- **To deploy with uncommitted local changes present**, use a clean `git worktree add --detach <tmp> main` with `.vercel/project.json` copied in.
- **zsh:** never name a loop variable `path`. There is no `timeout` command. `for x in $var` does not word-split.
- **TS2589 ("Type instantiation is excessively deep")** comes from reassigning a supabase-js query through a ternary. Use if/else.
- **`SET search_path = public` in SECURITY DEFINER functions hides `extensions.digest`.** Use `sha256(convert_to(...))`.
- **A local git remote can be stale:** the investor portal repo is now `rachelaigibb/dubai-property-portal`. Check GitHub or DNS or the live DB before "correcting" any recorded fact.

## 8. Definition of done (every change)
1. `npx tsc --noEmit`, `npm run test` (24 tests on 2026-10-02) and `npm run build` all pass.
2. Migration applied and recorded; `src/types/database.ts` updated.
3. `docs/BUILD-STATUS.md` (shipped section + version row), `docs/USER-GUIDE.md` if behaviour changed, `package.json` version bumped, and a dated `.claude/CLAUDE.md` decision-log entry for architectural choices.
4. Commit only your own changes. `AGENTS.md` had uncommitted edits made outside this log on 2026-10-02 (the AIOS writeback section); leave them for Rachel. Then push, CLI-deploy, confirm ● Ready, and probe the changed route live (logged out for public pages).
5. Report outcomes plainly, including anything skipped or unverified.
6. Then follow the AIOS writeback routine: update the relevant command-center tasks through `python3 command-center/manage.py` from `/Users/rachelgibb/Projects/my-AIOS`. Read first, pass `--version`, and include evidence. Relevant IDs: `flowcrm-internal`, `re-credential-review`, `re-lead-route`, `re-market-email`, `re-deal-funnel-review`, `flowcrm-codex-setup`. Never write tasks to the old Claude artifacts.

## 9. Working with Rachel
- She is learning. Give numbered step-by-step instructions with a short "why", and runbooks rather than option menus.
- She pastes keys herself. Never ask her to paste a secret into chat, and never write one to a file.
- She wants a plan before multi-step work, unless she has explicitly waived it for that job.

## October 2 v0.9.1 scope update
Rachel approved email merge fields, attachment selection/removal, Vancouver-only mailing address and marketing footers, bounded email/note dialogs and five-line expandable timeline entries. Date campaigns are deferred. See BUILD-STATUS and USER-GUIDE for current behavior. No client campaign was sent.

Production v0.9.1 deployed October 2 at 16:43 PT from code commit `8505228`; Vercel independently reports ● Ready (`dpl_AQQk1hxh2cvV29PKLP6QeixDW9a7`), https://crm.getflowplan.app. Rachel explicitly authorized the rotated token from the .ca folder. Token value was kept out of logs and files. See BUILD-STATUS for verification limits; actual inbox attachment receipt still needs an attended test before the developer campaign.

October 2 v0.9.2 follow-up: test-send spinner report investigated. Testing contact consent None and no workspace mailing address block marketing. Reproduced validation completed without sending; errors were transient toast-only. Compose now displays persistent inline errors, releases request state in finally, and preserves drafts on transport rejection with an uncertain-delivery warning. No auto-retry or consent bypass; no test email sent by Codex. Exact original attempt remains unconfirmed.

v0.9.2 production confirmed Ready: dpl_8666qTdRvDMZygRGyu28kareBS9K, code 8951d06, https://crm.getflowplan.app. Live native check verified persistent consent error and released Send without delivery.

October 2 v0.9.3: attachment-only hangs reported, text-only email success observed in Testing. Found 10 MB app allowance exceeds Vercel incoming 4.5 MB cap. Email attachments now upload directly to signed private storage and the send action receives scoped references, verifies actual size and downloads provider bytes. Explicit upload stages and two-minute timeout; no auto-retry. Actual original attachment size and live inbox attachment receipt remain unverified. Documents-card upload is unchanged.

v0.9.3 production ● Ready independently verified: dpl_EvLPUMCNioipo5MbdP9xRKNZdLUM, code 08ea395. Public preview 200. Mac lock prevented native synthetic 5 MB upload check; user unlock requested. Live attachment delivery remains unverified. Synthetic file prepared at /private/tmp/flowcrm-attachment-5mb.txt; no upload performed yet.

October 2 resumed live verification after unlock: synthetic flowcrm-attachment-5mb.txt selected in native compose (visible name, size and remove button), uploaded successfully through the new path. Read-only storage.objects query verified 5,242,881 bytes under Testing/current contact/user scope. Compose returned the expected missing-workspace-address marketing error, retained draft and re-enabled Send. No delivery attempted; canceled synthetic draft. Synthetic private object left in place (no deletion authorization). Actual recipient attachment receipt still unverified.

October 2 v0.9.4: native user's attachment draft exposed "An attachment has not finished uploading" after the upload step. Corrected Storage info response handling from metadata.size to top-level size, as declared by installed StorageFileApi/FileObjectV2. Prior test fixture incorrectly mimicked storage.objects SQL metadata, rather than the HTTP info response. Regression fixture now uses top-level size with empty custom metadata. Existing live 5 MB upload-only guard did not exercise file-info retrieval; actual inbox delivery remains unverified. User's draft remains open and intact; no send by Codex.

v0.9.4 deployed from 81aa6f8; independent Vercel inspection confirms ● Ready (dpl_4Ckcf3itB9xWv27k1n3rMfC9rF12), https://crm.getflowplan.app. Scoped storage readback confirmed user PDF was fully uploaded (200,667 bytes), so this attempt failed during info validation, not upload. 38 tests, TypeScript and build passed. Existing user draft left intact; no automatic retry or email sent by Codex.

## October 2 developer campaign import and runbook

User requested first-campaign instructions and import. Downloads v2 CSV was confirmed identical to the original campaign-folder v2 copy. Authorized import into Vancouver only: 178 new contacts, 178 research-note activities; source consent preserved. Readback confirmed 75 email contacts and 103 call-only contacts; wave tags 8/22/10/24 plus 11 brokers. No existing matches, no campaign sent or scheduled. See DEVELOPER-CAMPAIGN-RUNBOOK.md. Broadcasts have no attachment support; use checked package links or individual contact emails for PDFs. User confirmed the attachment test worked; inbox receipt is user-reported. AGENTS.md remains a preexisting user edit.

October 2 import correction: Rachel rejected developer records missing both email and phone. Removed only 29 such v2-import contacts and their imported research notes from Vancouver, after recovery backup and related-work guard. Verified 149 retained, 75 email, 74 phone-only, zero unreachable imported contacts. Original CSV preserved; cleaned v3 and recovery archive in Downloads. No re-import, sends or schedules. Future developer imports must omit rows with neither contact channel.

## October 3 broadcast tracking Stage 1 — v0.9.5
Rachel approved implementation. Recipient snapshots and per-contact results, Contacts broadcast/status filtering, contact timeline campaign links, idempotent dated follow-up tasks, outcomes, phone queue and selected-recipient follow-up drafts implemented. Migration 00021 applied/recorded 20261003215000; 2 historical successes recovered. Sent is provider acceptance; historical missing failures unknown. No real sends/tasks/schedules executed; SQL test fixtures rolled back. tsc, 42 tests and build pass. Stage 2 deferred. Existing AGENTS.md edits remain untouched.

Production v0.9.5 confirmed Ready October 3: code 68ab822 (Stage 1 implementation 17cbafd), deployment dpl_4JUsGwXdG8c3eQ6DQsfNKGEL2FxB, https://crm.getflowplan.app. Attended native Vancouver check verified clickable 1/1 recipient link, exact one-contact Contacts filter and contact timeline Broadcast link. No campaign sends or follow-up mutations performed. Opens show Not tracked. AIOS registry/wiki/task evidence saved; wiki structural check has no errors and three pre-existing unrelated source drifts (social-media-content, real-estate brief, WeddingFlow brief).

## October 5 Resend engagement — v0.9.6 local candidate, NOT deployed

Existing Codex FlowCRM grouping verified (`43a5fad3-acb5-4421-8712-be44536a3dae`), task `01a10dcb-0870-7314-99c2-7f01993cb00c`, branch `feature/resend-engagement` from `5e8f767`. Signed, scoped event intake; append-only RLS ledger; early/duplicate/out-of-order handling; delivery/click reporting and filters in campaign/recipient/contact UI; fixed-audience follow-up content editing repaired. Manual outcomes preserved; historical absence stays unknown; opens disabled. No actual sends or configuration changes. See [setup and verification](RESEND-ENGAGEMENT-SETUP.md) for architecture, checks, exact approvals and production steps. 59 tests, tsc, production build and isolated SQL checks passed; local synthetic browser verified. Lint retains baseline errors (26 vs 27 before, no new issues). Migration 00022, webhook/signing-secret setup, authenticated production proof, push/merge and release remain pending approval. Pre-existing AGENTS.md preserved.

## October 5 PT / October 6 UTC — production release, secret entry pending

Rachel explicitly approved commit/push, migration, deployment and webhook creation. Commit `6f4cb45244f255c0611469ec0343f40f4dc9b4f4` is verified on remote `feature/resend-engagement`; main was not merged. Migration 00022 applied atomically and recorded as `20261006000005 resend_engagement` on existing Supabase `jsnufxpzeuoybgksgnon`. Preflight: 10 recipient rows, no duplicate provider IDs or prior ledger. RLS/grants verified; production transaction proved member visibility, unrelated-identity isolation and write restrictions, then rolled back (zero retained test events).

Clean revision deployed Ready as `dpl_Bcvh6qs3MLncq5C3jE7k5qvHkVnv`, https://flowcrm-hj2sgh7a0-rachelgibb.vercel.app, aliased to https://crm.getflowplan.app. CLI independent inspect confirms Ready. Resend webhook `8f30d4b3-84b5-475e-a07c-628c7c4e47e8` created/enabled for the eight specified events; no opens. Creation form selection and saved endpoint/status verified through the browser; the signing secret was not read or copied.

**Activation is incomplete:** production POST returns JSON 503 `Webhook not configured` as expected. Rachel must privately copy the signing secret from https://resend.com/webhooks/8f30d4b3-84b5-475e-a07c-628c7c4e47e8 into sensitive Production `RESEND_WEBHOOK_SECRET` at https://vercel.com/rachelgibb/flowcrm/settings/environment-variables. Do not paste it in chat. Then redeploy the same reviewed code to activate it and verify invalid unsigned requests return 400. Do not change/retrieve the existing service-role secret. No emails sent or scheduled; full signed-event delivery/click round trip remains unproven. Vercel connector returned team-access 403; approved existing CLI token worked, without credential disclosure. Unrelated AGENTS.md remains uncommitted.

Deployment metadata independently confirms Git SHA `6f4cb45244f255c0611469ec0343f40f4dc9b4f4` and branch `feature/resend-engagement`. Authenticated production PWA inspection confirmed the sent eight-recipient campaign renders delivery/click filters, 8 recipients without evidence, per-recipient Delivery unknown, manual outcomes unchanged, and opens Disabled. This was read-only; no send, schedule, selection action or follow-up record was changed. Native screenshot capture was blank; verification used the accessibility tree. Vercel secret-entry tab currently requires Rachel to sign in. Resend details and Vercel environment tabs are retained for the private handoff; secret details were not inspected. Clean release worktree `/tmp/flowcrm-release-6f4cb45` remains available for the post-entry redeploy.

## October 6 UTC — signing-secret activation verified

Rachel confirmed private Production secret entry. Metadata-only `vercel env ls production` verified `RESEND_WEBHOOK_SECRET` exists, without reading its value. Redeployed the clean detached worktree at exact code SHA `6f4cb45244f255c0611469ec0343f40f4dc9b4f4`. New production deployment `dpl_4vTPcAVeq9GXfC2BfmGtUWCNPLvc` / https://flowcrm-5tlaryk0w-rachelgibb.vercel.app is Ready and aliased to https://crm.getflowplan.app. Vercel API independently confirms `meta.gitCommitSha` matches the reviewed revision (`gitCommitRef: HEAD` because the worktree is detached). Build and TypeScript passed.

Live unsigned and invalid-signature POST checks both return HTTP 400 `Invalid webhook`, replacing the previous 503 missing-configuration response; login returns 200. Resend webhook list confirms the approved endpoint remains enabled. No credential value was read, copied or stored locally, and no real emails were sent or scheduled. The private-entry blocker is resolved. Valid provider-signed event receipt, signature-secret correctness and persisted real-event reporting remain unproven until a genuine event arrives. No signed traffic was fabricated. Use a subsequently authorized campaign for end-to-end evidence, or obtain explicit approval for a specific test recipient and message before any real send. Existing historical records remain unknown. Prior test coverage and lint limitations still apply.

After activation, refreshed authenticated production campaign UI still renders all eight historical recipients as delivery unknown with no clicks recorded, without a load error. No campaign or contact data was changed.

## October 6 UTC — approved single-message real-event test passed

Rachel explicitly approved one message to her existing Vancouver contact, subject `FlowCRM tracking test`, linking to https://rachelgibbrealtor.com/. A clearly labeled draft was created with only that contact ID. Read-only preflight resolved exactly one eligible address and the existing sender; the actual FlowCRM Send Now path saved the recipient snapshot and sent once. Campaign `4d483662-2e0b-41aa-8ca4-1370a7539441`: total 1, accepted 1, failed 0. Provider ID `01a10eb4-9490-7403-a9bc-8908d7da22ba`; accepted at 2026-10-06 00:54:38 UTC. No retry or additional send.

Production ledger contains verified `email.sent` at 00:54:38.449, `email.delivered` at 00:54:39.408 and `email.clicked` at 00:54:52.769 UTC, with unique Svix IDs. Click URL is the approved website. Rachel subsequently confirmed she clicked; agent never clicked the tracked link. Refreshed campaign UI shows 1 confirmed delivery, 1 unique recipient clicked, 0 issues; expanded URL and first/latest 5:54:52 PM America/Vancouver. Contact delivery/click card also shows the evidence and campaign link; manual follow-up remains unchanged. Real provider signature validation, storage, matching and campaign/contact readback are now verified end to end. Historical absent evidence remains unknown.

[Verified test campaign](https://crm.getflowplan.app/broadcasts/4d483662-2e0b-41aa-8ca4-1370a7539441) · [Contact evidence](https://crm.getflowplan.app/contacts/c0c9d540-0cac-4cb7-83ea-6bd24803939c).

### Additional preview correction — local only, not deployed

Test exposed existing `getRecipientCount` ignoring explicit `contact_ids`: draft preview said 204 despite fixed-audience banner and actual delivery resolving 1. Actual sending was correctly scoped and preserved the single recipient. Parent authorized a focused local fix with tests, no deployment before reporting. Preview now gives `contact_ids` priority over broad filters, keeps an empty selection empty, and excludes do-not-contact just like delivery. No delivery code or audience is expanded. Four regression cases verify selected/empty/mixed consent/tenant/SMS boundaries; editor fixture now uses the actual `{data: 1}` result and asserts rendered one-recipient count. All 63 tests, TypeScript and targeted lint pass. Production still runs reviewed `6f4cb45`; this correction awaits a separate release decision.

Preview correction production build passed after allowing the existing Google Inter font fetch (initial sandbox-only build failed on network access). No deployment performed. Existing middleware deprecation and unrelated baseline lint debt remain.

## October 6 UTC — v0.9.7 empty-audience safeguard (local, deployment held)

Rachel requested a safer default before the preview fix is deployed. New and legacy unconfigured drafts now mean zero recipients. Tags/source checkboxes select eligible groups; only deliberate `all: true` selects all eligible workspace contacts. Explicit `contact_ids` take precedence, including an empty list. Empty arrays, false/absent all, null/malformed filters cannot fall back to the database. Direct malformed saves are rejected; clearing selections saves an empty draft. Count and delivery share the same normalized query, retaining tenant, consent, do-not-contact and email/SMS-method rules. Schedule and Send refuse empty audiences server-side before claiming or snapshotting. The separate Send test to me action remains an explicit self-preview, not a campaign audience send.

Editor starts at 0 recipients, with Send Now and Schedule disabled until a current positive count. Selection triggers counting; removing the last selection immediately returns to 0. Failed/stale count responses do not enable sending. Fixed-recipient drafts still keep their audience locked and editable content. Existing saved all/tag/source/fixed selections retain their meaning. Read-only production audit found 11 broadcasts: three tag-filter drafts, four tag-filter schedules, four sent campaigns with tags/source/fixed IDs; none uses an empty filter. No migration, historical rewrite, schedule change or production data mutation is needed. Hypothetical legacy empty drafts intentionally require a fresh explicit audience choice; sent recipient history is untouched.

Verification: 83 tests passed (including empty/malformed direct counts and sends, no claim/snapshot/send on empty audience, draft create/save, scheduling refusal, stale/error counts, empty fixed IDs/remount, and editor selection/deselection). TypeScript and production build passed; full lint remains baseline 26 errors/29 warnings. Local synthetic browser verified 0/default-disabled, tag/source count updates, explicit all, deselection back to0, and refresh/reset. All browser writes/sends are stubbed. No real emails or production deployment during this safeguard work. Production remains `6f4cb45`; combined v0.9.7 candidate includes the earlier recipient-preview correction and awaits review/release approval.

## October 6 UTC — v0.9.7 audience safeguard released

Rachel's conditional release approval was satisfied by the reviewed combined scope. Before release, local/remote `feature/resend-engagement` both matched `610e4c2db756af8956c9c6fccb993bc99d4db3e7`; remote main remained `5e8f767`, production was still the prior reviewed `6f4cb45` release, and only unrelated AGENTS.md edits were dirty. Deployed a clean detached checkout `/tmp/flowcrm-release-610e4c2`; no merge, migration or campaign-data change.

Production deployment `dpl_5azHUNPHvGAAfGDNrDKjra1YzQXR` / https://flowcrm-jdi0q4z6s-rachelgibb.vercel.app is Ready and aliased to https://crm.getflowplan.app. Independent Vercel API readback confirms exact SHA `610e4c2db756af8956c9c6fccb993bc99d4db3e7`, production target and aliases. Remote build/TypeScript passed. Live unsigned and invalid-signature webhook POST checks return400 Invalid webhook; login200. Historical test contact still displays receiving-server delivery and1click/1unique link; all3 original signed events remain stored.

Authenticated live editor verification used an existing sphere-filter draft without saving:61eligible contacts initially; removing the only selection immediately showed0 and disabled Send; Schedule stayed disabled; reselecting triggered counting and returned61; refresh restored saved sphere selection/count. Campaign-record fingerprint across all11broadcast IDs/statuses/filters/update-times matched before/after (`13543fb25244a6d41eda14cb82090d99`). No emails, saved drafts, schedules or other production data were changed during release verification. A fresh live draft was deliberately not created because that action persists a record; fresh-draft default0/create/save semantics are covered by83tests and the local synthetic browser, while live empty-selection behavior is directly verified. Existing unrelated lint debt remains26errors29warnings. No remaining configuration blocker for this release.

## October 6 UTC — 14310 shortened schedule, explicitly requested

Rachel instructed not to pause and to shorten the existing campaign schedule. Transactional preflight verified the exact IDs, prior timestamps, scheduled status and tag filters. Only two `scheduled_at` values changed; comparison against all11campaign records confirmed every other business field and all other broadcasts unchanged (ordinary updated_at trigger metadata excluded). Exact eligible contact-ID arrays remained identical. No immediate send, pause, duplicate, enrollment, consent edit or content edit.

| Campaign | Scheduled Vancouver time | UTC | Eligible recipients |
|---|---|---|---|
| [General launch](https://crm.getflowplan.app/broadcasts/03a0a345-0e48-4167-a11b-12d402846650) | Oct6,2026 10:00AM | 2026-10-06T17:00:00Z |22 unchanged|
| [Co-op brokers](https://crm.getflowplan.app/broadcasts/671d70fb-b515-4564-b2f2-b994dbf4cb04) | Oct7,2026 10:00AM | 2026-10-07T17:00:00Z |11 unchanged|
| [Named wave2](https://crm.getflowplan.app/broadcasts/9fc39597-0ac9-4a3f-b958-b987d2cf79ae) | Oct8,2026 10:00AM (was Oct13) | 2026-10-08T17:00:00Z |10 unchanged|
| [General wave2](https://crm.getflowplan.app/broadcasts/2a2f2de7-36e8-4ae9-9dc7-3d883c200596) | Oct9,2026 10:00AM (was Oct14) | 2026-10-09T17:00:00Z |24 unchanged|

Saved timestamps were read back after commit and converted with America/Vancouver. All four remain scheduled. Names were preserved per the requested narrow scope, so the last two titles still contain Oct13/Oct14; their actual scheduled dates are Oct8/Oct9. App eligibility counts do not establish legal compliance or provider opt-in permission; neither was verified by this scheduling action. No code change or deployment needed.
