# FlowCRM — CLAUDE.md

## What this is
A multi-tenant, AI-first CRM and business operating system. Built to replace GoHighLevel. Rachel uses it first, then sells to other agencies.

- **Domain**: crm.getflowplan.app
- **Repo**: rachelaigibb/flowcrm

## Stack
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend/Data**: Supabase (Postgres + Auth + RLS + Storage + Edge Functions)
- **Email**: Resend (Phase 2)
- **SMS**: Twilio (Phase 2)
- **Maps**: Leaflet + OpenStreetMap (Phase 3)
- **AI**: Claude API via provider-agnostic interface (Phase 4)
- **Testing**: Vitest + Testing Library
- **Hosting**: Vercel
- **Supabase project ID**: jsnufxpzeuoybgksgnon (ca-central-1)

## Design
This is a **SaaS product**, NOT Rachel's real estate brand. Use a clean, modern, neutral design — think Linear, Notion, ClickUp. Do NOT use gold/black luxury colors or real estate brand voice. shadcn/ui default neutral dark theme.

## Architecture rules
- Feature-based folder organization under `src/features/`
- Server Components by default; Client Components only when interactivity requires it
- Server Actions for mutations (in `features/*/actions.ts`)
- All database queries go through Supabase client — never raw SQL in components
- RLS enforces multi-tenant isolation. Every tenant-scoped table has `org_id` + `sub_account_id`
- Generated types: run `npx supabase gen types typescript --project-id jsnufxpzeuoybgksgnon > src/types/database.ts` after any migration
- No barrel exports. Import directly from the file.

## Multi-tenancy
- **Organization** = top-level tenant (agency)
- **Sub-account** = client workspace within an org
- Users have org-level roles (owner/admin/member) AND sub-account-level roles (admin/collaborator)
- RLS policies on every table. Org admins see all sub-accounts; collaborators see only assigned ones.
- **NEVER trust client-side org_id/sub_account_id.** Always derive from the authenticated user's memberships.
- Current sub-account stored in cookie: `flowcrm_sub_account_id`

## File structure
```
src/
  app/                    # Next.js App Router pages
    (auth)/               # Login, signup (unauthenticated)
    (dashboard)/          # Authenticated app shell
      contacts/           # Contact list + detail
      pipeline/           # Kanban board
      tasks/              # Task management
      settings/           # Org + sub-account settings
  components/
    ui/                   # shadcn/ui base components
    shared/               # App-wide: sidebar, switcher, providers
  features/
    auth/                 # Auth actions
    contacts/             # Components, hooks, actions, types
    pipeline/             # Pipeline/deals feature
    tasks/                # Tasks feature
    activities/           # Activity timeline
    settings/             # Settings actions
    ai/                   # AI service layer (Phase 4)
  lib/
    supabase/             # Client, server, middleware helpers
    utils/                # Currency, dates, CSV parsing
  types/
    database.ts           # TypeScript types (manual, later generated)
supabase/
  migrations/             # SQL migrations
tests/
  features/               # Test files mirroring src/features
```

## Conventions
- Use `cn()` (from `lib/utils`) for conditional class names
- Currency: always store as `{ value: numeric, currency: string }`. Format with `lib/utils/currency.ts`
- Dates: always `timestamptz` in Postgres. Display in user's sub-account timezone.
- Consent: every contact must have `consent_status`. Marketing emails require `explicit` consent (CASL).
- Component files: PascalCase concepts, kebab-case filenames. Utility files: kebab-case.
- Icons: lucide-react only

## Testing
- Unit tests for business logic (currency formatting, CSV parsing)
- Component tests for interactive UI (pipeline drag-drop, contact form validation)
- Run: `npm run test` (Vitest)
- Test files in `tests/` mirroring `src/features/` structure

## Deployment
- Push to `main` → Vercel auto-deploys to crm.getflowplan.app
- Run `npx tsc --noEmit` before committing
- Commit ALL modified files before declaring done
- Confirm Vercel shows ● Ready before declaring live
- Supabase migrations: apply via Supabase dashboard or `npx supabase db push`

