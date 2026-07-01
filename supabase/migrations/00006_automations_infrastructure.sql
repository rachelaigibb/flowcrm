-- ============================================================================
-- FlowCRM Phase 2D: Email & SMS Automations
-- Automations with steps (triggers → actions in sequence)
-- ============================================================================

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'form_submission', 'contact_created', 'deal_stage_change', 'tag_added', 'manual'
  )),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- trigger_config JSONB examples:
-- form_submission: { "form_id": "uuid" }
-- deal_stage_change: { "stage_id": "uuid", "from_stage_id": "uuid|null" }
-- tag_added: { "tag_name": "string" }
-- contact_created: {}
-- manual: {}

CREATE INDEX idx_automations_org ON public.automations(org_id);
CREATE INDEX idx_automations_sub_account ON public.automations(sub_account_id);

CREATE TRIGGER set_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations in their sub-accounts"
  ON public.automations FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can create automations in their sub-accounts"
  ON public.automations FOR INSERT
  WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can update automations in their sub-accounts"
  ON public.automations FOR UPDATE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete automations in their sub-accounts"
  ON public.automations FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

-- ============================================================================
-- Automation Steps (linear sequence of actions)
-- ============================================================================

CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  position integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'send_email', 'send_sms', 'wait', 'add_tag', 'remove_tag', 'create_task'
  )),
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- config JSONB examples:
-- send_email: { "template_id": "uuid" } or { "subject": "...", "body": "..." }
-- send_sms: { "template_id": "uuid" } or { "body": "..." }
-- wait: { "duration_minutes": 1440 } (24 hours)
-- add_tag: { "tag_name": "Follow Up" }
-- remove_tag: { "tag_name": "New" }
-- create_task: { "title": "...", "due_days": 3, "priority": "medium" }

CREATE INDEX idx_automation_steps_automation ON public.automation_steps(automation_id);

ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps for automations in their sub-accounts"
  ON public.automation_steps FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Users can create steps for automations in their sub-accounts"
  ON public.automation_steps FOR INSERT
  WITH CHECK (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Users can update steps for automations in their sub-accounts"
  ON public.automation_steps FOR UPDATE
  USING (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Users can delete steps for automations in their sub-accounts"
  ON public.automation_steps FOR DELETE
  USING (org_id IN (SELECT public.get_user_org_ids()));

-- ============================================================================
-- Automation Runs (execution history)
-- ============================================================================

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  current_step integer NOT NULL DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_automation_runs_automation ON public.automation_runs(automation_id);
CREATE INDEX idx_automation_runs_contact ON public.automation_runs(contact_id);
CREATE INDEX idx_automation_runs_status ON public.automation_runs(status);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs for automations in their sub-accounts"
  ON public.automation_runs FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Users can create runs"
  ON public.automation_runs FOR INSERT
  WITH CHECK (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Users can update runs"
  ON public.automation_runs FOR UPDATE
  USING (org_id IN (SELECT public.get_user_org_ids()));
