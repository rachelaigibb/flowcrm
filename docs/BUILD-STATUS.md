# FlowCRM — Build Status

**Current version: v0.4 "AI"** · Last updated 2026-08-12 · Latest commit `0f39a69`

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

| # | Task | Where | Unblocks |
|---|---|---|---|
| 1 | Add redirect URLs `http://localhost:3000/**` and `https://crm.getflowplan.app/**` | Supabase → Authentication → URL Configuration | Magic links + password reset |
| 2 | Add `ANTHROPIC_API_KEY` to **Vercel** env vars, then redeploy (`.env.local` ✅ done 2026-08-13) | console.anthropic.com → Vercel | All Phase 4 AI features in production |
| 3 | Set `NEXT_PUBLIC_SITE_URL=https://crm.getflowplan.app` in Vercel, then redeploy | Vercel → Env Vars | Auth emails linking to the live site instead of `localhost:3000` |
| 4 | Verify `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` are set in Vercel | Vercel → Env Vars | Real email/SMS sending in production |

**✅ Done 2026-08-13 — custom domain live.** `crm.getflowplan.app` → Cloudflare CNAME (DNS-only / grey cloud) → Vercel. Valid Let's Encrypt cert, publicly reachable, no SSO wall. *Cloudflare proxying must stay OFF for this record — orange cloud breaks Vercel's certificate.*

**Unverified from outside the dashboards:** items 2 and 3 above. Test both at once — request a password reset and check the emailed link starts with `https://crm.getflowplan.app`; then click **Score lead** on a contact to confirm the AI key.

---

## 🔨 Not started / next candidates

| Item | Notes |
|---|---|
| **Website form → FlowCRM wiring** | Point `rachelgibbrealtor.ca` contact form at a Vancouver-workspace form, and the `.com`/Dubai site at a Dubai-workspace form. Form builder already exists; this is connecting the sites to it. **Highest practical value for daily use.** |
| **Automation scheduler (cron)** | "Wait" steps currently resume only when someone loads the automations pages. Needs a Vercel cron or queue before selling to other agencies. |
| **Auto-score on contact change** | Phase 4 leftover — scoring is manual (button click) today. |
| **AI in pipeline / broadcast views** | Phase 4 leftover — AI is contact-page + Cmd+K only. |
| **Phase 5 — landing page builder** | Evaluate GrapeJS vs Craft.js. The last "Coming Soon" item in the sidebar ("Website"). |
| **Broadcast queue** | Current send loop runs inside the server action — fine for hundreds of recipients (300s Vercel limit), needs a queue for thousands. |
| **Supabase Pro** | Free tier auto-pauses after ~a week idle (this bit us once). ~$25/mo removes it and improves backups. |

## 🗄️ Deliberately deferred (decided, not forgotten)

- **Per-tenant AI keys** — one global `ANTHROPIC_API_KEY` for now; per-agency billing comes when there are paying agencies.
- **Engine tag changes don't fire `tag_added` triggers** — prevents infinite automation loops.
- **No open-rate / click tracking on broadcasts** — `stats.opened` exists in the schema but nothing populates it; would need Resend webhooks.

---

## Data state (as of 2026-08-12)

Production database cleaned of all test data. Live: 1 login (`rachelaigibb@gmail.com`), 1 org (Rachel AI), 2 sub-accounts (Vancouver Real Estate, Dubai Real Estate), 2 real contacts, 1 won deal, 1 disabled automation.

## Version history

| Version | Date | What landed |
|---|---|---|
| v0.1 | 2026-06-29 | Phase 1 — foundation |
| v0.2 | 2026-06-30 | Phase 2 — email, SMS, forms, automations, broadcasts (UI only) |
| v0.3 | 2026-07-01 | Phase 3 — collaboration, map, reports |
| v0.3.1 | 2026-07-07 | Auth callback fix; automations + broadcasts actually execute |
| v0.4 | 2026-07-07 | Phase 4 — AI layer |
| **v0.4.1** | 2026-08-13 | **Live domain + app icon, PWA manifest, installable on phone (current)** |
| v0.5 | planned | Website form wiring + automation scheduler |
| v1.0 | goal | Ready to sell to other agencies |

*Keep this table updated when a phase ships. Bump `version` in `package.json` to match.*