## What NOT to do
- Never auto-send client-facing messages without explicit user approval
- Never store secrets in code — use Vercel env vars + .env.local
- Never bypass RLS with service-role client except in Edge Functions for webhooks
- Never add a dependency without justifying it
- Never use the gold/black real estate brand colors or voice
- Never delete files without Rachel's explicit approval

## Phases
- **Phase 1** (EXTENDED 2026-06-29 — LeadStack parity): Auth + multi-tenant + contacts (CRUD, CSV import/export, source badges, colored tags) + pipeline (kanban+list, stage/value/source filters, stats row) + tasks (separated select/complete checkboxes) + calendar (month grid) + dashboard (welcome, 6 stats, timezone-aware) + settings (agency + sub-account split) + two-tier sidebar + light/dark/system theme + Cmd+K search + notes with edit/delete + agency home + sub-accounts pages
- **Phase 2** (2026-06-30): Email sending via Resend (compose dialog, templates, settings) + SMS via Twilio (compose dialog, templates, settings) + Form builder (visual editor, public submission page, auto-create contacts) + Automations (trigger→step sequences, 5 triggers, 6 action types, run history) + Broadcasts (email/SMS campaigns, recipient filtering by tags/source/all, consent enforcement, send/schedule)
- **Phase 3** (DONE 2026-07-01): Agency collaboration + invite flow + role-based UI + deal map + reporting
- **Phase 4** (CORE SHIPPED 2026-07-07): AI service layer (provider-agnostic, Claude API) + lead scoring + draft follow-ups + timeline summaries + NL search in Cmd+K. Requires `ANTHROPIC_API_KEY` env var. Remaining ideas: auto-score on contact change, AI in pipeline/broadcast views.
- **Phase 5**: Landing page templates (evaluate GrapeJS/Craft.js)

## Architecture decisions log (2026-06-29)
- **Tags**: stored in `sub_accounts.settings.tags` JSONB array (not a separate table). Scoped per sub-account. Each tag: `{id, name, color}`. ID via `crypto.randomUUID()`.
- **Sub-account cookie fallback**: `flowcrm_sub_account_id` cookie may not exist on first login. `getSubAccountId()` (lib/supabase) and `getUserContext()` (lib/supabase) both fall back to DB lookup. Never read the cookie without fallback.
- **SECURITY DEFINER for bootstrapping**: `create_org_with_defaults` and `create_sub_account_with_defaults` are PG functions that bypass RLS for multi-table inserts. Don't try to do this via the Supabase client — RLS can't see same-transaction inserts.
- **Design system**: `lib/constants/colors.ts` is the single source of truth for priority/status/activity colors. `PriorityBadge` and `StatusBadge` in `components/shared/status-badges.tsx`. Never hardcode status colors in components.
- **CRUD pattern**: Add=top-right (MUST be visible on page load), Edit=ghost in detail, Delete=header row ghost destructive icon + confirmation dialog. Must be identical across all modules.
- **shadcn/ui v4**: No `asChild` prop. Use `render` prop. `SelectValue` needs children for labels. See nextjs-fullstack skill for full gotchas.

