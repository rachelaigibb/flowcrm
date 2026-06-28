import type {
  Deal,
  Contact,
  PipelineStage,
  DealPriority,
  DealStatus,
} from "@/types/database"

export type DealWithContact = Deal & {
  contact: Contact | null
}

export type StageWithDeals = PipelineStage & {
  deals: DealWithContact[]
}

export interface CreateDealInput {
  title: string
  value: number
  currency: string
  stage_id: string
  priority: DealPriority
  expected_close: string | null
  contact_id: string | null
}

export interface UpdateDealInput {
  title?: string
  value?: number
  currency?: string
  stage_id?: string
  priority?: DealPriority
  status?: DealStatus
  expected_close?: string | null
  contact_id?: string | null
}
