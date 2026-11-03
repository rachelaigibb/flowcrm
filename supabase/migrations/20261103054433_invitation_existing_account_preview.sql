-- The high-entropy invitation token permits its recipient to learn whether
-- the invited address already has a login, so the page can present the right flow.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT jsonb_build_object(
    'email', i.email,
    'org_name', o.name,
    'has_account', EXISTS (
      SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(i.email)
    )
  ) FROM public.invitations i
    JOIN public.organizations o ON o.id = i.org_id
    WHERE i.token = p_token AND i.status = 'pending' AND i.expires_at > now()),
    jsonb_build_object('error', 'Invitation unavailable'));
$$;
REVOKE ALL ON FUNCTION public.get_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated;
