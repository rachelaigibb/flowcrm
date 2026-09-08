# FlowCRM — User Guide

*Your quick-start and everyday reference. For what's built and what's pending, see [BUILD-STATUS.md](./BUILD-STATUS.md).*

---

## 1. What FlowCRM is (in plain words)

FlowCRM is **one database that lives in the cloud** (Supabase, hosted in Canada). The app is just a window into that database. It doesn't matter which door you walk through — your laptop, your phone, the office computer — you always see the same data, live.

There are two doors:

| Door | Address | When to use it |
|---|---|---|
| **Live site** | `https://crm.getflowplan.app` | Everyday use, phone, anywhere. Add it to your phone's home screen from Safari → Share → Add to Home Screen. |
| **Local dev** | `http://localhost:3000` (after running `npm run dev` in the project) | Only for developing/testing on the Mac |

**Nothing is "per device."** Adding a contact on your laptop shows up on your phone instantly, because both are reading the same cloud database.

**Your login:** `rachelaigibb@gmail.com` (email + password, or magic link). One login, and it opens your whole agency.

---

## 2. How your account is organized

```
Rachel AI (your agency)
├── Vancouver Real Estate   (sub-account / workspace — your real Vancouver data)
├── Dubai Real Estate       (sub-account / workspace — your real Dubai data)
└── Testing                 (sub-account / workspace — throwaway rows for trying things out)
```

- Each **sub-account** is a separate workspace with its own contacts, pipeline, tasks, forms, and settings.
- Switch between them with the switcher in the sidebar. The **accent colour** you pick in a workspace's Settings colours its buttons and focus rings, so you always know which workspace you're in.
- Vancouver clients live in Vancouver; Dubai investors live in Dubai. They never mix.
- **Try new things in Testing first** — import a sample file there, click around, delete it. Nothing in Testing touches your real workspaces.
- Later, when you sell FlowCRM to other agencies, each agency gets its own org just like yours — they can never see your data (enforced at the database level, not just the app).

---

## 3. Quick start

1. **Log in** at the live site (or localhost) with `rachelaigibb@gmail.com`.
2. **Pick a workspace** (Vancouver or Dubai) in the sidebar.
3. **Add contacts** — Contacts → **Add Contact** (top right), or import in bulk (next section).
4. **Set up your pipeline** — Pipeline page; drag deals between stages. Stages are editable in Settings. Dropping a deal into **Won** or **Lost** sets its status and close date, so Reports agree with the board.
5. **Tasks & Calendar** — tasks can attach to contacts/deals; the calendar shows due dates.
6. **Cmd+K** (Ctrl+K on Windows) — jump anywhere, or type a plain-English question and pick **Ask AI** ("contacts from Instagram with no deals").

## 4. Your daily call block

1. **Calls** in the sidebar → pick a tag (default `past-client`). You get ten people: never-contacted first, then whoever it's been longest since you spoke to.
2. Tap **Call** (dials on your phone) then **Log call**: pick the outcome, add a note, optionally type a next step and pick "3 days" / "1 week" / a date — that becomes a task.
3. Logging stamps **Last contact** = today, so the person drops down the list and the next one rises. Every logged call shows on the contact's timeline.

You can also log a call from any contact page (**Log call** next to **Log Note**).

**Transactions and commission.** A completed sale is a **won deal** on the contact: address, city, side (buyer/seller/tenant), completion date, price, commission, your reference / transaction number, and a note with MLS and listing details. Co-buyers get a note on their own timeline pointing at the deal. Two firm presales that haven't completed are *open* deals in Negotiation with their completion date — they move to Won when they complete.

**Two fields you asked for:** *Last contact* (kept current by the call logger) and *OK to show sale* — yes / no / pending — your record of whether the client agreed to a "sold" marker with neighbourhood and street only on your website.

## 5. Importing your contacts

1. Export from **Google Contacts** (Export → Google CSV) or any spreadsheet as a **CSV**.
2. In FlowCRM: **Contacts → Import CSV**. Google's columns are recognised automatically: names, first email and phone, organisation, birthday, notes (become the first note), address, and **labels → tags** (Google's own "myContacts / Imported on…" labels are dropped).
3. Choose the **consent** to apply to rows without a consent column (past clients = *implied*, an existing business relationship under CASL; never pick *explicit* unless you have their opt-in), and the **tag every imported contact gets** (default `import-YYYY-MM`) so you can find or undo a batch.
4. Rows whose email already exists are **skipped**, not duplicated.
5. Do this once per workspace — and try it in **Testing** first.

**Consent matters (CASL):** every contact has a consent status. Broadcasts only go to contacts marked **explicit** or **implied** consent. Set it correctly at import time and you'll never accidentally email someone you shouldn't.

## 6. Getting website leads into FlowCRM

FlowCRM has a **form builder** with public forms that automatically create contacts:

1. Switch to the right workspace (e.g. Vancouver).
2. **Forms → New Form** — add fields (name, email, phone, message).
3. In form settings, turn on **create contact**, publish, and copy the public link (`/f/your-form`).
4. Put that form on your website — either link to it, or embed it, or (best) have the website's existing contact form submit to it.

**Your routing plan:**
- `rachelgibbrealtor.ca` contact form → **Vancouver Real Estate** — *already live*: the site inserts leads directly (tags `website`, `contact-form`; CASL consent from the form checkbox)
- `deals.rachelgibbrealtor.ca` email-gate form → **Vancouver Real Estate**, tag `deal-list` — *being built*
- `rachelgibbrealtor.com` and `buyingindubai.com` forms → **Dubai Real Estate** — *being built*, same code as the `.ca` pipe

