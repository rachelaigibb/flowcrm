"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type {
  Automation,
  AutomationStep,
  AutomationRun,
  AutomationTriggerType,
  AutomationStepActionType,
  EmailTemplate,
  SmsTemplate,
  Form,
  PipelineStage,
  Contact,
} from "@/types/database"
import { updateAutomation, saveAutomationSteps } from "@/features/automations/actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatDateShort } from "@/lib/utils/dates"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Mail,
  MessageSquare,
  Clock,
  Tag,
  CheckSquare,
  Zap,
  Settings,
} from "lucide-react"

// ── Constants ──

const TRIGGER_TYPE_LABELS: Record<AutomationTriggerType, string> = {
  form_submission: "Form Submission",
  contact_created: "Contact Created",
  deal_stage_change: "Deal Stage Change",
  tag_added: "Tag Added",
  manual: "Manual",
}

const ACTION_TYPE_LABELS: Record<AutomationStepActionType, string> = {
  send_email: "Send Email",
  send_sms: "Send SMS",
  wait: "Wait",
  add_tag: "Add Tag",
  remove_tag: "Remove Tag",
  create_task: "Create Task",
}

const ACTION_TYPE_ICONS: Record<AutomationStepActionType, typeof Mail> = {
  send_email: Mail,
  send_sms: MessageSquare,
  wait: Clock,
  add_tag: Tag,
  remove_tag: Tag,
  create_task: CheckSquare,
}

const RUN_STATUS_STYLES: Record<string, string> = {
  running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  paused: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
}

// ── Types ──

interface LocalStep {
  id: string
  action_type: AutomationStepActionType
  config: Record<string, unknown>
}

interface AutomationBuilderPageProps {
  automation: Automation
  steps: AutomationStep[]
  runs: (AutomationRun & {
    contact: Pick<Contact, "id" | "first_name" | "last_name" | "email"> | null
  })[]
  emailTemplates: Pick<EmailTemplate, "id" | "name">[]
  smsTemplates: Pick<SmsTemplate, "id" | "name">[]
  forms: Pick<Form, "id" | "name">[]
  stages: Pick<PipelineStage, "id" | "name">[]
}

// ── Component ──

