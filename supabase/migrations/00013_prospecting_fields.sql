-- 00013: Prospecting fields for Rachel's own use (job 1, 2026-09-06/07)
-- Contacts: call-block tracking + consent to show a "sold" marker (neighbourhood + street only).
-- Deals: completed transactions are won deals; add the transaction attributes + commission.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS last_contact date,
  ADD COLUMN IF NOT EXISTS consent_to_display_sale text NOT NULL DEFAULT 'pending'
    CHECK (consent_to_display_sale IN ('yes','no','pending'));

CREATE INDEX IF NOT EXISTS idx_contacts_last_contact
  ON public.contacts (sub_account_id, last_contact NULLS FIRST);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS side text
    CHECK (side IS NULL OR side IN ('buyer','seller','both','tenant','landlord','referral')),
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS closed_at date,
  ADD COLUMN IF NOT EXISTS co_op_agent text,
  ADD COLUMN IF NOT EXISTS referrer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission numeric,
  ADD COLUMN IF NOT EXISTS reference text,   -- user's own reference / transaction number
  ADD COLUMN IF NOT EXISTS source text;      -- how the deal came in (Referral JJ, Internet, Sphere…)

CREATE INDEX IF NOT EXISTS idx_deals_referrer ON public.deals (referrer_contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_closed_at ON public.deals (sub_account_id, closed_at);
