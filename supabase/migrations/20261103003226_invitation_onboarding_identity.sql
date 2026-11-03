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
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Sign in with the invited email address');
  END IF;
  -- Find and lock the invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invitation not found, already used, or expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND lower(u.email) = lower(v_invitation.email) AND u.email_confirmed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Sign in with the invited email address and verify your email first');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_invitation.sub_account_ids) sid
    WHERE NOT EXISTS (SELECT 1 FROM public.sub_accounts sa WHERE sa.id = sid AND sa.org_id = v_invitation.org_id)) THEN
    RETURN jsonb_build_object('error', 'Invitation contains an invalid workspace. Ask for a new invitation.');
  END IF;
  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (p_user_id, v_invitation.org_id, v_invitation.role)
  ON CONFLICT (user_id, org_id) DO NOTHING;

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

REVOKE ALL ON FUNCTION public.accept_invitation(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid) TO authenticated;

-- A high-entropy bearer token reveals only the details needed for onboarding.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT jsonb_build_object('email', i.email, 'org_name', o.name)
    FROM public.invitations i JOIN public.organizations o ON o.id = i.org_id
    WHERE i.token = p_token AND i.status = 'pending' AND i.expires_at > now()),
    jsonb_build_object('error', 'Invitation unavailable'));
$$;
REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;
