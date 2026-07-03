-- Add birthday field to contacts for client retention tracking
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthday date;
