# FlowCRM — Build Status

**Current version: v0.6.1** · Last updated 2026-09-04 · Latest commit *(see git log)*

*Developer-facing reference: what's built, what's pending, what was deliberately deferred. For how to use the app, see [USER-GUIDE.md](./USER-GUIDE.md).*

> **On versioning:** GitHub tracks *every change* (history, diffs, who/when). It does not tell you "are we done with Phase 4?" — that's this file's job. Git = the ledger; this doc = the summary. Phase numbers here are the shared vocabulary.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
Supabase (Postgres + Auth + RLS) `jsnufxpzeuoybgksgnon` (ca-central-1) · Vercel hosting
Resend (email) · Twilio (SMS) · Leaflet/OSM (maps) · Claude API (AI) · Vitest (tests)

---

## ✅ Shipped

### Phase 1 — Foundation (2026-06-29)
Auth (email/password + magic link) · multi-tenant orgs → sub-accounts with RLS isolation · contacts (CRUD, CSV import/export, tags, sources, birthday) · pipeline (kanban + list, filters, stats) · tasks · calendar · dashboard · settings (agency + sub-account) · two-tier sidebar · light/dark theme · Cmd+K palette · notes.

### Phase 2 — Communication (2026-06-30)
Email via Resend · SMS via Twilio · templates for both · form builder with public `/f/[slug]` pages that auto-create contacts · automations (5 triggers × 6 action types) · broadcasts with CASL consent enforcement.

### Phase 3 — Collaboration & insight (2026-07-01)
Team invitations with token acceptance · role-based UI (owner/admin/member) · deal map (Leaflet + geocoding) · reports (6 charts, CSV export).

### Phase 4 — AI (2026-07-07) · `0f39a69`
Provider-agnostic AI layer (`features/ai/provider.ts`, Claude `claude-opus-4-8`) · lead scoring stored in `contacts.metadata.ai_score` · timeline summaries · follow-up drafts (never auto-sent — prefills the compose dialog) · natural-language search in Cmd+K.

