# FlowCRM

A multi-tenant, AI-first CRM and business operating system. Built to replace GoHighLevel — Rachel uses it first, then it's sold to other agencies.

**Live:** https://crm.getflowplan.app · **Version:** v0.4 "AI"

---

## 📖 Documentation

| Doc | For | What's in it |
|---|---|---|
| **[docs/USER-GUIDE.md](./docs/USER-GUIDE.md)** | Using the CRM | Where to log in, importing contacts, website forms, email/SMS, AI features, maintenance |
| **[docs/BUILD-STATUS.md](./docs/BUILD-STATUS.md)** | Building the CRM | What's shipped by phase, pending setup tasks, what's not started, version history |
| [.claude/CLAUDE.md](./.claude/CLAUDE.md) | Claude Code | Architecture rules, conventions, decision log |

---

## Development

```bash
npm run dev          # http://localhost:3000
npm run test         # Vitest
npx tsc --noEmit     # typecheck before committing
```

Push to `main` → Vercel auto-deploys.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + RLS) · Vercel · Resend · Twilio · Claude API
