-- ============================================================================
-- FlowCRM Initial Schema Migration
-- Multi-tenant CRM: Organization → Sub-accounts → Users with roles
-- ============================================================================

-- ============================================================================
-- SECTION 1: Helper Functions
-- ============================================================================

-- Returns all org_ids the current user belongs to
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.memberships WHERE user_id = auth.uid();
$$;

-- Returns the user's role in a specific org
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.memberships WHERE user_id = auth.uid() AND org_id = p_org_id LIMIT 1;
$$;

-- Returns true if user is owner or admin in the given org
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Returns all sub_account_ids the current user has access to
-- (either via direct sub-account membership OR org-level admin/owner role)
CREATE OR REPLACE FUNCTION public.get_user_sub_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Direct sub-account memberships
  SELECT sub_account_id FROM public.sub_account_memberships WHERE user_id = auth.uid()
  UNION
  -- All sub-accounts in orgs where user is admin/owner
  SELECT sa.id FROM public.sub_accounts sa
  INNER JOIN public.memberships m ON m.org_id = sa.org_id
  WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin');
$$;

-- ============================================================================
-- SECTION 2: updated_at Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 3: Tables
-- ============================================================================

-- 3.1 organizations
CREATE TABLE public.organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        UNIQUE NOT NULL,
  logo_url   text,
  settings   jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3.2 memberships (user ↔ org)
CREATE TABLE public.memberships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users NOT NULL,
  org_id     uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  role       text        NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- 3.3 sub_accounts
CREATE TABLE public.sub_accounts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  name       text        NOT NULL,
  slug       text        NOT NULL,
  currency   text        DEFAULT 'CAD',
  timezone   text        DEFAULT 'America/Vancouver',
  settings   jsonb       DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TRIGGER set_sub_accounts_updated_at
  BEFORE UPDATE ON public.sub_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3.4 sub_account_memberships (user ↔ sub-account access)
CREATE TABLE public.sub_account_memberships (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users NOT NULL,
  sub_account_id uuid        REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  role           text        NOT NULL CHECK (role IN ('admin', 'collaborator')),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, sub_account_id)
);

-- 3.5 contacts
CREATE TABLE public.contacts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  sub_account_id   uuid        REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  company          text,
  source           text,
  tags             text[]      DEFAULT '{}',
  metadata         jsonb       DEFAULT '{}',
  consent_status   text        DEFAULT 'none' CHECK (consent_status IN ('explicit', 'implied', 'none', 'withdrawn')),
  consent_date     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3.6 pipeline_stages
CREATE TABLE public.pipeline_stages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  sub_account_id uuid        REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  name           text        NOT NULL,
  position       int         NOT NULL,
  color          text        DEFAULT '#6366f1',
  created_at     timestamptz DEFAULT now()
);

-- 3.7 deals
CREATE TABLE public.deals (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid          REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  sub_account_id uuid          REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  contact_id     uuid          REFERENCES public.contacts ON DELETE SET NULL,
  title          text          NOT NULL,
  value          numeric(12,2) DEFAULT 0,
  currency       text          DEFAULT 'CAD',
  stage_id       uuid          REFERENCES public.pipeline_stages NOT NULL,
  priority       text          DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status         text          DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  expected_close date,
  metadata       jsonb         DEFAULT '{}',
  created_at     timestamptz   DEFAULT now(),
  updated_at     timestamptz   DEFAULT now()
);

CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3.8 activities (timeline entries)
CREATE TABLE public.activities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  sub_account_id uuid        REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  contact_id     uuid        REFERENCES public.contacts ON DELETE SET NULL,
  deal_id        uuid        REFERENCES public.deals ON DELETE SET NULL,
  user_id        uuid        REFERENCES auth.users,
  type           text        NOT NULL CHECK (type IN ('note', 'email', 'sms', 'call', 'meeting', 'status_change', 'system')),
  content        text,
  metadata       jsonb       DEFAULT '{}',
  created_at     timestamptz DEFAULT now()
);

