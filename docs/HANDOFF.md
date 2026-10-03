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
