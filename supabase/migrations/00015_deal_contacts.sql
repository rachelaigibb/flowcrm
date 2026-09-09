-- Deal associations: many people per deal, each with a role (per-workspace list in
-- sub_accounts.settings.deal_roles). The deal's primary contact stays in deals.contact_id.
CREATE TABLE IF NOT EXISTS public.deal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contact',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, contact_id, role)
);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON public.deal_contacts (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact ON public.deal_contacts (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_sub ON public.deal_contacts (sub_account_id);

ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_contacts_select" ON public.deal_contacts
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
CREATE POLICY "deal_contacts_insert" ON public.deal_contacts
  FOR INSERT WITH CHECK (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
    AND org_id IN (SELECT public.get_user_org_ids())
  );
CREATE POLICY "deal_contacts_update" ON public.deal_contacts
  FOR UPDATE USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
CREATE POLICY "deal_contacts_delete" ON public.deal_contacts
  FOR DELETE USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