-- 3.9 tasks
CREATE TABLE public.tasks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES public.organizations ON DELETE CASCADE NOT NULL,
  sub_account_id uuid        REFERENCES public.sub_accounts ON DELETE CASCADE NOT NULL,
  contact_id     uuid        REFERENCES public.contacts ON DELETE SET NULL,
  deal_id        uuid        REFERENCES public.deals ON DELETE SET NULL,
  assigned_to    uuid        REFERENCES auth.users,
  title          text        NOT NULL,
  description    text,
  due_date       timestamptz,
  priority       text        DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status         text        DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- SECTION 4: Indexes
-- ============================================================================

-- memberships
CREATE INDEX idx_memberships_user_id ON public.memberships (user_id);
CREATE INDEX idx_memberships_org_id  ON public.memberships (org_id);

-- sub_accounts
CREATE INDEX idx_sub_accounts_org_id ON public.sub_accounts (org_id);

-- sub_account_memberships
CREATE INDEX idx_sub_account_memberships_user_id        ON public.sub_account_memberships (user_id);
CREATE INDEX idx_sub_account_memberships_sub_account_id ON public.sub_account_memberships (sub_account_id);

-- contacts
CREATE INDEX idx_contacts_org_id         ON public.contacts (org_id);
CREATE INDEX idx_contacts_sub_account_id ON public.contacts (sub_account_id);
CREATE INDEX idx_contacts_email          ON public.contacts (email);

-- pipeline_stages
CREATE INDEX idx_pipeline_stages_org_id         ON public.pipeline_stages (org_id);
CREATE INDEX idx_pipeline_stages_sub_account_id ON public.pipeline_stages (sub_account_id);

-- deals
CREATE INDEX idx_deals_org_id                    ON public.deals (org_id);
CREATE INDEX idx_deals_sub_account_id            ON public.deals (sub_account_id);
CREATE INDEX idx_deals_sub_account_id_status     ON public.deals (sub_account_id, status);
CREATE INDEX idx_deals_sub_account_id_stage_id   ON public.deals (sub_account_id, stage_id);
CREATE INDEX idx_deals_contact_id                ON public.deals (contact_id);

-- activities
CREATE INDEX idx_activities_org_id         ON public.activities (org_id);
CREATE INDEX idx_activities_sub_account_id ON public.activities (sub_account_id);
CREATE INDEX idx_activities_contact_id     ON public.activities (contact_id);
CREATE INDEX idx_activities_deal_id        ON public.activities (deal_id);

-- tasks
CREATE INDEX idx_tasks_org_id              ON public.tasks (org_id);
CREATE INDEX idx_tasks_sub_account_id      ON public.tasks (sub_account_id);
CREATE INDEX idx_tasks_assigned_to_status  ON public.tasks (assigned_to, status);

-- ============================================================================
-- SECTION 5: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_account_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5.1 organizations
-- ---------------------------------------------------------------------------

CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT WITH CHECK (true);
  -- Any authenticated user can create an org (they become the owner via the seed function)

CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id));

CREATE POLICY "organizations_delete" ON public.organizations
  FOR DELETE USING (public.get_user_org_role(id) = 'owner');

-- ---------------------------------------------------------------------------
-- 5.2 memberships
-- ---------------------------------------------------------------------------

