-- ============================================================================
-- FlowCRM Phase 2A: Email Infrastructure
-- Email templates table for reusable email content
-- ============================================================================

-- ============================================================================
-- SECTION 1: Email Templates
-- ============================================================================

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_templates_org ON public.email_templates(org_id);
CREATE INDEX idx_email_templates_sub_account ON public.email_templates(sub_account_id);

-- Updated at trigger
CREATE TRIGGER set_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email templates in their sub-accounts"
  ON public.email_templates FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can create email templates in their sub-accounts"
  ON public.email_templates FOR INSERT
  WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can update email templates in their sub-accounts"
  ON public.email_templates FOR UPDATE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete email templates in their sub-accounts"
  ON public.email_templates FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

-- ============================================================================
-- SECTION 2: Add email settings to sub_accounts.settings JSONB
-- No schema change needed — settings is already JSONB
-- Convention: settings.email = { from_name, from_email, reply_to }
-- ============================================================================
