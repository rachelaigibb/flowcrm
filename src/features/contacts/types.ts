import type {
  Contact,
  Activity,
  Deal,
  Task,
  ConsentStatus,
  SaleDisplayConsent,
} from "@/types/database"

export interface CreateContactInput {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  source?: string
  tags?: string[]
  birthday?: string | null
  consent_status?: ConsentStatus
  last_contact?: string | null
  consent_to_display_sale?: SaleDisplayConsent
}

export interface UpdateContactInput {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  source?: string | null
  tags?: string[]
  birthday?: string | null
  consent_status?: ConsentStatus
  last_contact?: string | null
  consent_to_display_sale?: SaleDisplayConsent
}

export interface ImportContactRow {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  source?: string
  tags?: string
  birthday?: string
  notes?: string
  address?: string
  last_contact?: string
  consent_status?: string
  consent_to_display_sale?: string
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
  { value: "tags", label: "Tags / Labels" },
  { value: "birthday", label: "Birthday" },
  { value: "notes", label: "Notes (becomes first note)" },
  { value: "address", label: "Address (stored on the contact)" },
  { value: "last_contact", label: "Last contact date" },
  { value: "consent_status", label: "Consent status" },
  { value: "consent_to_display_sale", label: "OK to show sale (yes/no/pending)" },
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