## Architecture decisions log (2026-06-30)
- **Two-tier sidebar**: AGENCY section (Home, Sub-accounts, Settings Agency) + SUB-ACCOUNT section (Dashboard, Contacts, Pipeline, Calendar, Tasks + Coming Soon placeholders). Matches LeadStack structure.
- **Theme toggle**: Global in header bar (cycles dark→light→system). NOT per-sub-account — `next-themes` uses one localStorage value, can't scope per sub-account.
- **Kanban overflow trap**: Kanban columns wider than viewport expand the parent flex column, pushing header buttons off-screen. `overflow-hidden` and `min-w-0` do NOT reliably fix this through sidebar layout chains. Fix: `style={{ width: 0, minWidth: "100%" }}` on the outer pipeline container — zero intrinsic width prevents children from expanding it.
- **Dashboard timezone**: Use `Intl.DateTimeFormat` with the sub-account's timezone setting, not server `new Date()`.
- **Notes pattern**: Heading + "+" button (no open textarea). Dialog for add/edit. Edit (pencil) + delete (trash) on hover. `editNote`/`deleteNote` server actions in contacts/actions.ts.
- **Contact detail layout (2026-06-30)**: Three-panel CRM layout (HubSpot/Salesforce pattern). Left panel (280px fixed): profile, email/phone links, source, tags, edit/delete. Center panel (flex-1, scrollable): action bar (Log Note, Email, Call) + unified chronological activity feed. Right panel (300px fixed): deals card + tasks card, each with `CardAction` slot for "+ Deal" / "+ Task" buttons (solid, not ghost). Mobile: collapses to tabs (Profile | Activity | Deals & Tasks).
- **CardHeader is CSS grid, not flex**: shadcn v4 `CardHeader` uses `grid` layout. Don't add `flex-row` / `justify-between` classes — they won't override. Use `CardAction` slot for top-right positioned buttons.
- **Tag colors must propagate**: Fetch `sub_accounts.settings.tags` and pass `tagColors` array to every component that renders tags — not just settings. Use inline `style` with `${color}20` background tint.

## Architecture decisions log (2026-06-30 — Phase 2)
- **Email via Resend**: `lib/resend/client.ts` singleton. Settings in `sub_accounts.settings.email` JSONB (`from_name`, `from_email`, `reply_to`). Compose dialog on contact detail replaces `mailto:` link. Sent emails logged as `email` activity type. Email templates in `email_templates` table (per sub-account).
- **SMS via Twilio**: `lib/twilio/client.ts` singleton. Settings in `sub_accounts.settings.sms` JSONB (`twilio_phone_number`). Compose dialog on contact detail. SMS logged as `sms` activity type. SMS templates in `sms_templates` table.
- **Twilio/Resend credentials are env vars, not per-tenant**: `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` are global. Per-sub-account settings only control the "from" identity (email/phone).
- **Form builder**: `forms` table with `fields` JSONB array and `settings` JSONB. Public form at `/f/[slug]` (no auth). Auto-creates contacts on submission if `settings.create_contact` is true. Form submissions in `form_submissions` table with open RLS INSERT policy (anyone can submit).
- **Automations**: Linear step sequences (not flowcharts). 5 trigger types: form_submission, contact_created, deal_stage_change, tag_added, manual. 6 action types: send_email, send_sms, wait, add_tag, remove_tag, create_task. Steps saved as batch (delete-all + reinsert). Execution engine live as of 2026-07-07 — see that log entry.
- **Broadcasts**: Email or SMS campaigns. Recipient filtering by tags (OR), sources (OR), or all. CASL consent enforcement: only contacts with `explicit` or `implied` consent receive broadcasts. Stats tracked in `stats` JSONB on the broadcast record. Real send loop live as of 2026-07-07 — see that log entry.
- **Sidebar**: Forms, Automations, Broadcasts now active links. Remaining Coming Soon: Website, Reports.

## Architecture decisions log (2026-07-01 — Phase 3)
- **Member invitations**: `invitations` table with token-based acceptance. `accept_invitation()` SECURITY DEFINER function creates membership + sub_account_memberships atomically. Invite email sent via Resend (if configured). Invite link: `/invite/[token]`. 7-day expiry. Org admins can revoke.
- **Role-based UI**: `RoleProvider` context in dashboard layout wraps all children. `useRole()` hook returns `{ orgRole, userId, isAdmin }`. Sidebar hides Agency section for non-admins. Agency pages redirect members to dashboard. Server actions check `orgRole` before destructive operations.
- **Deal map**: `/pipeline/map` uses Leaflet + OpenStreetMap via react-leaflet. Dynamically imported with `ssr: false`. CircleMarker (not Marker) colored by pipeline stage. Deals geocoded via Nominatim on create/update. Address field added to deals table (`address`, `latitude`, `longitude`).
- **Reports**: `/reports` with 6 CSS-only charts (no charting library): pipeline funnel, revenue over time, conversion rate, contact growth, top sources, task completion. Client-side date range filtering via date-fns. CSV export.
- **Resend + Google Workspace coexistence**: DKIM CNAME records don't conflict with Google MX. SPF records must be merged into ONE TXT record (never two `v=spf1` records on the same domain). `rachelgibbrealtor.com` already verified in Resend from the investor-portal project.
- **Sidebar**: Forms, Automations, Broadcasts, Reports now active. Only "Website" remains Coming Soon.

