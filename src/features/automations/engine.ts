import { createClient } from "@/lib/supabase/server"
import {
  getEmailSettings,
  getSmsSettings,
  renderTemplate,
  sendEmailToContact,
  sendSmsToContact,
  type MessageContact,
} from "@/lib/messaging/send"
import type { AutomationStep, AutomationTriggerType } from "@/types/database"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface EngineContext {
  orgId: string
  subAccountId: string
  userId: string
}

interface LogEntry {
  event: string
  timestamp: string
  [key: string]: unknown
}

export interface TriggerEvent {
  type: AutomationTriggerType
  contactId: string
  stageId?: string
  tagName?: string
}

// Finds enabled automations matching the trigger event, creates a run for
// each, and executes them inline. Never throws — a broken automation must not
// fail the user action (contact save, deal move) that triggered it.
export async function triggerAutomations(
  supabase: SupabaseServerClient,
  ctx: EngineContext,
  event: TriggerEvent
): Promise<void> {
  try {
    const { data: automations } = await supabase
      .from("automations")
      .select("id, trigger_config")
      .eq("org_id", ctx.orgId)
      .eq("sub_account_id", ctx.subAccountId)
      .eq("enabled", true)
      .eq("trigger_type", event.type)

    if (!automations?.length) return

    const matching = automations.filter((a) => {
      const config = (a.trigger_config ?? {}) as Record<string, unknown>
      if (event.type === "deal_stage_change" && config.stage_id) {
        return config.stage_id === event.stageId
      }
      if (event.type === "tag_added" && config.tag_name) {
        return String(config.tag_name).toLowerCase() === event.tagName?.toLowerCase()
      }
      return true
    })

    for (const automation of matching) {
      const { data: run } = await supabase
        .from("automation_runs")
        .insert({
          org_id: ctx.orgId,
          sub_account_id: ctx.subAccountId,
          automation_id: automation.id,
          contact_id: event.contactId,
          status: "running",
          current_step: 0,
          started_at: new Date().toISOString(),
          log: [
            {
              event: `trigger:${event.type}`,
              timestamp: new Date().toISOString(),
              ...(event.stageId ? { stage_id: event.stageId } : {}),
              ...(event.tagName ? { tag_name: event.tagName } : {}),
            },
          ],
        })
        .select("id")
        .single()

      if (run) {
        await executeAutomationRun(supabase, ctx, run.id)
      }
    }
  } catch (err) {
    console.error(`[Automations] Trigger ${event.type} failed:`, err)
  }
}

