"use server"

import { revalidatePath } from "next/cache"
import { getUserContext } from "@/lib/supabase/get-user-context"
import { getAIProvider, isAIConfigured } from "./provider"

// ── Types ──

export interface LeadScore {
  score: number
  tier: "hot" | "warm" | "cold"
  reasoning: string
  factors: string[]
  scored_at: string
}

export interface FollowUpDraft {
  subject: string | null
  body: string
}

export interface AISearchResult {
  id: string
  title: string
  subtitle: string
  href: string
}

export interface AISearchResponse {
  interpretation: string
  results: AISearchResult[]
}

// ── Context builder ──
// Assembles everything the model needs about a contact into one text block.

async function buildContactContext(
  supabase: Awaited<ReturnType<typeof getUserContext>>["supabase"],
  orgId: string,
  subAccountId: string,
  contactId: string
) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("org_id", orgId)
    .eq("sub_account_id", subAccountId)
    .single()

  if (!contact) return null

  const [{ data: activities }, { data: deals }, { data: tasks }] = await Promise.all([
    supabase
      .from("activities")
      .select("type, content, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("deals")
      .select("title, value, currency, status, created_at, stage:pipeline_stages(name)")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("title, status, priority, due_date")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown"

  const lines: string[] = [
    `CONTACT: ${name}`,
    `Email: ${contact.email ?? "none"} | Phone: ${contact.phone ?? "none"} | Company: ${contact.company ?? "none"}`,
    `Source: ${contact.source ?? "unknown"} | Consent: ${contact.consent_status} | Tags: ${(contact.tags as string[])?.join(", ") || "none"}`,
    `Created: ${contact.created_at}`,
    "",
    `DEALS (${deals?.length ?? 0}):`,
    ...(deals ?? []).map((d) => {
      const stage = d.stage as { name?: string } | { name?: string }[] | null
      const stageName = Array.isArray(stage) ? stage[0]?.name : stage?.name
      return `- ${d.title} | ${d.currency} ${d.value} | stage: ${stageName ?? "?"} | status: ${d.status} | created ${d.created_at?.slice(0, 10)}`
    }),
    "",
    `TASKS (${tasks?.length ?? 0}):`,
    ...(tasks ?? []).map(
      (t) => `- [${t.status}] ${t.title} | priority: ${t.priority} | due: ${t.due_date ?? "none"}`
    ),
    "",
    `ACTIVITY TIMELINE (newest first, up to 50):`,
    ...(activities ?? []).map(
      (a) => `- ${a.created_at?.slice(0, 16)} [${a.type}] ${String(a.content ?? "").slice(0, 300)}`
    ),
  ]

  return { contact, name, context: lines.join("\n") }
}

// ── Lead scoring ──

export async function scoreContact(contactId: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  if (!isAIConfigured()) {
    return { error: "AI is not configured. Add ANTHROPIC_API_KEY to the environment." }
  }

  const built = await buildContactContext(supabase, orgId, subAccountId, contactId)
  if (!built) return { error: "Contact not found" }

  try {
    const ai = getAIProvider()
    const result = await ai.completeJSON<Omit<LeadScore, "scored_at">>({
      system: `You are a lead-scoring engine inside a CRM used by agencies. Score how likely this contact is to convert or transact soon, based ONLY on the data provided. Consider: engagement recency and frequency, deal pipeline presence and stage, task follow-through, consent status, and data completeness. Be honest — a sparse record scores low. Today's date: ${new Date().toISOString().slice(0, 10)}.`,
      prompt: built.context,
      schema: {
        type: "object",
        properties: {
          score: { type: "integer", description: "0-100 conversion likelihood" },
          tier: { type: "string", enum: ["hot", "warm", "cold"] },
          reasoning: { type: "string", description: "2-3 sentence plain-English explanation" },
          factors: {
            type: "array",
            items: { type: "string" },
            description: "3-5 short bullet factors, each prefixed with + or -",
          },
        },
        required: ["score", "tier", "reasoning", "factors"],
        additionalProperties: false,
      },
    })

    const leadScore: LeadScore = { ...result, scored_at: new Date().toISOString() }

    const metadata = (built.contact.metadata ?? {}) as Record<string, unknown>
    await supabase
      .from("contacts")
      .update({ metadata: { ...metadata, ai_score: leadScore }, updated_at: new Date().toISOString() })
      .eq("id", contactId)
      .eq("sub_account_id", subAccountId)

    revalidatePath(`/contacts/${contactId}`)
    return { data: leadScore }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Lead scoring failed" }
  }
}

// ── Timeline summary ──

export async function summarizeContact(contactId: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  if (!isAIConfigured()) {
    return { error: "AI is not configured. Add ANTHROPIC_API_KEY to the environment." }
  }

  const built = await buildContactContext(supabase, orgId, subAccountId, contactId)
  if (!built) return { error: "Contact not found" }

  try {
    const ai = getAIProvider()
    const summary = await ai.complete({
      system:
        "You summarize CRM contact histories for a busy agency owner. Write a tight summary: who this contact is, the state of the relationship, what has happened recently, and the single most important next step. Use short paragraphs or bullets. No preamble, no headers. Stay under 150 words. Base everything strictly on the provided data.",
      prompt: built.context,
    })

    return { data: summary.trim() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Summarization failed" }
  }
}

// ── Follow-up drafts ──

export async function draftFollowUp(contactId: string, channel: "email" | "sms") {
  const { orgId, subAccountId, supabase } = await getUserContext()

  if (!isAIConfigured()) {
    return { error: "AI is not configured. Add ANTHROPIC_API_KEY to the environment." }
  }

  const built = await buildContactContext(supabase, orgId, subAccountId, contactId)
  if (!built) return { error: "Contact not found" }

  const channelRules =
    channel === "email"
      ? "Write a follow-up EMAIL. Provide a specific, non-spammy subject line and a body of 60-140 words. Plain text, no markdown. Sign-off placeholder: end the body naturally without a signature block (the sender's signature is appended automatically)."
      : "Write a follow-up SMS. Max 300 characters, friendly and direct, no links unless one appears in the timeline. subject must be null."

  try {
    const ai = getAIProvider()
    const draft = await ai.completeJSON<FollowUpDraft>({
      system: `You draft follow-up messages for a CRM user. Base the message strictly on the contact's real history below — reference something concrete from the timeline when possible, and never invent meetings, promises, or details that are not in the data. Match a warm, professional tone. The message is FROM the CRM user TO the contact. This is a draft the user will review and edit; it is never auto-sent. ${channelRules}`,
      prompt: built.context,
      schema: {
        type: "object",
        properties: {
          subject: { type: ["string", "null"], description: "Email subject, or null for SMS" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    })

    return { data: draft }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Draft generation failed" }
  }
}

// ── Natural-language search ──

interface SearchIntent {
  entity: "contacts" | "deals" | "tasks"
  text: string | null
  tags: string[] | null
  source: string | null
  deal_status: "open" | "won" | "lost" | "closed" | null
  task_status: "pending" | "completed" | null
  priority: "low" | "medium" | "high" | null
  created_within_days: number | null
  interpretation: string
}

export async function aiSearch(query: string) {
  const { orgId, subAccountId, supabase } = await getUserContext()

  if (!isAIConfigured()) {
    return { error: "AI is not configured. Add ANTHROPIC_API_KEY to the environment." }
  }
  if (!query.trim()) return { error: "Empty query" }

  try {
    const ai = getAIProvider()
    const intent = await ai.completeJSON<SearchIntent>({
      system: `You translate natural-language CRM queries into structured search filters. Today's date: ${new Date().toISOString().slice(0, 10)}. Pick the single most relevant entity. "text" is a substring to match against names/titles/emails/companies — keep it short (1-2 words) or null. Only set filters the query clearly implies. "interpretation" is a one-line restatement of how you understood the query.`,
      prompt: query,
      schema: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["contacts", "deals", "tasks"] },
          text: { type: ["string", "null"] },
          tags: { type: ["array", "null"], items: { type: "string" } },
          source: { type: ["string", "null"] },
          deal_status: { type: ["string", "null"], enum: ["open", "won", "lost", "closed", null] },
          task_status: { type: ["string", "null"], enum: ["pending", "completed", null] },
          priority: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
          created_within_days: { type: ["integer", "null"] },
          interpretation: { type: "string" },
        },
        required: [
          "entity", "text", "tags", "source", "deal_status",
          "task_status", "priority", "created_within_days", "interpretation",
        ],
        additionalProperties: false,
      },
    })

    const results: AISearchResult[] = []
    const sinceIso = intent.created_within_days
      ? new Date(Date.now() - intent.created_within_days * 86_400_000).toISOString()
      : null

    if (intent.entity === "contacts") {
      let q = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, company, source, tags")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .limit(10)
      if (intent.text) {
        q = q.or(
          `first_name.ilike.%${intent.text}%,last_name.ilike.%${intent.text}%,email.ilike.%${intent.text}%,company.ilike.%${intent.text}%`
        )
      }
      if (intent.tags?.length) q = q.overlaps("tags", intent.tags)
      if (intent.source) q = q.ilike("source", intent.source)
      if (sinceIso) q = q.gte("created_at", sinceIso)

      const { data } = await q
      for (const c of data ?? []) {
        results.push({
          id: c.id,
          title: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed",
          subtitle: [c.company, c.email, c.source].filter(Boolean).join(" · "),
          href: `/contacts/${c.id}`,
        })
      }
    } else if (intent.entity === "deals") {
      let q = supabase
        .from("deals")
        .select("id, title, value, currency, status, stage:pipeline_stages(name)")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .limit(10)
      if (intent.text) q = q.ilike("title", `%${intent.text}%`)
      if (intent.deal_status) q = q.eq("status", intent.deal_status)
      if (sinceIso) q = q.gte("created_at", sinceIso)

      const { data } = await q
      for (const d of data ?? []) {
        const stage = d.stage as { name?: string } | { name?: string }[] | null
        const stageName = Array.isArray(stage) ? stage[0]?.name : stage?.name
        results.push({
          id: d.id,
          title: d.title,
          subtitle: [`${d.currency} ${d.value}`, stageName, d.status].filter(Boolean).join(" · "),
          href: `/pipeline`,
        })
      }
    } else {
      let q = supabase
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("org_id", orgId)
        .eq("sub_account_id", subAccountId)
        .limit(10)
      if (intent.text) q = q.ilike("title", `%${intent.text}%`)
      if (intent.task_status) q = q.eq("status", intent.task_status)
      if (intent.priority) q = q.eq("priority", intent.priority)
      if (sinceIso) q = q.gte("created_at", sinceIso)

      const { data } = await q
      for (const t of data ?? []) {
        results.push({
          id: t.id,
          title: t.title,
          subtitle: [t.status, `priority: ${t.priority}`, t.due_date ? `due ${t.due_date}` : null]
            .filter(Boolean)
            .join(" · "),
          href: `/tasks`,
        })
      }
    }

    const response: AISearchResponse = { interpretation: intent.interpretation, results }
    return { data: response }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI search failed" }
  }
}
