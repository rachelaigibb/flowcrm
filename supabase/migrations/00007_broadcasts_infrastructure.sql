-- ============================================================================
-- FlowCRM Phase 2F: Broadcasts
-- Mass email/SMS campaigns with recipient filtering
-- ============================================================================

CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  -- Email fields
  email_subject text,
  email_body text,
  email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  -- SMS fields
  sms_body text,
  sms_template_id uuid REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  -- Recipient filter
  recipient_filter jsonb NOT NULL DEFAULT '{}',
  -- Schedule
  scheduled_at timestamptz,
  sent_at timestamptz,
  -- Stats
  stats jsonb NOT NULL DEFAULT '{"total": 0, "sent": 0, "failed": 0, "opened": 0}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- recipient_filter JSONB:
-- { "tags": ["VIP", "Hot Lead"], "sources": ["website"], "all": false }
-- If "all" is true, send to all contacts (with consent)

CREATE INDEX idx_broadcasts_org ON public.broadcasts(org_id);
CREATE INDEX idx_broadcasts_sub_account ON public.broadcasts(sub_account_id);
CREATE INDEX idx_broadcasts_status ON public.broadcasts(status);

CREATE TRIGGER set_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view broadcasts in their sub-accounts"
  ON public.broadcasts FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can create broadcasts in their sub-accounts"
  ON public.broadcasts FOR INSERT
  WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can update broadcasts in their sub-accounts"
  ON public.broadcasts FOR UPDATE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete broadcasts in their sub-accounts"
  ON public.broadcasts FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));
