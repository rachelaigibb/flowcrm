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
- **Phase 1** (current): Auth + multi-tenant + contacts + pipeline + dashboard + tasks + settings
- **Phase 2**: Form builder + email automations (Resend) + SMS automations (Twilio) + calendar
- **Phase 3**: Agency collaboration + invite flow + role-based UI + deal map + reporting
- **Phase 4**: AI service layer + lead scoring + draft follow-ups + timeline summaries + NL search
- **Phase 5**: Landing page templates (evaluate GrapeJS/Craft.js)
