# FlowCRM — Build Status

**Current version: v0.9.6 (webhook activation pending)** · Last updated 2026-10-06 · Latest commit *(see git log)*

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

### Phase 5c — Email upgrade & documents (2026-09-14) · v0.8.0
One-to-one email now goes out as HTML (plain-text fallback) with the workspace **signature** appended (`settings.email.signature`, Settings → Email Settings; compose, templates and automations get it, broadcasts do not) · **attachments** on compose (up to 10 MB per email, stored in the private `documents` bucket and listed on the email activity) · **Documents card** on every contact and deal (upload / open via signed link / remove with confirmation) · **"Send me a copy"** checkbox on compose, on by default, BCCs the workspace copy address (intake notify → reply-to → from) so the email also lands in Gmail · `documents` table + storage policies (migration `00018`) · `/api/documents/[id]` redirects to a 2-minute signed URL · compose sends through the shared `sendEmailToContact` helper (the duplicate Resend call in `email/actions.ts` is gone) · app icon replaced with the black-and-white FlowPlan mark (old set in `_archive/icons-v0.5.5/`).

### Job 3 — Broadcasts with a working unsubscribe (2026-09-22) · v0.8.1
Every contact has an `unsubscribe_token` (migration `00019`). Broadcast and automation emails now carry a footer (sender name · reply-to · Unsubscribe link) and the `List-Unsubscribe` / `List-Unsubscribe-Post` one-click headers, so Gmail and Apple Mail show their own Unsubscribe control. Public page `/u/<token>` (button, runs as anon through `unsubscribe_contact()`), one-click endpoint `POST /api/unsubscribe/<token>`; both set `consent_status = withdrawn`, stamp `consent_date`, keep the previous status in `metadata.consent_before_unsubscribe`, and log a `system` activity. Withdrawn contacts drop out of every broadcast automatically (existing consent filter). Merge field `{{unsubscribe_url}}` available in templates. Broadcast editor: **Send test to me** (to the workspace copy address, sample merge values, `/u/preview` link, nothing logged) and a body hint. One-to-one compose mail stays footer-free. Middleware now allow-lists `/u/` and `/f/` (public forms had been redirecting logged-out visitors to /login since Phase 2). Two Vancouver drafts created for the first sends: "Market update — October 2026" (tag `sphere`, 61 eligible) and "Deal Sheet — Friday" (tag `deal-list`).

### v0.9.0 — Scheduler on Vercel Cron (2026-09-23)
`vercel.json` cron calls `GET /api/cron/tick` every 5 minutes (Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is 401). The route is the only importer of the service-role client (`lib/supabase/service.ts`; key in Vercel Production only) and runs `features/scheduler/tick.ts`: due **scheduled broadcasts** (5 per tick) and due **automation wait steps** (50 per tick) across every workspace, 240 s budget, activities attributed to the org owner. Each item is claimed atomically (`scheduled → sending`, `paused → running`), so overlapping ticks or a Send-now click cannot double-send. The broadcast send loop moved to `features/broadcasts/deliver.ts`, shared by Send now and the tick. Broadcast editor: **Schedule** now really schedules (checks content, sender and recipients first; status `scheduled`), **Cancel schedule and edit** returns it to draft, a failed broadcast shows its reason. Heartbeat table `system_jobs` (migration `00020`) → "Scheduler ran N min ago" under the Automations and Broadcasts titles, amber after 15 minutes or on an error. Automation emails now also skip contacts without explicit/implied consent and carry the unsubscribe footer (the engine had not selected `unsubscribe_token`, so v0.8.1 automation mail went out without it; no automation had sent since). **Verified live 2026-09-23 17:05 PT** in the Testing workspace: first tick sent a scheduled broadcast to Resend's `delivered@resend.dev` sink (activity logged, attributed to the owner) and resumed a paused run (tag added, run completed); heartbeat row written, no error. Test rows (contact `delivered@resend.dev`, broadcast + automation "Scheduler test v0.9.0", Testing email sender) left in Testing. Birthday/anniversary triggers follow in v0.9.1 (9 am workspace time and Testing-first confirmed by Rachel 2026-09-23).