### Phase 5a — Prospecting (2026-09-04) · v0.5.0
Rachel's own daily-use layer, built for the Sept 6–7 import.
- **Contact fields** `last_contact` (date) and `consent_to_display_sale` (yes / no / pending — consent to show a *sold* marker with neighbourhood + street only). Editable on the contact page, shown + sortable in the contact list, importable. Migration `00013`.
- **Transactions = won deals.** `deals` gained `side`, `city`, `closed_at`, `co_op_agent`, `referrer_contact_id`, **`commission`**, `reference` (user's own ref / transaction no.) and `source`. Future-dated presales import as *open* deals in Negotiation with `expected_close`.
- **Log a call** — `/features/calls`: one dialog (outcome · note · optional next-step task with quick due dates) writes a `call` activity, stamps `last_contact`, optionally creates the task. Button on every contact page.
- **Calls page** `/calls` — ten contacts for a chosen tag, never-contacted first then oldest `last_contact`; log inline. Sidebar + Cmd+K entries.
- **Importer** recognises Google Contacts exports (both header layouts): labels → clean tags (Google's bookkeeping labels dropped), Notes → first timeline note, Address → `metadata.address`, Birthday, dedupe by email (skipped count shown), default-consent picker, "tag every imported contact with …" field.
- **Data load** — Rachel's 48 Google contacts + 48 transactions (17 co-clients not in Google created as new past-clients) loaded into **Testing** for review via a reviewed SQL script (`scratchpad/import/gen_compact.py`); Vancouver load waits for her go-ahead.

### Phase 5b — Website intake (2026-09-09) · v0.7.0
Job 2 of the 90-day plan (website forms → CRM, due 2026-09-13). Step 1 of 6.
- **`POST /api/intake`** — public route for external websites. `Authorization: Bearer <workspace key>`; JSON `{name, email, phone?, message?, source?, tags?, meta?, consent: true, consent_text?}`; honeypot field `website`; in-memory rate limit (10/min/IP); always returns JSON. Validation in `features/intake/validate.ts` (unit-tested, 7 tests).
- **`intake_contact()`** SECURITY DEFINER function (migration `00017`) does the write as `anon`: matches the key by sha256 hash, dedupes by email (case-insensitive) within the workspace, creates the contact as `lead` + `website` + sent tags with explicit consent + date, or merges tags/phone/consent into the existing contact; adds a `note` activity carrying the message and consent wording; queues `contact_created` automation runs for new contacts (paused-and-due, same as public forms); stamps the key's `last_used_at`. **No service-role key anywhere.**
- **`intake_keys` table** — per-workspace keys (hash + prefix only), RLS: members read, org admins manage. Settings → Sub-account → **Website Intake** card: endpoint, notification email (`settings.intake.notify_email`), create key (secret shown once), revoke.
- **Email copy** to the notify address (fallback: Email Settings reply-to / from), sent from the workspace's Email Settings sender, reply-to = the lead, with a link to the contact.
- Verified 2026-09-09 against Testing as `anon` via psql: create → update path → invalid key → anon sees 0 contacts.

### Branding & install (2026-08-13)
- **App icon** — white "F" monogram with indigo crossbar on near-black. `src/app/icon.svg` (browser tabs), `src/app/apple-icon.png` (180px, iOS home screen), `public/icon-{192,512}.png` (Android/PWA). Next.js default favicon archived to `_archive/`.
- **Web manifest** — `src/app/manifest.ts`, `display: standalone` so it launches without browser chrome once added to a home screen.
- **Middleware fix** — `manifest.webmanifest` was being redirected to `/login` by the auth middleware, which would have blocked Android's "Install app" prompt. Now excluded, along with `.ico`.

### Fixes shipped alongside
- **Auth callback** `ae6a583` — `/auth/callback` route; magic links and password resets no longer loop back to login. Added a `/reset-password` page and "Forgot password?" link.
- **Execution engine** `2b42c5b` — automations and broadcasts previously *recorded* activity without doing anything. Now they genuinely execute and send. Migration `00012` added `automation_runs.sub_account_id` + `log` (columns the code already wrote — manual runs had been failing silently).
- **Test infrastructure** — `npm run test` script + jsdom; the suite had never been runnable. 5 tests passing.

---

## ⚠️ Pending setup (not code — configuration only)

These are done in dashboards, not in the repo. Each one blocks a shipped feature from working.

| # | Task | Where | Status |
|---|---|---|---|
| 1 | Redirect URLs `http://localhost:3000/**` + `https://crm.getflowplan.app/**` | Supabase → Auth → URL Configuration | ✅ Verified 2026-09-04 — reset link redirected to our callback |
| 2 | `ANTHROPIC_API_KEY` | Vercel env vars | ✅ Verified 2026-09-04 — Score lead returned a score in production |
| 3 | `NEXT_PUBLIC_SITE_URL` | Vercel env vars | ✅ Verified 2026-09-04 — reset email carried `redirect_to=https://crm.getflowplan.app/auth/…` |
| 4 | `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Vercel env vars | ✅ Set since 2026-07-01 |
| 5 | **Switch the two Supabase email templates to the token-hash link** (see below) | Supabase → Authentication → Emails | ✅ Done 2026-09-07. Required custom SMTP first (Supabase no longer lets you edit templates on the built-in mailer): Resend SMTP, sender `FlowCRM <flowcrm@rachelgibbrealtor.com>`, host `smtp.resend.com:465`, user `resend`, password = a Resend API key named `supabase-smtp`. Auth email rate limit rose from 2/h to 30/h as a side effect. Verified: reset requested on laptop, link opened on phone, password changed. |

**Email template change (item 5).** In Supabase → Authentication → Email Templates, edit these two templates so the button/link `href` reads exactly:

- **Reset Password:** `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`
- **Magic Link:** `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink`

Leave everything else in the template as is. The app already sends `redirect_to=…/auth/confirm?next=…`, so the `&` continues that query string. Why: the default `{{ .ConfirmationURL }}` uses a PKCE code that only the *requesting* browser can redeem; `token_hash` is verified server-side by `/auth/confirm` and works from any device. Verified 2026-09-04 via Supabase auth logs: the first click on a reset link verified fine at Supabase, but our callback never exchanged the code (no `grant_type=pkce` request) — the verifier cookie wasn't present in the browser that opened the email.

**✅ 2026-08-13 — custom domain live.** `crm.getflowplan.app` → Cloudflare CNAME (DNS-only / grey cloud) → Vercel. Valid Let's Encrypt cert, publicly reachable, no SSO wall. *Cloudflare proxying must stay OFF for this record — orange cloud breaks Vercel's certificate.*

**✅ 2026-08-30 — env vars verified via Vercel CLI.** All 7 present on `rachelaigibbs-projects/flowcrm`. `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_SITE_URL` were created 2026-08-13 20:41:53; the live deployment (`dpl_3b1wd7G6iA5secv8us82ucFJAw8s`) built at 21:34:41 — **53 min later, so both are baked into what's running.** Vercel's API refuses to return env *values*, so a typo in `NEXT_PUBLIC_SITE_URL` would still be invisible; only the password-reset email test proves the value.

### ⚠️ Two Vercel accounts — know which is which

| Account | Contains | Git-connected | Serves the domain |
|---|---|---|---|
| `rachelaigibbs-projects` | the **real** `flowcrm` + 8 other projects | ✅ yes | ✅ `crm.getflowplan.app` |
| `rachelgibb` (**Pro**) | an empty duplicate `flowcrm`, `rachelgibbrealtor.ca` | ❌ no | ❌ |

`.vercel/project.json` pointed at the empty duplicate until 2026-08-30; it is now correctly linked to `prj_ErSFQUwwDcvY8hsvhY6rgmtkQvjB`. **Open question:** the live project sits on the non-Pro account while the Pro subscription sits on the other — worth consolidating, since Vercel's Hobby plan disallows commercial use. Treat as its own migration task.

**Deploy gotcha observed 2026-08-13:** a push to `main` was silently not picked up by Vercel (no build, no check-run). A follow-up push triggered it. If a change doesn't appear live, check that a deployment actually exists for the commit.

**Still to confirm by hand (Rachel, ~3 min):** item 1, plus the *values* behind items 2–3. The reset email goes to `rachelaigibb@gmail.com`, which Claude cannot read, so these two tests stay manual. One test covers all of it — request a password reset on the live site; if the emailed link starts with `https://crm.getflowplan.app` and logging in works, `NEXT_PUBLIC_SITE_URL` and the Supabase allowlist are both correct. Then click **Score lead** on a contact to confirm the AI key value.

---

## 🔨 Not started / next candidates

| Item | Notes |
|---|---|
| **Website form → FlowCRM wiring (job 2, due 2026-09-13)** | Step 1 `/api/intake` **shipped v0.7.0**. Step 2: `.ca` site switched to the intake endpoint (needs Rachel to create the key + set `FLOWCRM_INTAKE_URL`/`FLOWCRM_INTAKE_KEY` on the `.ca` Vercel project, then drop the old `FLOWCRM_SUPABASE_*` vars). Step 3: `deals.rachelgibbrealtor.ca` email-gate page (confirmation only; tags `deal-list` + `web-lead`). Step 4: honeypot + rate limit only (Turnstile deferred until spam appears). Step 5: both Dubai sites (`mailto:` forms today) → Dubai workspace, unified consent wording. Step 6: one test submission per form. |
| **Unsubscribe link (job 3, due 2026-09-26)** | Per-contact token → public `/u/[token]` sets consent `withdrawn`; `List-Unsubscribe` header on broadcasts. Not built today. |
| **`.ca` sender for Vancouver** | Rachel wants replies from `info@rachelgibbrealtor.ca` as well as `.com`. `.ca` domain must be verified in Resend first. |
| **Automation scheduler (cron)** | "Wait" steps currently resume only when someone loads the automations pages. Needs a Vercel cron or queue before selling to other agencies. |
| **Auto-score on contact change** | Phase 4 leftover — scoring is manual (button click) today. |
| **AI in pipeline / broadcast views** | Phase 4 leftover — AI is contact-page + Cmd+K only. |
| **Phase 5 — landing page builder** | Evaluate GrapeJS vs Craft.js. The last "Coming Soon" item in the sidebar ("Website"). |
| **Broadcast queue** | Current send loop runs inside the server action — fine for hundreds of recipients (300s Vercel limit), needs a queue for thousands. |
| **Supabase Pro** | Free tier auto-pauses after ~a week idle (this bit us once). ~$25/mo removes it and improves backups. |

## 🐛 Fixes (short-term intake)

*Rachel: add anything you notice here (or tell Claude and it lands here). Fixed items are marked ✅ with the commit.*

| # | What's wrong | Where | Status |
|---|---|---|---|
| 1 | Password-reset / magic-link emails fail unless opened in the same browser that requested them | Auth email flow | ✅ Code `e71575e` (`/auth/confirm` token-hash route) + templates switched 2026-09-07; verified cross-device |
| 2 | Accent colour from Settings only coloured the sidebar dot — all buttons stayed black | Theme | ✅ v0.5.0 — accent now drives `--primary`, `--ring`, `--sidebar-primary` app-wide (foreground picked by luminance) |
| 3 | Tags added on a contact didn't appear in Settings → Tags | Tags | ✅ v0.5.0 — CSV import now registers tags; Settings shows the union of configured tags and tags actually on contacts (`reconcileTagDefinitions`) |
| 4 | Editing a contact: every keystroke dropped focus | Contact page | ✅ v0.5.0 — panels were nested components (remounted per render); now render helpers |
| 5 | Deal created from a contact page showed contact = none | Create deal | ✅ v0.5.0 — form reset wiped the default contact; now resets to it and re-syncs on open |
| 6 | Huge "+ Add Task" button at the bottom of the contact page | Contact page | ✅ v0.5.0 — trigger hidden when the parent controls the dialog |
| 7 | Reports showed 0 % won with a won deal in the database | Reports | ✅ v0.5.0 — deals are dated by `closed_at` (not created); moving a deal into the Won/Lost stage now sets status + `closed_at` |
| 8 | Pipeline (and calendar, deal map) showed no deals after migration 00013 | Pipeline | ✅ v0.5.1 — `deals` now has two foreign keys to `contacts` (`contact_id`, `referrer_contact_id`), so the PostgREST embed `contact:contacts(*)` became ambiguous and the query silently returned nothing. All deal→contact embeds now name the key: `contacts!deals_contact_id_fkey` |
| 9 | Tags auto-added from imports were all grey | Settings | ✅ v0.5.1 — `reconcileTagDefinitions` assigns least-used palette colours; Testing recoloured in place |
| 10 | Contacts header shows only the grand total when a filter is active | Contacts | ✅ v0.5.1 — shows "8 of 156 contacts" while filtered |
| 11 | Reports: no per-year view, revenue chart ignored the range | Reports | ✅ v0.5.1 — range picker lists every year with data; charts bucket by month for a year/quarter and by year for All Time; deals dated by `closed_at` |
| 12 | Do-not-contact people appeared in the Calls queue | Calls | ✅ v0.5.2 — queue excludes the `do-not-contact` tag |
| 13 | Reports "Revenue" was sold volume, not income; no commission view; year list skipped empty years | Reports | ✅ v0.5.2 — renamed Sales Over Time; new Commission Over Time chart with range total; year picker lists every year from first record to now |
| 14 | Pipeline showed all-time totals with no way to focus on a period; cards/list in arbitrary order; won deals showed no close date | Pipeline | ✅ v0.5.2 — period picker (week/month/quarter/year/all/any year) applies to closed deals only, open deals always show; Won stat follows it; cards and list sorted newest first; list column is Close Date (actual for won/lost, expected for open) |
| 15 | Dashboard "Won This Month" summed all time; tiles had no period; Open Deals tile dumped you on the full board | Dashboard | ✅ v0.5.2 — period picker saved per workspace (`settings.dashboard_range`, default This Month); Won / New Contacts / Activities follow it, Open Deals / Pipeline Value / Tasks stay all-time; Open Deals and Won tiles deep-link to the pipeline list pre-filtered |
| 16 | Tags on add/edit contact were a comma-separated text box | Contacts | ✅ v0.5.3 — tag picker: selected tags as coloured pills with ×, "Add tag" opens a searchable list of every workspace tag, with "Create …" for new ones; new tags get a palette colour automatically |
| 17 | Contact source shown as plain grey text | Contacts | ✅ v0.5.3 — every source gets a stable colour (known sources keep their set colour; others are derived from the name) in the list and on the detail page |
| 18 | Opening a deal from a contact's profile showed "No contact" | Contacts | ✅ v0.5.4 — the contact page attaches the contact to the deal when opening the sheet |
| 19 | Deal edit could not change contact, address or close date; no way to mark listings vs buyers | Pipeline | ✅ v0.5.4 — **Deal type** field (per-workspace pick-list in Settings → Sub-account, default buyer/seller/both/tenant/landlord/referral; migration `00014` drops the fixed CHECK); edit sheet now covers contact (search), address, deal type, close date, commission, reference, co-op agent; type badge on cards, Type column and filter in the pipeline |
| 20 | App icon was the placeholder "F" monogram | Branding | ✅ v0.5.5 — new FlowCRM mark (`references/flowcrm-newbranding/`): favicon `src/app/icon.png`, iOS `apple-icon.png` and Android maskable icons are full-bleed crops; manifest theme #4F46E5 / background #0B0F2D. Old monogram kept in `references/_archive/` |
| 21 | No way to link several people to one deal (listing inquiries, co-buyers, other-side agent) | Pipeline | ✅ v0.6.0 — **Deal associations**: `deal_contacts` table (migration `00015`, RLS) with a per-workspace role list (Settings → Sub-account → People roles; default inquiry/buyer/co-buyer/seller/co-seller/co-op agent/lawyer/lender/referrer). Deal panel gets a **People** card with "Add person" (search + role) and **"Log inquiry"** (existing or new person + note + follow-up task, tags `lead`+`inquiry`, source "Listing inquiry"). Contact profile shows "Linked to" deals with the role; pipeline cards show an inquiries badge and the list has a People column. 34 imported co-clients back-filled as co-buyer/co-seller |
| 22 | New deals had no number; imported ones are "#N · address" | Pipeline | ✅ v0.6.1 — `deals.number` assigned per workspace by a database trigger on insert (migration `00016`, advisory-locked so numbers never collide); the title is prefixed "#N · " unless it already carries one. Works from the dialog, forms and imports. Existing deals back-filled from their import numbers |

## 🗄️ Deliberately deferred (decided, not forgotten)

- **Per-tenant AI keys** — one global `ANTHROPIC_API_KEY` for now; per-agency billing comes when there are paying agencies.
- **Engine tag changes don't fire `tag_added` triggers** — prevents infinite automation loops.
- **No open-rate / click tracking on broadcasts** — `stats.opened` exists in the schema but nothing populates it; would need Resend webhooks.

---

## Data state (as of 2026-09-04, evening)

- **2026-09-08 — Vancouver loaded** (job 1 of the 90-day plan): 155 contacts (59 past clients, 62 leads, 92 sphere, 37 friends & family), 52 deals (51 won / 1 open presale, all typed, $265,332 commission), 308 notes/activities, 23 tag definitions with colours. Same set as Testing; loader = `references/import/` CSVs → `vancouver_load.sql` via psql in one transaction, idempotent on the `import-2026-09` tag. Dubai workspace holds the 7 event leads. Still to come for contacts: `last_contact` from eXp email (needs the Gmail connector on rachel.gibb@exprealty.com) and any gibbrealestate.ca mail found in the 2024 sparsebundle.

**Testing:** 66 contacts (48 Google + 17 new from the transaction sheet + 1 throwaway), 48 deals (46 won, 2 open presales), notes and co-client notes — Rachel's real data, loaded for review. **Vancouver:** empty, awaiting her go-ahead to load the same set. **Dubai:** empty. 1 login, 1 org, 3 sub-accounts.

## Version history

| Version | Date | What landed |
|---|---|---|
| v0.1 | 2026-06-29 | Phase 1 — foundation |
| v0.2 | 2026-06-30 | Phase 2 — email, SMS, forms, automations, broadcasts (UI only) |
| v0.3 | 2026-07-01 | Phase 3 — collaboration, map, reports |
| v0.3.1 | 2026-07-07 | Auth callback fix; automations + broadcasts actually execute |
| v0.4 | 2026-07-07 | Phase 4 — AI layer |
| v0.4.1 | 2026-08-13 | Live domain + app icon, PWA manifest, installable on phone |
| **v0.5.0** | 2026-09-04 | **Phase 5a — prospecting: custom fields, transactions as won deals + commission, log-a-call, Calls page, Google Contacts importer, 6 fixes (current)** |
| **v0.7.0** | 2026-09-09 | **Website intake: `/api/intake` + per-workspace keys + Settings card (job 2, step 1)** |
| v0.7.x | planned | `.ca` switched to intake, deals. page, Dubai sites (job 2 steps 2–6); unsubscribe (job 3) |
| v0.6 | planned | Vercel Pro migration + automation scheduler |
| v1.0 | goal | Ready to sell to other agencies |

*Keep this table updated when a phase ships. Bump `version` in `package.json` to match.*
