import type { Task, Contact, Deal, DealPriority, TaskStatus } from "@/types/database"

export interface TaskWithRelations extends Omit<Task, "contact" | "deal"> {
  contact: Pick<Contact, "id" | "first_name" | "last_name"> | null
  deal: Pick<Deal, "id" | "title"> | null
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  due_date?: string | null
  priority: DealPriority
  contact_id?: string | null
  deal_id?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  due_date?: string | null
  priority?: DealPriority
  status?: TaskStatus
  contact_id?: string | null
  deal_id?: string | null
}
