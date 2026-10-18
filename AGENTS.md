<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Codex project bridge — 2026-09-28

- Read `/Users/rachelgibb/Projects/my-AIOS/context/project-registry.md` for cross-project routes and `/Users/rachelgibb/Projects/my-AIOS/context/command-center.md` for the command-center migration state. Keep this repository as the source of truth for its code, project facts, and artifacts; do not copy its code into my-AIOS.
- The Claude project content above is retained. Claude-only `@file` imports are not assumed to execute in Codex: open referenced documentation explicitly. Preserve deeper project rules, particularly `.claude/CLAUDE.md` when this manual routes there.
- Global reusable skills live in `~/.agents/skills/`; project skills live in `.agents/skills/`. Consult `/Users/rachelgibb/Projects/my-AIOS/references/codex-migration.md` for reused skills, custom adaptations, and remaining tool dependencies. For the four-brand brief workflow use `$rachel-brand-brief`; do not create a shared multi-brand `brand-brief.md`.
- Legacy `/mcc` and `/track` calls route through `$command-center-operations` in Codex. The new command-center destination must be verified before writing; an old artifact instruction is not proof that Codex can write its database. Preserve task IDs and provenance, and never fork task stores or duplicate schedules.
- Source status dates are historical until verified. The latest confirmed user instruction wins over older plans: Vancouver first; Flow CRM for internal use, sales/install services shelved; American Title and Closing shelved. Intendly, Crystal Lore, Rythmia, and Grain & Slate are excluded from this migration. Preserve partner/client account boundaries.
- Use the actual project stack and deployment rules. Generic Next.js/Vercel instructions do not apply to a Vite PWA or Cloudflare release branch. Changes to these Markdown instructions do not require deployment or committing unrelated work.


## Routine AIOS writeback — approved 2026-10-02

During relevant authorized work, follow `/Users/rachelgibb/Projects/my-AIOS/references/cross-project-maintenance.md`. Read that routine at session start and apply it when material confirmed facts, decisions, resource locations, verified outcomes or blockers change, and before finishing substantial work. Rachel authorizes these relevant local AIOS and wiki updates without a repeated prompt. Keep project detail here, update canonical AIOS records first, maintain the source-backed wiki and use the existing command-center interface for relevant task progress. Read current dated AIOS guidance over older summaries. Verify saves; report permissions/conflicts explicitly instead of claiming synchronization. Keep private AIOS material out of project repositories. This is session-based maintenance, not a background watcher.