### v0.9.1 — Campaign email and long-content fixes (2026-10-02)
- Contact compose renders merge fields in subject/body, including pasted drafts, and rejects unresolved fields before upload/send.
- Attachment selection snapshots the live FileList before clearing the input; selected file rows show names, sizes and removal controls. Existing private storage and delivery payload remain in use.
- Marketing email is on by default in compose, adds identification/address/unsubscribe in HTML + text and one-click headers, and checks contact consent. Requested correspondence may opt out of marketing mode. Broadcasts and automations require the workspace mailing address and a recipient unsubscribe token.
- Settings → Email has a separate per-workspace mailing address. Rachel confirmed the eXp brokerage address for **Vancouver Real Estate only**; DB update/readback verified October 2. Other workspaces need their own addresses before marketing sends.
- Email/note dialogs fit the viewport with bounded scrolling editors. Timeline content is limited to five wrapped lines with Show more / Show less.
- Date campaigns previously assigned v0.9.1 are deferred by Rachel's October 2 priority change. No campaign sent or automation enabled as part of this release.
- Validation: `npx tsc --noEmit`, 31 tests in 7 files, and `npm run build` passed. Build needed network access for the existing Inter font. Mocked delivery verifies exact attachment bytes, BCC, footer and headers; no live recipient email was sent. Production deployment `dpl_AQQk1hxh2cvV29PKLP6QeixDW9a7` verified ● Ready on October 2 at 16:43 PT; alias https://crm.getflowplan.app. Live checks: unsubscribe preview 200, protected contacts redirect 307, unauthenticated cron 401. Native app refreshed and exposes Show more; a 100-line note draft retained an enabled Save control. Native file-picker automation failed, so actual inbox attachment receipt remains unverified. No live email sent.
- CRTC identification/address/unsubscribe guidance: https://crtc.gc.ca/eng/internet/infograph.htm and https://crtc.gc.ca/eng/com500/faq500.htm. Technical safeguards do not establish each recipient's consent basis.

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

### ✅ 2026-09-22 — moved to the Vercel Pro team (with every real estate project)
FlowCRM, `rachelgibbrealtor.com`, `buyingindubai.com` and `dubai-property-portal` now live on the Pro team `rachelgibb` next to the `.ca`; the Hobby account `rachelaigibbs-projects` is no longer used for anything real estate (its projects are kept, paused, not deleted). Reasons: Hobby disallows commercial use, Pro is per seat so extra projects are free, and Pro gives per-minute cron for the campaign scheduler. Keys were rotated on the way (Vercel "Sensitive" variables are write-only). Domains moved by ownership TXT records (`_vercel` at Cloudflare for getflowplan.app, GoDaddy for the two .com zones) so there was no downtime beyond the first one. Deploys are now CLI-only from this Mac (`vercel deploy --prod --scope rachelgibb`); GitHub is deliberately not connected because Vercel Pro blocks deploys whose commit author is not a team member.

## 🔨 Not started / next candidates

