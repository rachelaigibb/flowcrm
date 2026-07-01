-- ============================================================================
-- FlowCRM Phase 2C: Form Builder
-- Forms + Form Submissions tables
-- ============================================================================

-- ============================================================================
-- SECTION 1: Forms
-- ============================================================================

CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]',
  settings jsonb NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sub_account_id, slug)
);

-- fields JSONB structure:
-- [
--   {
--     "id": "uuid",
--     "type": "text|email|phone|textarea|select|checkbox|date|number",
--     "label": "string",
--     "placeholder": "string|null",
--     "required": boolean,
--     "options": ["string"] (for select type)
--   }
-- ]

-- settings JSONB structure:
-- {
--   "submit_button_text": "string",
--   "success_message": "string",
--   "redirect_url": "string|null",
--   "create_contact": boolean (auto-create contact from submission),
--   "notify_email": "string|null" (email notification on submission)
-- }

CREATE INDEX idx_forms_org ON public.forms(org_id);
CREATE INDEX idx_forms_sub_account ON public.forms(sub_account_id);
CREATE INDEX idx_forms_slug ON public.forms(sub_account_id, slug);

CREATE TRIGGER set_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forms in their sub-accounts"
  ON public.forms FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can create forms in their sub-accounts"
  ON public.forms FOR INSERT
  WITH CHECK (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can update forms in their sub-accounts"
  ON public.forms FOR UPDATE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete forms in their sub-accounts"
  ON public.forms FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

-- ============================================================================
-- SECTION 2: Form Submissions
-- ============================================================================

CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- data JSONB structure:
-- { "field_id": "value", ... }

CREATE INDEX idx_form_submissions_org ON public.form_submissions(org_id);
CREATE INDEX idx_form_submissions_sub_account ON public.form_submissions(sub_account_id);
CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX idx_form_submissions_contact ON public.form_submissions(contact_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view/manage submissions in their sub-accounts
CREATE POLICY "Users can view submissions in their sub-accounts"
  ON public.form_submissions FOR SELECT
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "Users can delete submissions in their sub-accounts"
  ON public.form_submissions FOR DELETE
  USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

-- Public insert policy: anyone can submit to a published form
-- We validate form existence and published status in the server action
CREATE POLICY "Anyone can submit to published forms"
  ON public.form_submissions FOR INSERT
  WITH CHECK (true);
