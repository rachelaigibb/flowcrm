-- ============================================================================
-- FlowCRM Phase 2B: SMS Infrastructure
-- SMS templates table for reusable SMS content
-- ============================================================================

CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sms_templates_org ON public.sms_templates(org_id);
CREATE INDEX idx_sms_templates_sub_account ON public.sms_templates(sub_account_id);

-- Updated at trigger
CREATE TRIGGER set_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sms templates in their sub-accounts"
  ON public.sms_templates FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can create sms templates in their sub-accounts"
  ON public.sms_templates FOR INSERT
  WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can update sms templates in their sub-accounts"
  ON public.sms_templates FOR UPDATE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete sms templates in their sub-accounts"
  ON public.sms_templates FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

-- ============================================================================
-- SMS settings stored in sub_accounts.settings.sms JSONB
-- Convention: settings.sms = { twilio_phone_number }
-- Twilio credentials (account SID + auth token) are env vars, not per-tenant
-- ============================================================================