| Item | Notes |
|---|---|
| **Website form → FlowCRM wiring (job 2, due 2026-09-13)** | Step 1 `/api/intake` **shipped v0.7.0**. Step 2: `.ca` site switched to the intake endpoint (needs Rachel to create the key + set `FLOWCRM_INTAKE_URL`/`FLOWCRM_INTAKE_KEY` on the `.ca` Vercel project, then drop the old `FLOWCRM_SUPABASE_*` vars). Step 2 **verified by Rachel 2026-09-09** (contact + email copy landed; old `FLOWCRM_SUPABASE_*` vars to be deleted). Step 3 **built 2026-09-09**: `/deals` page in the `.ca` app (live at rachelgibbrealtor.ca/deals), host rewrite for `deals.rachelgibbrealtor.ca`, domain attached to the Vercel project — waiting on Rachel's GoDaddy CNAME. Step 4: honeypot + rate limit only (Turnstile deferred until spam appears). Step 5 **built 2026-09-09**: `rachelgibbrealtor.com` (contact, eXp-profile and marketing-package forms) and `buyingindubai.com` (contact) now post to their own `/api/leads` → FlowCRM intake → Dubai workspace, unified consent wording, honeypot + rate limit; Dubai tag definitions and Email Settings seeded. Step 6 **verified by Rachel 2026-09-10** (Dubai key on both projects, test submissions landed with email copies). **Job 2 complete, three days early.** Deferred from the plan: Turnstile (add only if spam appears). |
| **Gmail record — BCC logging address (after job 4)** | Per-workspace inbound address on Resend Receiving (needs Resend Pro, planned for job 3): BCC from Gmail → logged on the matching contact; Gmail filter forwards client replies to the same address; unmatched mail lands in a review list. Chosen over Google OAuth (restricted-scope review needed to sell to clients). Decided 2026-09-14. |
| **Google Calendar two-way sync** | Appointments/dated tasks → Google Calendar and back. Needs a Google OAuth app (internal to the Workspace domain); parked until the BCC logging lands. |
| **Date campaigns (deferred 2026-10-02)** | Birthday + buyer/seller closing-anniversary triggers on the v0.9.0 tick, 9 am workspace time, per-year idempotency keys, three disabled defaults per workspace, Testing first. Spec: memory `project-flowcrm-campaigns-roadmap`. |
| **`.ca` sender for Vancouver** | Rachel wants replies from `info@rachelgibbrealtor.ca` as well as `.com`. `.ca` domain must be verified in Resend first. |
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
| 23 | Inquiry on a listing showed only the note; the person's name was squeezed to zero width and there was no way back to the contact | Pipeline | ✅ v0.7.1 — People card rows are two lines (name link + phone/email actions + role, note underneath); every inquiry tags the person `listing-N`; clearer duplicate-link message; tasks show the contact's phone as a tap-to-call link; `listing-53` back-filled on the three existing inquiries |

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
| v0.7.0 | 2026-09-09 | Website intake: `/api/intake` + per-workspace keys + Settings card (job 2, step 1) |
| v0.7.1 | 2026-09-09 | Inquiry workflow fix #23: People card layout, listing tags, phone on tasks |
| v0.8.0 | 2026-09-14 | Phase 5c — HTML email + signature, attachments, Documents card on contacts/deals, "Send me a copy", new app icon |
| v0.8.1 | 2026-09-22 | Job 3 — unsubscribe token + page + one-click headers, broadcast footer, test send, first two Vancouver drafts |
| v0.9.0 | 2026-09-23 | **Scheduler: Vercel Cron tick every 5 min — scheduled broadcasts send, wait steps resume on a clock, heartbeat line** |
| **v0.9.1** | 2026-10-02 | Contact email personalization, attachment selection/removal, per-workspace marketing address/footer, bounded dialogs and expandable timeline content (current) |
| v1.0 | goal | Ready to sell to other agencies |

*Keep this table updated when a phase ships. Bump `version` in `package.json` to match.*

## v0.9.2 — compose failure feedback (October 2)

Rachel reported a spinning test send. Live Testing contact has consent None, and Testing has no marketing mailing address. Reproducing a marketing send completed validation without sending, but transient toast feedback was not visible inside the modal. Compose now persists errors inside the dialog, uses send-request state rather than navigation transition state, and catches rejected server-action requests with a delivery-uncertain warning. Drafts remain intact; no automatic retry. Consent/address checks remain enforced. 33 tests, TypeScript and production build passed. Deployment dpl_8666qTdRvDMZygRGyu28kareBS9K independently verified Ready, alias https://crm.getflowplan.app. Native live validation verified persistent consent error, retained draft and re-enabled Send. Original user's exact attachment/checkbox state remains unconfirmed.

