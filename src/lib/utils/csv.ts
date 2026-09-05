import Papa from "papaparse"

export interface CSVParseResult {
  data: Record<string, string>[]
  errors: Papa.ParseError[]
  fields: string[]
}

export function parseCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        resolve({
          data: results.data as Record<string, string>[],
          errors: results.errors,
          fields: results.meta.fields ?? [],
        })
      },
      error: (error) => reject(error),
    })
  })
}

// Map common CSV headers to contact fields
const FIELD_MAPPINGS: Record<string, string> = {
  first_name: "first_name",
  firstname: "first_name",
  "first name": "first_name",
  last_name: "last_name",
  lastname: "last_name",
  "last name": "last_name",
  email: "email",
  email_address: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  company: "company",
  organization: "company",
  source: "source",
  tags: "tags",
  // Google Contacts export — current layout (headers are lower-cased, spaces → underscores by parseCSV)
  given_name: "first_name",
  family_name: "last_name",
  "e-mail_1_-_value": "email",
  "phone_1_-_value": "phone",
  organization_name: "company",
  "organization_1_-_name": "company",
  labels: "tags",
  group_membership: "tags",
  birthday: "birthday",
  notes: "notes",
  "address_1_-_formatted": "address",
  // FlowCRM's own export / other CRMs
  last_contact: "last_contact",
  consent_status: "consent_status",
  consent: "consent_status",
  consent_to_display_sale: "consent_to_display_sale",
  address: "address",
}

export function mapCSVFields(
  fields: string[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}
  for (const field of fields) {
    const normalized = field.toLowerCase().replace(/\s+/g, "_")
    mapping[field] = FIELD_MAPPINGS[normalized] ?? null
  }
  return mapping
}
