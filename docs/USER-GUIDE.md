# FlowCRM — User Guide

*Your quick-start and everyday reference. For what's built and what's pending, see [BUILD-STATUS.md](./BUILD-STATUS.md).*

---

## 1. What FlowCRM is (in plain words)

FlowCRM is **one database that lives in the cloud** (Supabase, hosted in Canada). The app is just a window into that database. It doesn't matter which door you walk through — your laptop, your phone, the office computer — you always see the same data, live.

There are two doors:

| Door | Address | When to use it |
|---|---|---|
| **Live site** | `https://crm.getflowplan.app` *(once DNS is set up — see BUILD-STATUS)* | Everyday use, phone, anywhere |
| **Local dev** | `http://localhost:3000` (after running `npm run dev` in the project) | Only for developing/testing on the Mac |

**Nothing is "per device."** Adding a contact on your laptop shows up on your phone instantly, because both are reading the same cloud database.

**Your login:** `rachelaigibb@gmail.com` (email + password, or magic link). One login, and it opens your whole agency.

---

## 2. How your account is organized

```
Rachel AI (your agency)
├── Vancouver Real Estate   (sub-account / workspace)
└── Dubai Real Estate       (sub-account / workspace)
```

- Each **sub-account** is a separate workspace with its own contacts, pipeline, tasks, forms, and settings.
- Switch between them with the switcher in the sidebar.
- Vancouver clients live in Vancouver; Dubai investors live in Dubai. They never mix.
- Later, when you sell FlowCRM to other agencies, each agency gets its own org just like yours — they can never see your data (enforced at the database level, not just the app).

---

## 3. Quick start

1. **Log in** at the live site (or localhost) with `rachelaigibb@gmail.com`.
2. **Pick a workspace** (Vancouver or Dubai) in the sidebar.
3. **Add contacts** — Contacts → **Add Contact** (top right), or import in bulk (next section).
4. **Set up your pipeline** — Pipeline page; drag deals between stages. Stages are editable in Settings.
5. **Tasks & Calendar** — tasks can attach to contacts/deals; the calendar shows due dates.
6. **Cmd+K** (Ctrl+K on Windows) — jump anywhere, or type a plain-English question and pick **Ask AI** ("contacts from Instagram with no deals").

## 4. Importing your contacts

1. Export your contacts from GoHighLevel / spreadsheet as a **CSV** file.
2. In FlowCRM: **Contacts → Import CSV**.
3. Match the columns (first name, last name, email, phone, tags…) and import.
4. Do this once per workspace — Vancouver contacts into Vancouver, Dubai into Dubai.

**Consent matters (CASL):** every contact has a consent status. Broadcasts only go to contacts marked **explicit** or **implied** consent. Set it correctly at import time and you'll never accidentally email someone you shouldn't.

## 5. Getting website leads into FlowCRM

FlowCRM has a **form builder** with public forms that automatically create contacts:

1. Switch to the right workspace (e.g. Vancouver).
2. **Forms → New Form** — add fields (name, email, phone, message).
3. In form settings, turn on **create contact**, publish, and copy the public link (`/f/your-form`).
4. Put that form on your website — either link to it, or embed it, or (best) have the website's existing contact form submit to it.

**Your routing plan:**
- `rachelgibbrealtor.ca` contact form → a form created in the **Vancouver Real Estate** workspace
- `buyingindubai.com` / `.com` site → a form created in the **Dubai Real Estate** workspace

Each submission creates the contact in the right workspace, tagged `source: form`, and can kick off an automation (e.g. instant follow-up email). *Wiring the actual website forms to FlowCRM is a small build task — see BUILD-STATUS → Not started.*

## 6. Sending email & SMS

- **Per-workspace settings**: Settings → Email (your from-name/from-email via Resend) and Settings → SMS (your Twilio number).
- **One-off messages**: from any contact page — Email / SMS buttons.
- **Templates**: saved in Settings, usable in compose, automations, and broadcasts. Personalization tokens work everywhere: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{phone}}`.
- **Broadcasts**: campaigns to filtered groups (by tag/source/all). Consent-gated automatically.
- **Automations**: trigger → steps (send email/SMS, wait, add/remove tag, create task). Triggers: contact created, tag added, deal stage change, form submission, manual.
  - ⚠️ **"Wait" steps resume when someone uses the app**, not on a clock. A "wait 1 day" step fires the next time you open the Automations pages after the day has passed. Fine for solo use; needs a scheduler before selling to agencies.

## 7. AI features (need the API key first)

Once `ANTHROPIC_API_KEY` is set (see BUILD-STATUS → Pending setup):

- **Score lead** (contact page) — 0–100 conversion likelihood with reasoning.
- **Summarize** — the whole relationship in a paragraph.
- **Draft email / Draft SMS** — writes a follow-up from the contact's real history, opens your compose window prefilled. **You always review and press Send yourself. Nothing auto-sends. Ever.**
- **Ask AI** in Cmd+K — plain-English search.

Each click costs roughly a cent or two of API usage.

---

## 8. Maintenance & gotchas

| Thing | What to know |
|---|---|
| **Supabase free tier pauses** | If nobody touches the app for ~a week, Supabase pauses the database. It wakes automatically but the first load is slow, and it once scrambled admin credentials (fixed by Dashboard → Project Settings → Database → Reset database password). Using the CRM regularly prevents this; upgrading to Supabase Pro removes it entirely. |
| **Forgot password** | Login page → **Forgot password?** → email link → set a new one. (Requires the Supabase redirect allowlist — see BUILD-STATUS.) |
| **Deploys** | Any push to `main` on GitHub auto-deploys the live site via Vercel in ~2 minutes. |
| **Secrets** | API keys live in Vercel env vars and `.env.local` — never in code. Current keys: Supabase (set), `RESEND_API_KEY` / Twilio (check Vercel), `ANTHROPIC_API_KEY` (pending). |
| **Backups** | Supabase free tier keeps daily backups for 7 days. Export important data periodically (Contacts → Export CSV). |

## 9. Where to get help

Open the project in Claude Code (`~/Projects/flowcrm`) and describe what you want — the project's `.claude/CLAUDE.md` carries the full architecture memory, and this guide plus BUILD-STATUS.md keep the current state.