## v0.9.3 — direct private email attachment upload (October 2)

Rachel confirmed text-only test sent while attachment test hung. Identified architectural mismatch: 10 MB app attachment allowance vs Vercel 4.5 MB incoming function payload cap. Original attachment size remains unconfirmed, so this is a confirmed defect, not proof of the exact original failure. Compose now requests a signed private-storage upload URL using authenticated server-derived workspace/contact/user, PUTs file bytes directly to storage with a two-minute upload timeout, and sends only metadata references to the email action. It shows Preparing/Uploading/Sending steps. Server checks path scope, actual stored total size (10 MB), downloads bytes and records documents before sending. Successful uploads are cached within the draft for explicit retries; upload failures never invoke the send action. Existing RLS remains; no service key, public bucket or new schema. Abandoned pre-send uploads can remain unindexed in private storage; no automatic destructive cleanup added. Documents-card uploads still use their existing server-action path and are outside this email fix.

Validation: 38 tests in 8 files, including direct upload payload, upload-failure no-send/draft retention, forbidden workspace/contact/user references and actual oversized objects before download. Live inbox attachment receipt pending.

Production v0.9.3: code 08ea395 deployed as dpl_EvLPUMCNioipo5MbdP9xRKNZdLUM; independent CLI inspection ● Ready, https://crm.getflowplan.app; public preview HTTP 200. Production upload-only 5 MB synthetic check paused because Mac locked (unlock requested). No attachment email sent by Codex. Live bucket/policies verified via read-only SQL.

October 2 resumed live verification after unlock: synthetic flowcrm-attachment-5mb.txt selected in native compose (visible name, size and remove button), uploaded successfully through the new path. Read-only storage.objects query verified 5,242,881 bytes under Testing/current contact/user scope. Compose returned the expected missing-workspace-address marketing error, retained draft and re-enabled Send. No delivery attempted; canceled synthetic draft. Synthetic private object left in place (no deletion authorization). Actual recipient attachment receipt still unverified.

October 2 v0.9.4: native user's attachment draft exposed "An attachment has not finished uploading" after the upload step. Corrected Storage info response handling from metadata.size to top-level size, as declared by installed StorageFileApi/FileObjectV2. Prior test fixture incorrectly mimicked storage.objects SQL metadata, rather than the HTTP info response. Regression fixture now uses top-level size with empty custom metadata. Existing live 5 MB upload-only guard did not exercise file-info retrieval; actual inbox delivery remains unverified. User's draft remains open and intact; no send by Codex.

v0.9.4 deployed from 81aa6f8; independent Vercel inspection confirms ● Ready (dpl_4Ckcf3itB9xWv27k1n3rMfC9rF12), https://crm.getflowplan.app. Scoped storage readback confirmed user PDF was fully uploaded (200,667 bytes), so this attempt failed during info validation, not upload. 38 tests, TypeScript and build passed. Existing user draft left intact; no automatic retry or email sent by Codex.

## v0.9.5 — Broadcast recipients and follow-up (2026-10-03)

Stage 1: permanent send-time recipient snapshots, per-recipient sent/failed/pending results, provider IDs and failure reasons. Broadcast recipient lists link to contact records and Contacts filters; contact emails link back to named broadcasts. Select recipients to create idempotent follow-up tasks, mark outcomes, open the sent/unfollowed phone queue, or prepare an email follow-up draft with a fixed selected audience. Current consent and do-not-contact tags are rechecked. Test sends are excluded. Sent means provider acceptance, not inbox delivery; delivery/open/click events and automatic Gmail replies remain Stage 2. Historical backfill recovered two successful records only; unknown failures are not fabricated.

Migration 00021 applied and recorded as 20261003215000. Authenticated rollback fixtures verified repeated task creation produces one task, cross-workspace insert is rejected, and an unrelated user sees no recipient data. TypeScript, 42 tests and production build passed (build required network access for the existing Inter font). No campaign sends, follow-up tasks or schedules were created outside rolled-back fixtures. Deployment evidence follows after release.

