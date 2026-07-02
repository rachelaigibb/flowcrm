-- ============================================================================
-- FlowCRM Phase 3A: Member Invitations
-- Invite members by email with pending/accepted/expired status
-- ============================================================================

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  sub_account_ids uuid[] NOT NULL DEFAULT '{}',
  sub_account_role text NOT NULL DEFAULT 'collaborator' CHECK (sub_account_role IN ('admin', 'collaborator')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- sub_account_ids: array of sub-account UUIDs the invited user will get access to
-- On accept: create membership + sub_account_memberships for each

CREATE INDEX idx_invitations_org ON public.invitations(org_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_status ON public.invitations(status);

CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Org admins can view invitations for their org
CREATE POLICY "Org admins can view invitations"
  ON public.invitations FOR SELECT
  USING (org_id IN (SELECT public.get_user_org_ids()));

-- Org admins can create invitations
CREATE POLICY "Org admins can create invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (
    org_id IN (SELECT public.get_user_org_ids())
    AND public.is_org_admin(org_id)
  );

-- Org admins can update invitations (revoke)
CREATE POLICY "Org admins can update invitations"
  ON public.invitations FOR UPDATE
  USING (
    org_id IN (SELECT public.get_user_org_ids())
    AND public.is_org_admin(org_id)
  );

-- Org admins can delete invitations
CREATE POLICY "Org admins can delete invitations"
  ON public.invitations FOR DELETE
  USING (
    org_id IN (SELECT public.get_user_org_ids())
    AND public.is_org_admin(org_id)
  );

-- ============================================================================
-- Function to accept an invitation (SECURITY DEFINER)
-- Needs to bypass RLS to create memberships in one transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_sa_id uuid;
BEGIN
  -- Find and lock the invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invitation not found, already used, or expired');
  END IF;

  -- Check if user already has a membership in this org
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = p_user_id AND org_id = v_invitation.org_id
  ) THEN
    -- Update invitation status anyway
    UPDATE public.invitations SET status = 'accepted', accepted_by = p_user_id, updated_at = now()
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('error', 'You are already a member of this organization');
  END IF;

  -- Create org membership
  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (p_user_id, v_invitation.org_id, v_invitation.role);

  -- Create sub-account memberships
  IF array_length(v_invitation.sub_account_ids, 1) > 0 THEN
    FOREACH v_sa_id IN ARRAY v_invitation.sub_account_ids LOOP
      INSERT INTO public.sub_account_memberships (user_id, sub_account_id, role)
      VALUES (p_user_id, v_sa_id, v_invitation.sub_account_role)
      ON CONFLICT (user_id, sub_account_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_by = p_user_id, updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'org_id', v_invitation.org_id);
END;
$$;
