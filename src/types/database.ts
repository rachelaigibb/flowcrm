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

// Helper type for the current user's context
export interface UserContext {
  userId: string
  orgId: string
  orgRole: OrgRole
  subAccountId: string
  subAccountRole: SubAccountRole
}