Production v0.9.5 confirmed Ready October 3: code 68ab822 (Stage 1 implementation 17cbafd), deployment dpl_4JUsGwXdG8c3eQ6DQsfNKGEL2FxB, https://crm.getflowplan.app. Attended native Vancouver check verified clickable 1/1 recipient link, exact one-contact Contacts filter and contact timeline Broadcast link. No campaign sends or follow-up mutations performed. Opens show Not tracked. AIOS registry/wiki/task evidence saved; wiki structural check has no errors and three pre-existing unrelated source drifts (social-media-content, real-estate brief, WeddingFlow brief).

## v0.9.6 local candidate — October 5, NOT shipped

Broadcast delivery and clicked-link evidence with unique recipient counts, timestamp/link/engagement filters and contact reporting; selected-recipient draft content fix. [Implementation, validation and pending setup](RESEND-ENGAGEMENT-SETUP.md). 59 tests, TypeScript, production build, isolated SQL/RLS and synthetic local browser checks passed. Full lint has 26 pre-existing errors / 29 warnings, one fewer error than baseline. Migration 00022 and provider/Vercel configuration are unapplied; production remains v0.9.5 until separately approved deployment.

## October 5 PT / October 6 UTC — production release, secret entry pending

Rachel explicitly approved commit/push, migration, deployment and webhook creation. Commit `6f4cb45244f255c0611469ec0343f40f4dc9b4f4` is verified on remote `feature/resend-engagement`; main was not merged. Migration 00022 applied atomically and recorded as `20261006000005 resend_engagement` on existing Supabase `jsnufxpzeuoybgksgnon`. Preflight: 10 recipient rows, no duplicate provider IDs or prior ledger. RLS/grants verified; production transaction proved member visibility, unrelated-identity isolation and write restrictions, then rolled back (zero retained test events).

Clean revision deployed Ready as `dpl_Bcvh6qs3MLncq5C3jE7k5qvHkVnv`, https://flowcrm-hj2sgh7a0-rachelgibb.vercel.app, aliased to https://crm.getflowplan.app. CLI independent inspect confirms Ready. Resend webhook `8f30d4b3-84b5-475e-a07c-628c7c4e47e8` created/enabled for the eight specified events; no opens. Creation form selection and saved endpoint/status verified through the browser; the signing secret was not read or copied.

**Activation is incomplete:** production POST returns JSON 503 `Webhook not configured` as expected. Rachel must privately copy the signing secret from https://resend.com/webhooks/8f30d4b3-84b5-475e-a07c-628c7c4e47e8 into sensitive Production `RESEND_WEBHOOK_SECRET` at https://vercel.com/rachelgibb/flowcrm/settings/environment-variables. Do not paste it in chat. Then redeploy the same reviewed code to activate it and verify invalid unsigned requests return 400. Do not change/retrieve the existing service-role secret. No emails sent or scheduled; full signed-event delivery/click round trip remains unproven. Vercel connector returned team-access 403; approved existing CLI token worked, without credential disclosure. Unrelated AGENTS.md remains uncommitted.

Deployment metadata independently confirms Git SHA `6f4cb45244f255c0611469ec0343f40f4dc9b4f4` and branch `feature/resend-engagement`. Authenticated production PWA inspection confirmed the sent eight-recipient campaign renders delivery/click filters, 8 recipients without evidence, per-recipient Delivery unknown, manual outcomes unchanged, and opens Disabled. This was read-only; no send, schedule, selection action or follow-up record was changed. Native screenshot capture was blank; verification used the accessibility tree. Vercel secret-entry tab currently requires Rachel to sign in. Resend details and Vercel environment tabs are retained for the private handoff; secret details were not inspected. Clean release worktree `/tmp/flowcrm-release-6f4cb45` remains available for the post-entry redeploy.
