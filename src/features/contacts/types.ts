import type {
  Contact,
  Activity,
  Deal,
  Task,
  ConsentStatus,
} from "@/types/database"

export interface CreateContactInput {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  source?: string
  tags?: string[]
  consent_status?: ConsentStatus
}

export interface UpdateContactInput {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  source?: string | null
  tags?: string[]
  consent_status?: ConsentStatus
}

export interface ImportContactRow {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  source?: string
  tags?: string
}

export interface ContactWithRelations extends Contact {
  activities: Activity[]
  deals: Deal[]
  tasks: Task[]
}

// Field mapping for CSV import
export const CONTACT_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "source", label: "Source" },
  { value: "tags", label: "Tags" },
] as const

export type ContactFieldKey = (typeof CONTACT_FIELDS)[number]["value"]

export const SOURCE_OPTIONS = [
  "Website",
  "Referral",
  "LinkedIn",
  "Instagram",
  "Cold Outreach",
  "Event",
  "Advertising",
  "Other",
] as const