Each submission creates the contact in the right workspace (or updates it if the email already exists) and can kick off an automation (e.g. instant follow-up email).

## 7. Sending email & SMS

- **Per-workspace settings**: Settings → Email (your from-name/from-email via Resend) and Settings → SMS (your Twilio number).
- **One-off messages**: from any contact page — Email / SMS buttons.
- **Templates**: saved in Settings, usable in compose, automations, and broadcasts. Personalization tokens work everywhere: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{phone}}`.
- **Broadcasts**: campaigns to filtered groups (by tag/source/all). Consent-gated automatically.
- **Automations**: trigger → steps (send email/SMS, wait, add/remove tag, create task). Triggers: contact created, tag added, deal stage change, form submission, manual.
  - ⚠️ **"Wait" steps resume when someone uses the app**, not on a clock. A "wait 1 day" step fires the next time you open the Automations pages after the day has passed. Fine for solo use; needs a scheduler before selling to agencies.

## 8. AI features

The API key is set. On any contact page:

- **Score lead** (contact page) — 0–100 conversion likelihood with reasoning.
- **Summarize** — the whole relationship in a paragraph.
- **Draft email / Draft SMS** — writes a follow-up from the contact's real history, opens your compose window prefilled. **You always review and press Send yourself. Nothing auto-sends. Ever.**
- **Ask AI** in Cmd+K — plain-English search.

Each click costs roughly a cent or two of API usage.

---

## 9. Maintenance & gotchas

| Thing | What to know |
|---|---|
| **Auth emails (reset / magic link)** | Come from `FlowCRM <flowcrm@rachelgibbrealtor.com>` via Resend. Links work on any device. If one doesn't arrive, check Spam/Promotions in the account you log in with (`rachelaigibb@gmail.com`), then Resend → Emails shows whether it was delivered. |
| **Supabase free tier pauses** | If nobody touches the app for ~a week, Supabase pauses the database. It wakes automatically but the first load is slow, and it once scrambled admin credentials (fixed by Dashboard → Project Settings → Database → Reset database password). Using the CRM regularly prevents this; upgrading to Supabase Pro removes it entirely. |
| **Forgot password** | Login page → **Forgot password?** → email link → set a new one. |
| **Deploys** | Any push to `main` on GitHub auto-deploys the live site via Vercel in ~2 minutes. |
| **Secrets** | API keys live in Vercel env vars and `.env.local` — never in code. All seven are set in Vercel (Supabase ×2, Resend, Twilio ×2, Anthropic, site URL). |
| **Backups** | Supabase free tier keeps daily backups for 7 days. Export important data periodically (Contacts → Export CSV). |

## 10. Where to get help

Open the project in Claude Code (`~/Projects/flowcrm`) and describe what you want — the project's `.claude/CLAUDE.md` carries the full architecture memory, and this guide plus BUILD-STATUS.md keep the current state.

## Reports by year (v0.5.1)
The range picker at the top of Reports lists This Week / Month / Quarter / Year, All Time, and then every year that has data. Pick a year to see that year's deals month by month; All Time shows one bar per year. Deals are dated by their completion (closed) date. On Contacts, the header shows "8 of 156 contacts" while a search or tag filter is active.

## Period pickers (v0.5.2)
- **Dashboard**: the picker at the top right sets the period for Won, New Contacts and Activities. Open Deals, Pipeline Value and Tasks are always all-time. Your choice is remembered for the workspace. Clicking Open Deals opens the pipeline list showing only open deals; clicking Won opens the list of deals won in that period.
- **Pipeline**: the picker beside "Stages:" limits closed (won/lost) deals to the period; open deals always show because they are current work. The Won total follows the picker. Cards and the list are newest first, and the list's Close Date column is the actual completion date for won deals.
- **Stage chips** (New, Qualified, Won…): clicking one hides that stage from the board, list and totals so you can focus on the rest. Click again to bring it back. They are a view toggle, not a status change.
- **Reports**: "Sales Over Time" is sold volume; "Commission Over Time" is your income, with the total for the chosen range in its subtitle.

## Tag picker (v0.5.3)
On Add Contact and in Edit Profile, tags are pills. Click × on a pill to remove it. "Add tag" opens the list of every tag in the workspace (with its colour) — click to add, and if you type something that doesn't exist yet, choose "Create" to add it. New tags are coloured automatically and appear in Settings → Tags where you can recolour or rename them. Sources are colour-coded in the contact list and on the profile.

## Deal types (v0.5.4)
Every deal has a **Deal type** (Buyer, Seller, Both, Tenant, Landlord, Referral by default). It shows as a badge on pipeline cards, as a column in the list, and there is a Type filter beside Status. Change the list for a workspace in Settings → Sub-account → Deal types (comma-separated), so a non-real-estate business can use its own, for example "new business, renewal, upsell". Editing a deal (Edit in the deal panel) now lets you change the contact, address, deal type, close date, commission, reference and the other-side agent.

## App icon (v0.5.5)
FlowCRM now uses the purple FlowCRM mark for the browser tab and home-screen installs. Phones cache icons, so an app you installed earlier keeps the old "F" until you remove it from the home screen and add it again (Share → Add to Home Screen on iPhone; Install app in Chrome on Android).