export function AutomationBuilderPage({
  automation,
  steps: initialSteps,
  runs,
  emailTemplates,
  smsTemplates,
  forms,
  stages,
}: AutomationBuilderPageProps) {
  const router = useRouter()

  // Header state
  const [automationName, setAutomationName] = useState(automation.name)
  const [enabled, setEnabled] = useState(automation.enabled)
  const [saving, setSaving] = useState(false)

  // Trigger state
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    automation.trigger_type
  )
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    automation.trigger_config ?? {}
  )

  // Steps state
  const [localSteps, setLocalSteps] = useState<LocalStep[]>(
    initialSteps.map((s) => ({
      id: s.id,
      action_type: s.action_type,
      config: s.config,
    }))
  )

  // Add step dialog
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [newStepAction, setNewStepAction] =
    useState<AutomationStepActionType>("send_email")
  const [newStepConfig, setNewStepConfig] = useState<Record<string, unknown>>(
    {}
  )

  // ── Handlers ──

  async function handleToggleEnabled() {
    const next = !enabled
    setEnabled(next)

    const result = await updateAutomation(automation.id, { enabled: next })
    if (result.error) {
      toast.error(result.error)
      setEnabled(!next) // revert
      return
    }
    toast.success(next ? "Automation enabled" : "Automation disabled")
  }

  async function handleSave() {
    setSaving(true)

    // Save automation metadata
    const metaResult = await updateAutomation(automation.id, {
      name: automationName.trim(),
      trigger_type: triggerType,
      trigger_config: triggerConfig,
    })

    if (metaResult.error) {
      toast.error(metaResult.error)
      setSaving(false)
      return
    }

    // Save steps
    const stepsPayload = localSteps.map((s) => ({
      action_type: s.action_type,
      config: s.config,
    }))

    const stepsResult = await saveAutomationSteps(automation.id, stepsPayload)
    setSaving(false)

    if (stepsResult.error) {
      toast.error(stepsResult.error)
      return
    }

    toast.success("Automation saved")
    router.refresh()
  }

  function moveStep(index: number, direction: "up" | "down") {
    const next = [...localSteps]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setLocalSteps(next)
  }

  function deleteStep(index: number) {
    setLocalSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function handleAddStep(e: React.FormEvent) {
    e.preventDefault()
    const newStep: LocalStep = {
      id: crypto.randomUUID(),
      action_type: newStepAction,
      config: { ...newStepConfig },
    }
    setLocalSteps((prev) => [...prev, newStep])
    setAddStepOpen(false)
    setNewStepAction("send_email")
    setNewStepConfig({})
  }

  const getStepDescription = useCallback(
    (step: LocalStep): string => {
      switch (step.action_type) {
        case "send_email": {
          const tpl = emailTemplates.find(
            (t) => t.id === step.config.email_template_id
          )
          return tpl ? `Send email: ${tpl.name}` : "Send email (no template)"
        }
        case "send_sms": {
          const tpl = smsTemplates.find(
            (t) => t.id === step.config.sms_template_id
          )
          return tpl ? `Send SMS: ${tpl.name}` : "Send SMS (no template)"
        }
        case "wait": {
          const mins = Number(step.config.duration_minutes ?? 0)
          if (mins >= 1440) return `Wait ${Math.round(mins / 1440)} day(s)`
          if (mins >= 60) return `Wait ${Math.round(mins / 60)} hour(s)`
          return `Wait ${mins} minute(s)`
        }
        case "add_tag":
          return `Add tag: ${step.config.tag_name ?? "(none)"}`
        case "remove_tag":
          return `Remove tag: ${step.config.tag_name ?? "(none)"}`
        case "create_task": {
          const title = step.config.task_title ?? "Untitled"
          return `Create task: ${title}`
        }
        default:
          return step.action_type
      }
    },
    [emailTemplates, smsTemplates]
  )

  // ── Render ──

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/automations")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={automationName}
          onChange={(e) => setAutomationName(e.target.value)}
          className="text-2xl font-semibold tracking-tight border-none bg-transparent shadow-none px-0 h-auto focus-visible:ring-0"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleEnabled}
          >
            {enabled ? (
              <Pause className="size-3.5" data-icon="inline-start" />
            ) : (
              <Play className="size-3.5" data-icon="inline-start" />
            )}
            {enabled ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Save className="size-3.5" data-icon="inline-start" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Separator />

      {/* Section 1: Trigger Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Settings className="size-4" />
              Trigger
            </div>
          </CardTitle>
          <CardDescription>
            When this automation should fire
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Trigger Type</Label>
            <Select
              value={triggerType}
              onValueChange={(v: string | null) => {
                if (v) {
                  setTriggerType(v as AutomationTriggerType)
                  setTriggerConfig({})
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue>{TRIGGER_TYPE_LABELS[triggerType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="form_submission">
                  Form Submission
                </SelectItem>
                <SelectItem value="contact_created">
                  Contact Created
                </SelectItem>
                <SelectItem value="deal_stage_change">
                  Deal Stage Change
                </SelectItem>
                <SelectItem value="tag_added">Tag Added</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trigger-specific config */}
          {triggerType === "form_submission" && (
            <div className="flex flex-col gap-2">
              <Label>Form</Label>
              {forms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No forms available. Create a form first.
                </p>
              ) : (
                <Select
                  value={(triggerConfig.form_id as string) ?? ""}
                  onValueChange={(v: string | null) =>
                    setTriggerConfig((prev) => ({ ...prev, form_id: v ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue>
                      {forms.find(
                        (f) => f.id === triggerConfig.form_id
                      )?.name ?? "Select a form"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {triggerType === "deal_stage_change" && (
            <div className="flex flex-col gap-2">
              <Label>Target Stage</Label>
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pipeline stages available.
                </p>
              ) : (
                <Select
                  value={(triggerConfig.stage_id as string) ?? ""}
                  onValueChange={(v: string | null) =>
                    setTriggerConfig((prev) => ({
                      ...prev,
                      stage_id: v ?? "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue>
                      {stages.find(
                        (s) => s.id === triggerConfig.stage_id
                      )?.name ?? "Select a stage"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {triggerType === "tag_added" && (
            <div className="flex flex-col gap-2">
              <Label>Tag Name</Label>
              <Input
                placeholder="e.g. hot-lead"
                value={(triggerConfig.tag_name as string) ?? ""}
                onChange={(e) =>
                  setTriggerConfig((prev) => ({
                    ...prev,
                    tag_name: e.target.value,
                  }))
                }
                className="w-full sm:w-64"
              />
            </div>
          )}

          {(triggerType === "contact_created" || triggerType === "manual") && (
            <p className="text-sm text-muted-foreground">
              No additional configuration needed for this trigger type.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Steps Builder */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Zap className="size-4" />
              Steps
            </div>
          </CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setAddStepOpen(true)}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Add Step
            </Button>
          </CardAction>
          <CardDescription>
            Actions to execute in order when the automation triggers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {localSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No steps yet. Add your first step to define what this automation
              does.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {localSteps.map((step, index) => {
                const Icon = ACTION_TYPE_ICONS[step.action_type]

                return (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    {/* Position */}
                    <span className="shrink-0 text-xs font-medium text-muted-foreground w-5 text-center">
                      {index + 1}
                    </span>

                    {/* Icon */}
                    <div className="shrink-0 rounded-md bg-muted p-1.5">
                      <Icon className="size-3.5 text-muted-foreground" />
                    </div>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="shrink-0">
                          {ACTION_TYPE_LABELS[step.action_type]}
                        </Badge>
                        <span className="text-sm text-muted-foreground truncate">
                          {getStepDescription(step)}
                        </span>
                      </div>
                    </div>

                    {/* Move / Delete */}
                    <div className="shrink-0 flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => moveStep(index, "up")}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === localSteps.length - 1}
                        onClick={() => moveStep(index, "down")}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteStep(index)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>Last 20 automation executions</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No runs yet. Runs will appear here once the automation has been
              triggered.
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {runs.map((run) => {
                const contactName = run.contact
                  ? [run.contact.first_name, run.contact.last_name]
                      .filter(Boolean)
                      .join(" ") || run.contact.email
                  : "Unknown contact"

                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0",
                        RUN_STATUS_STYLES[run.status] ?? ""
                      )}
                    >
                      {run.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate">
                        {contactName}
                      </span>
                      {run.contact?.email && run.contact.first_name && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {run.contact.email}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateShort(run.started_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Step Dialog */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Step</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStep} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Action Type</Label>
              <Select
                value={newStepAction}
                onValueChange={(v: string | null) => {
                  if (v) {
                    setNewStepAction(v as AutomationStepActionType)
                    setNewStepConfig({})
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {ACTION_TYPE_LABELS[newStepAction]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="send_sms">Send SMS</SelectItem>
                  <SelectItem value="wait">Wait</SelectItem>
                  <SelectItem value="add_tag">Add Tag</SelectItem>
                  <SelectItem value="remove_tag">Remove Tag</SelectItem>
                  <SelectItem value="create_task">Create Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Config fields based on action type */}
            {newStepAction === "send_email" && (
              <div className="flex flex-col gap-2">
                <Label>Email Template</Label>
                {emailTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No email templates available.
                  </p>
                ) : (
                  <Select
                    value={(newStepConfig.email_template_id as string) ?? ""}
                    onValueChange={(v: string | null) =>
                      setNewStepConfig((prev) => ({
                        ...prev,
                        email_template_id: v ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {emailTemplates.find(
                          (t) => t.id === newStepConfig.email_template_id
                        )?.name ?? "Select a template"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {newStepAction === "send_sms" && (
              <div className="flex flex-col gap-2">
                <Label>SMS Template</Label>
                {smsTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No SMS templates available.
                  </p>
                ) : (
                  <Select
                    value={(newStepConfig.sms_template_id as string) ?? ""}
                    onValueChange={(v: string | null) =>
                      setNewStepConfig((prev) => ({
                        ...prev,
                        sms_template_id: v ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {smsTemplates.find(
                          (t) => t.id === newStepConfig.sms_template_id
                        )?.name ?? "Select a template"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {smsTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {newStepAction === "wait" && (
              <div className="flex flex-col gap-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 60"
                  value={(newStepConfig.duration_minutes as string) ?? ""}
                  onChange={(e) =>
                    setNewStepConfig((prev) => ({
                      ...prev,
                      duration_minutes: Number(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  60 = 1 hour, 1440 = 1 day
                </p>
              </div>
            )}

            {(newStepAction === "add_tag" ||
              newStepAction === "remove_tag") && (
              <div className="flex flex-col gap-2">
                <Label>Tag Name</Label>
                <Input
                  placeholder="e.g. vip"
                  value={(newStepConfig.tag_name as string) ?? ""}
                  onChange={(e) =>
                    setNewStepConfig((prev) => ({
                      ...prev,
                      tag_name: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            {newStepAction === "create_task" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Task Title</Label>
                  <Input
                    placeholder="e.g. Follow up with contact"
                    value={(newStepConfig.task_title as string) ?? ""}
                    onChange={(e) =>
                      setNewStepConfig((prev) => ({
                        ...prev,
                        task_title: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Due in (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 3"
                    value={(newStepConfig.due_days as string) ?? ""}
                    onChange={(e) =>
                      setNewStepConfig((prev) => ({
                        ...prev,
                        due_days: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={(newStepConfig.priority as string) ?? "medium"}
                    onValueChange={(v: string | null) =>
                      setNewStepConfig((prev) => ({
                        ...prev,
                        priority: v ?? "medium",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(newStepConfig.priority as string) === "low"
                          ? "Low"
                          : (newStepConfig.priority as string) === "high"
                            ? "High"
                            : "Medium"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddStepOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