CREATE POLICY "memberships_select" ON public.memberships
  FOR SELECT USING (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "memberships_insert" ON public.memberships
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "memberships_update" ON public.memberships
  FOR UPDATE USING (public.is_org_admin(org_id));

CREATE POLICY "memberships_delete" ON public.memberships
  FOR DELETE USING (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- 5.3 sub_accounts
-- ---------------------------------------------------------------------------

CREATE POLICY "sub_accounts_select" ON public.sub_accounts
  FOR SELECT USING (id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "sub_accounts_insert" ON public.sub_accounts
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "sub_accounts_update" ON public.sub_accounts
  FOR UPDATE USING (public.is_org_admin(org_id));

CREATE POLICY "sub_accounts_delete" ON public.sub_accounts
  FOR DELETE USING (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- 5.4 sub_account_memberships
-- ---------------------------------------------------------------------------

CREATE POLICY "sub_account_memberships_select" ON public.sub_account_memberships
  FOR SELECT USING (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "sub_account_memberships_insert" ON public.sub_account_memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sub_accounts sa
      WHERE sa.id = sub_account_id
        AND public.is_org_admin(sa.org_id)
    )
  );

CREATE POLICY "sub_account_memberships_update" ON public.sub_account_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts sa
      WHERE sa.id = sub_account_id
        AND public.is_org_admin(sa.org_id)
    )
  );

CREATE POLICY "sub_account_memberships_delete" ON public.sub_account_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sub_accounts sa
      WHERE sa.id = sub_account_id
        AND public.is_org_admin(sa.org_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5.5 contacts (sub-account scoped)
-- ---------------------------------------------------------------------------

CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "contacts_insert" ON public.contacts
  FOR INSERT WITH CHECK (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
    AND org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "contacts_update" ON public.contacts
  FOR UPDATE USING (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "contacts_delete" ON public.contacts
  FOR DELETE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

-- ---------------------------------------------------------------------------
-- 5.6 pipeline_stages (sub-account scoped)
-- ---------------------------------------------------------------------------

CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages
  FOR INSERT WITH CHECK (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages
  FOR UPDATE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages
  FOR DELETE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

-- ---------------------------------------------------------------------------
-- 5.7 deals (sub-account scoped)
-- ---------------------------------------------------------------------------

CREATE POLICY "deals_select" ON public.deals
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "deals_insert" ON public.deals
  FOR INSERT WITH CHECK (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
    AND org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "deals_update" ON public.deals
  FOR UPDATE USING (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "deals_delete" ON public.deals
  FOR DELETE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

-- ---------------------------------------------------------------------------
-- 5.8 activities (sub-account scoped)
-- ---------------------------------------------------------------------------

CREATE POLICY "activities_select" ON public.activities
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT WITH CHECK (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
    AND org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE USING (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

-- ---------------------------------------------------------------------------
-- 5.9 tasks (sub-account scoped)
-- ---------------------------------------------------------------------------

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
    AND org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    public.is_org_admin(org_id)
    AND sub_account_id IN (SELECT public.get_user_sub_account_ids())
  );

-- ============================================================================
-- SECTION 6: Seed Data Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_org_with_defaults(
  p_org_name text,
  p_user_id  uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id         uuid;
  v_slug           text;
  v_sub_account_id uuid;
BEGIN
  -- Generate slug from org name (lowercase, hyphens, no special chars)
  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  -- 1. Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (p_org_name, v_slug)
  RETURNING id INTO v_org_id;

  -- 2. Create the owner membership
  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (p_user_id, v_org_id, 'owner');

  -- 3. Create a default sub-account
  INSERT INTO public.sub_accounts (org_id, name, slug)
  VALUES (v_org_id, 'Default', 'default')
  RETURNING id INTO v_sub_account_id;

  -- 4. Create default pipeline stages
  INSERT INTO public.pipeline_stages (org_id, sub_account_id, name, position, color) VALUES
    (v_org_id, v_sub_account_id, 'New',          1, '#6366f1'),
    (v_org_id, v_sub_account_id, 'Contacted',    2, '#8b5cf6'),
    (v_org_id, v_sub_account_id, 'Qualified',    3, '#0ea5e9'),
    (v_org_id, v_sub_account_id, 'Proposal',     4, '#f59e0b'),
    (v_org_id, v_sub_account_id, 'Negotiation',  5, '#f97316'),
    (v_org_id, v_sub_account_id, 'Won',          6, '#22c55e'),
    (v_org_id, v_sub_account_id, 'Lost',         7, '#ef4444');

  -- 5. Return the org_id
  RETURN v_org_id;
END;
$$;
