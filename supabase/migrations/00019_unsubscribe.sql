-- Unsubscribe: every contact carries a random token; the public page /u/<token>
-- and the one-click endpoint /api/unsubscribe/<token> call SECURITY DEFINER
-- functions as anon to look the contact up and withdraw consent.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS contacts_unsubscribe_token_idx ON public.contacts (unsubscribe_token);

CREATE OR REPLACE FUNCTION public.unsubscribe_lookup(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'first_name', c.first_name,
    'email', c.email,
    'consent_status', c.consent_status,
    'from_name', COALESCE(sa.settings->'email'->>'from_name', sa.name),
    'sub_account_name', sa.name
  )
  FROM public.contacts c
  JOIN public.sub_accounts sa ON sa.id = c.sub_account_id
  WHERE c.unsubscribe_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.unsubscribe_contact(p_token uuid, p_source text DEFAULT 'link')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_contact FROM public.contacts WHERE unsubscribe_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_contact.consent_status = 'withdrawn' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  UPDATE public.contacts
     SET consent_status = 'withdrawn',
         consent_date = now(),
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'unsubscribed_at', now(),
           'unsubscribe_source', p_source,
           'consent_before_unsubscribe', v_contact.consent_status),
         updated_at = now()
   WHERE id = v_contact.id;

  INSERT INTO public.activities (org_id, sub_account_id, contact_id, type, content, metadata)
  VALUES (v_contact.org_id, v_contact.sub_account_id, v_contact.id, 'system',
          'Unsubscribed from email (' || p_source || '). Consent set to withdrawn.',
          jsonb_build_object('event', 'unsubscribe', 'source', p_source));

  RETURN jsonb_build_object('ok', true, 'already', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_lookup(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_contact(uuid, text) TO anon, authenticated;