## Architecture decisions log (2026-07-07)
- **Auth callback**: `/auth/callback` route handler exchanges the email-link `code` via `exchangeCodeForSession`, then redirects to `next` (same-origin paths only). Magic link and password reset (`/reset-password` page) both route through it. Supabase Auth redirect allowlist must contain `http://localhost:3000/**` and `https://crm.getflowplan.app/**`.
- **Automation engine** (`features/automations/engine.ts`): executes run steps inline in the triggering server action. `wait` steps pause the run (`status=paused`, `resume_at`) — resumed opportunistically by `processDueAutomationRuns()` when automations pages load. NO cron/queue yet: waits only resume when someone uses the app. Engine tag changes deliberately don't fire `tag_added` triggers (prevents automation-chaining loops). Failed sends mark the run `failed` with the error visible in run history.
- **Trigger wiring**: contact_created (createContact), tag_added (updateContact, per newly added tag, case-insensitive), deal_stage_change (moveDeal, respects `trigger_config.stage_id`), manual (runAutomationManually), form_submission (anon can't pass RLS → `enqueue_form_automation_runs()` SECURITY DEFINER function enqueues paused runs due immediately; engine picks them up on next authed visit).
- **Migration 00012**: `automation_runs` was missing `sub_account_id` + `log` columns that the Phase 2 code already wrote (manual runs silently failed). Added both + `resume_at`.
- **Shared messaging helpers** (`lib/messaging/send.ts`): `sendEmailToContact`/`sendSmsToContact` (send + activity log in one call) and `renderTemplate` with `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{phone}}` tokens (whitespace-tolerant, case-insensitive). Used by the engine and broadcasts; single-contact compose dialogs still use their own actions.
- **Broadcast sends**: real per-recipient loop, batches of 5, personalized via renderTemplate, stats updated after every batch (live progress on refresh). Final status `sent` if ≥1 delivered, `failed` if zero. Runs inside the server action — fine for hundreds of recipients (300s Vercel limit); revisit with a queue for thousands.
- **Testing**: `npm run test` script added (was missing); jsdom installed (vitest.config referenced it but it was never installed — the suite had never run). First test: `tests/features/messaging/render-template.test.ts`.

## Architecture decisions log (2026-07-07 — Phase 4 AI)
- **Provider-agnostic AI layer** (`features/ai/provider.ts`): `AIProvider` interface with `complete` (text) and `completeJSON` (structured outputs via `output_config.format` json_schema). Claude implementation via `@anthropic-ai/sdk`, model `claude-opus-4-8`, adaptive thinking. Singleton; `isAIConfigured()` gates every action with a friendly error when `ANTHROPIC_API_KEY` is missing.
- **Contact context builder**: one text block (profile + deals w/ stages + tasks + last 50 activities) shared by scoring/summaries/drafts — keep prompts fed from this single function.
- **Lead scoring**: stored in `contacts.metadata.ai_score` JSONB (`{score, tier, reasoning, factors, scored_at}`) — no migration needed. Rendered by `AIPanel` (top of contact-detail right panel).
- **Follow-up drafts are never auto-sent**: `draftFollowUp` returns a draft; `AIPanel` opens the existing compose dialogs prefilled via new optional `initialSubject`/`initialBody` props. User must click Send.
- **NL search**: `aiSearch` translates the query to a structured intent (entity + filters) via completeJSON, then runs normal RLS-scoped Supabase queries — the model never sees other tenants' data and never writes SQL. Wired into Cmd+K as an "Ask AI" item (item `value` includes the live query so cmdk's filter always shows it).
- **Env**: `ANTHROPIC_API_KEY` required (Vercel env var + `.env.local`). Per-tenant keys deliberately deferred.
