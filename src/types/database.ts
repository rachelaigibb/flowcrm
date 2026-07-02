// Manual type definitions — will be replaced by generated types via:
// npx supabase gen types typescript --project-id jsnufxpzeuoybgksgnon > src/types/database.ts

export type OrgRole = "owner" | "admin" | "member"
export type SubAccountRole = "admin" | "collaborator"
export type DealStatus = "open" | "won" | "lost"
export type DealPriority = "low" | "medium" | "high"
export type TaskStatus = "pending" | "completed" | "cancelled"
export type ConsentStatus = "explicit" | "implied" | "none" | "withdrawn"
export type ActivityType =
  | "note"
  | "email"
  | "sms"
  | "call"
  | "meeting"
  | "status_change"
  | "system"

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  user_id: string
  org_id: string
  role: OrgRole
  created_at: string
}

export interface SubAccount {
  id: string
  org_id: string
  name: string
  slug: string
  currency: string
  timezone: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SubAccountMembership {
  id: string
  user_id: string
  sub_account_id: string
  role: SubAccountRole
  created_at: string
}

export interface Contact {
  id: string
  org_id: string
  sub_account_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  source: string | null
  tags: string[]
  metadata: Record<string, unknown>
  consent_status: ConsentStatus
  consent_date: string | null
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  position: number
  color: string
  created_at: string
}

export interface Deal {
  id: string
  org_id: string
  sub_account_id: string
  contact_id: string | null
  title: string
  value: number
  currency: string
  stage_id: string
  priority: DealPriority
  status: DealStatus
  expected_close: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  contact?: Contact | null
  stage?: PipelineStage | null
}

export interface Activity {
  id: string
  org_id: string
  sub_account_id: string
  contact_id: string | null
  deal_id: string | null
  task_id: string | null
  user_id: string | null
  type: ActivityType
  content: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Task {
  id: string
  org_id: string
  sub_account_id: string
  contact_id: string | null
  deal_id: string | null
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: DealPriority
  status: TaskStatus
  created_at: string
  updated_at: string
  // Joined fields
  contact?: Contact | null
  deal?: Deal | null
}

export type FormFieldType = "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "date" | "number"

export interface FormField {
  id: string
  type: FormFieldType
  label: string
  placeholder: string | null
  required: boolean
  options: string[] // for select type
}

export interface FormSettings {
  submit_button_text: string
  success_message: string
  redirect_url: string | null
  create_contact: boolean
  notify_email: string | null
}

export interface Form {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  slug: string
  description: string | null
  fields: FormField[]
  settings: FormSettings
  published: boolean
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  org_id: string
  sub_account_id: string
  form_id: string
  contact_id: string | null
  data: Record<string, string | boolean>
  created_at: string
}

export type AutomationTriggerType = "form_submission" | "contact_created" | "deal_stage_change" | "tag_added" | "manual"
export type AutomationStepActionType = "send_email" | "send_sms" | "wait" | "add_tag" | "remove_tag" | "create_task"
export type AutomationRunStatus = "running" | "completed" | "failed" | "paused"

export interface Automation {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  description: string | null
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface AutomationStep {
  id: string
  org_id: string
  automation_id: string
  position: number
  action_type: AutomationStepActionType
  config: Record<string, unknown>
  created_at: string
}

export type BroadcastChannel = "email" | "sms"
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed"

export interface BroadcastRecipientFilter {
  tags?: string[]
  sources?: string[]
  all?: boolean
}

export interface BroadcastStats {
  total: number
  sent: number
  failed: number
  opened: number
}

export interface Broadcast {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  channel: BroadcastChannel
  status: BroadcastStatus
  email_subject: string | null
  email_body: string | null
  email_template_id: string | null
  sms_body: string | null
  sms_template_id: string | null
  recipient_filter: BroadcastRecipientFilter
  scheduled_at: string | null
  sent_at: string | null
  stats: BroadcastStats
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  org_id: string
  automation_id: string
  contact_id: string | null
  status: AutomationRunStatus
  current_step: number
  started_at: string
  completed_at: string | null
  error: string | null
  metadata: Record<string, unknown>
}

export interface SmsTemplate {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  body: string
  created_at: string
  updated_at: string
}

export interface EmailTemplate {
  id: string
  org_id: string
  sub_account_id: string
  name: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked"

export interface Invitation {
  id: string
  org_id: string
  email: string
  role: OrgRole
  sub_account_ids: string[]
  sub_account_role: SubAccountRole
  token: string
  status: InvitationStatus
  invited_by: string
  accepted_by: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

// Helper type for the current user's context
export interface UserContext {
  userId: string
  orgId: string
  orgRole: OrgRole
  subAccountId: string
  subAccountRole: SubAccountRole
}