// Executes a run's steps from current_step. A `wait` step pauses the run
// (status=paused, resume_at set) and returns; processDueAutomationRuns picks
// it up once due. A failed send marks the run failed with the error visible
// in run history.
export async function executeAutomationRun(
  supabase: SupabaseServerClient,
  ctx: EngineContext,
  runId: string
): Promise<void> {
  const { data: run } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .eq("org_id", ctx.orgId)
    .eq("sub_account_id", ctx.subAccountId)
    .single()

  if (!run || (run.status !== "running" && run.status !== "paused")) return

  const log: LogEntry[] = Array.isArray(run.log) ? [...(run.log as LogEntry[])] : []

  const fail = async (message: string) => {
    log.push({ event: "failed", timestamp: new Date().toISOString(), error: message })
    await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
        resume_at: null,
        log,
      })
      .eq("id", runId)
  }

  const { data: automation } = await supabase
    .from("automations")
    .select("id, enabled")
    .eq("id", run.automation_id)
    .single()

  if (!automation) return fail("Automation no longer exists")
  if (!automation.enabled) return fail("Automation is disabled")
  if (!run.contact_id) return fail("Run has no contact")

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, tags")
    .eq("id", run.contact_id)
    .single()

  if (!contact) return fail("Contact no longer exists")

  const { data: steps } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("automation_id", run.automation_id)
    .order("position")

  const allSteps = (steps ?? []) as AutomationStep[]
  const messageContact: MessageContact = contact

  if (run.status === "paused") {
    await supabase
      .from("automation_runs")
      .update({ status: "running", resume_at: null })
      .eq("id", runId)
  }

  for (let i = run.current_step; i < allSteps.length; i++) {
    const step = allSteps[i]
    const config = (step.config ?? {}) as Record<string, unknown>
    const stamp = () => new Date().toISOString()

    switch (step.action_type) {
      case "send_email": {
        const templateId = config.email_template_id as string | undefined
        if (!templateId) return fail(`Step ${i + 1}: no email template selected`)

        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("id", templateId)
          .single()
        if (!template) return fail(`Step ${i + 1}: email template not found`)

        if (!messageContact.email) {
          log.push({ event: "step_skipped", timestamp: stamp(), step: i, reason: "contact has no email" })
          break
        }

        const settings = await getEmailSettings(supabase, ctx.subAccountId)
        if (!settings) return fail(`Step ${i + 1}: email sending not configured (Settings > Email)`)

        const result = await sendEmailToContact({
          supabase,
          orgId: ctx.orgId,
          subAccountId: ctx.subAccountId,
          userId: ctx.userId,
          contact: messageContact,
          settings,
          subject: renderTemplate(template.subject, messageContact),
          body: renderTemplate(template.body, messageContact),
          activityMetadata: { automation_run_id: runId },
        })
        if (!result.ok) return fail(`Step ${i + 1}: email failed — ${result.error}`)

        log.push({ event: "email_sent", timestamp: stamp(), step: i, resend_id: result.providerId })
        break
      }

      case "send_sms": {
        const templateId = config.sms_template_id as string | undefined
        if (!templateId) return fail(`Step ${i + 1}: no SMS template selected`)

        const { data: template } = await supabase
          .from("sms_templates")
          .select("body")
          .eq("id", templateId)
          .single()
        if (!template) return fail(`Step ${i + 1}: SMS template not found`)

        if (!messageContact.phone) {
          log.push({ event: "step_skipped", timestamp: stamp(), step: i, reason: "contact has no phone" })
          break
        }

        const settings = await getSmsSettings(supabase, ctx.subAccountId)
        if (!settings) return fail(`Step ${i + 1}: SMS sending not configured (Settings > SMS)`)

        const result = await sendSmsToContact({
          supabase,
          orgId: ctx.orgId,
          subAccountId: ctx.subAccountId,
          userId: ctx.userId,
          contact: messageContact,
          settings,
          body: renderTemplate(template.body, messageContact),
          activityMetadata: { automation_run_id: runId },
        })
        if (!result.ok) return fail(`Step ${i + 1}: SMS failed — ${result.error}`)

        log.push({ event: "sms_sent", timestamp: stamp(), step: i, twilio_sid: result.providerId })
        break
      }

      case "add_tag":
      case "remove_tag": {
        const tagName = (config.tag_name as string | undefined)?.trim()
        if (!tagName) return fail(`Step ${i + 1}: no tag name configured`)

        const { data: fresh } = await supabase
          .from("contacts")
          .select("tags")
          .eq("id", messageContact.id)
          .single()
        const currentTags: string[] = (fresh?.tags as string[]) ?? []

        // Note: engine tag changes intentionally do NOT fire tag_added
        // triggers — automations chaining automations invites infinite loops.
        const newTags =
          step.action_type === "add_tag"
            ? currentTags.some((t) => t.toLowerCase() === tagName.toLowerCase())
              ? currentTags
              : [...currentTags, tagName]
            : currentTags.filter((t) => t.toLowerCase() !== tagName.toLowerCase())

        const { error } = await supabase
          .from("contacts")
          .update({ tags: newTags, updated_at: stamp() })
          .eq("id", messageContact.id)
          .eq("sub_account_id", ctx.subAccountId)
        if (error) return fail(`Step ${i + 1}: tag update failed — ${error.message}`)

        log.push({ event: step.action_type, timestamp: stamp(), step: i, tag: tagName })
        break
      }

      case "create_task": {
        const title = (config.task_title as string | undefined)?.trim()
        if (!title) return fail(`Step ${i + 1}: no task title configured`)

        const { error } = await supabase.from("tasks").insert({
          org_id: ctx.orgId,
          sub_account_id: ctx.subAccountId,
          assigned_to: ctx.userId,
          title: renderTemplate(title, messageContact),
          description: null,
          due_date: null,
          priority: "medium",
          contact_id: messageContact.id,
          deal_id: null,
          status: "pending",
        })
        if (error) return fail(`Step ${i + 1}: task creation failed — ${error.message}`)

        log.push({ event: "task_created", timestamp: stamp(), step: i, title })
        break
      }

      case "wait": {
        const minutes = Number(config.duration_minutes ?? 0)
        const resumeAt = new Date(Date.now() + Math.max(minutes, 0) * 60_000).toISOString()
        log.push({ event: "wait_started", timestamp: stamp(), step: i, minutes, resume_at: resumeAt })

        await supabase
          .from("automation_runs")
          .update({ status: "paused", current_step: i + 1, resume_at: resumeAt, log })
          .eq("id", runId)
        return
      }

      default:
        log.push({ event: "step_skipped", timestamp: stamp(), step: i, reason: `unknown action ${step.action_type}` })
    }

    // Persist progress after each step so a crash resumes, not repeats
    await supabase
      .from("automation_runs")
      .update({ current_step: i + 1, log })
      .eq("id", runId)
  }

  log.push({ event: "completed", timestamp: new Date().toISOString() })
  await supabase
    .from("automation_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      current_step: allSteps.length,
      resume_at: null,
      log,
    })
    .eq("id", runId)
}

// Resumes paused runs whose wait has elapsed. Called opportunistically when
// automation pages load — no cron infrastructure needed at this stage.
export async function processDueAutomationRuns(
  supabase: SupabaseServerClient,
  ctx: EngineContext
): Promise<number> {
  try {
    const { data: due } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("sub_account_id", ctx.subAccountId)
      .eq("status", "paused")
      .lte("resume_at", new Date().toISOString())
      .limit(10)

    if (!due?.length) return 0

    for (const run of due) {
      await executeAutomationRun(supabase, ctx, run.id)
    }
    return due.length
  } catch (err) {
    console.error("[Automations] processDueAutomationRuns failed:", err)
    return 0
  }
}
