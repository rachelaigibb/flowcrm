-- 00017: website intake — per-workspace API keys + SECURITY DEFINER intake function.
-- External sites POST leads to /api/intake with a workspace key; the route calls
-- intake_contact() with the anon client. No service-role key leaves FlowCRM.

-- ── Keys ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intake_keys (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  sub_account_id uuid        NOT NULL REFERENCES public.sub_accounts ON DELETE CASCADE,
  label          text        NOT NULL,
  key_hash       text        NOT NULL UNIQUE,   -- sha256 hex of the secret; the secret is shown once
  key_prefix     text        NOT NULL,          -- first characters, for display only
  created_by     uuid        REFERENCES auth.users,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_intake_keys_sub_account ON public.intake_keys (sub_account_id);

ALTER TABLE public.intake_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_keys_select" ON public.intake_keys;
CREATE POLICY "intake_keys_select" ON public.intake_keys
  FOR SELECT USING (sub_account_id IN (SELECT public.get_user_sub_account_ids()));

DROP POLICY IF EXISTS "intake_keys_insert" ON public.intake_keys;
CREATE POLICY "intake_keys_insert" ON public.intake_keys
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "intake_keys_update" ON public.intake_keys;
CREATE POLICY "intake_keys_update" ON public.intake_keys
  FOR UPDATE USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "intake_keys_delete" ON public.intake_keys;
CREATE POLICY "intake_keys_delete" ON public.intake_keys
  FOR DELETE USING (public.is_org_admin(org_id));

-- ── Intake function ─────────────────────────────────────────────────────────
-- Payload (validated by the route before it gets here):
--   name, email, phone?, message?, source?, tags?[], meta?{}, consent (bool),
--   consent_text?
-- Returns jsonb: {error} or {contact_id, created, org_id, sub_account_id,
--   sub_account_name, key_label, email_settings, notify_email}
CREATE OR REPLACE FUNCTION public.intake_contact(p_key text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key        record;
  v_sub        record;
  v_email      text;
  v_name       text;
  v_first      text;
  v_last       text;
  v_phone      text;
  v_message    text;
  v_source     text;
  v_consent    boolean;
  v_tags       text[];
  v_meta       jsonb;
  v_existing   record;
  v_contact_id uuid;
  v_created    boolean := false;
  v_now        timestamptz := now();
BEGIN
  IF p_key IS NULL OR length(p_key) < 16 THEN
    RETURN jsonb_build_object('error', 'invalid_key');
  END IF;

  SELECT * INTO v_key
    FROM public.intake_keys
   WHERE key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
     AND revoked_at IS NULL;

  IF v_key.id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_key');
  END IF;

  SELECT id, org_id, name, settings INTO v_sub
    FROM public.sub_accounts
   WHERE id = v_key.sub_account_id;

  v_email   := lower(trim(p_payload->>'email'));
  v_name    := trim(coalesce(p_payload->>'name', ''));
  v_phone   := nullif(trim(coalesce(p_payload->>'phone', '')), '');
  v_message := nullif(trim(coalesce(p_payload->>'message', '')), '');
  v_source  := coalesce(nullif(trim(p_payload->>'source'), ''), 'website');
  v_consent := coalesce((p_payload->>'consent')::boolean, false);
  v_meta    := coalesce(p_payload->'meta', '{}'::jsonb);

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('error', 'email_required');
  END IF;

  v_first := split_part(v_name, ' ', 1);
  v_last  := nullif(trim(substr(v_name, length(v_first) + 1)), '');

  SELECT array_agg(DISTINCT t) INTO v_tags
    FROM (
      SELECT 'website' AS t
      UNION ALL
      SELECT lower(trim(x)) FROM jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb)) AS x
    ) s
   WHERE t <> '';

  SELECT id, tags, metadata, phone, consent_status INTO v_existing
    FROM public.contacts
   WHERE sub_account_id = v_sub.id
     AND lower(email) = v_email
   ORDER BY created_at
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    v_contact_id := v_existing.id;
    UPDATE public.contacts
       SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(coalesce(v_existing.tags, '{}'::text[]) || v_tags) AS t),
           phone = coalesce(v_existing.phone, v_phone),
           metadata = coalesce(v_existing.metadata, '{}'::jsonb)
                      || jsonb_build_object('intake_' || to_char(v_now, 'YYYYMMDDHH24MISS'),
                           jsonb_build_object('source', v_source, 'message', v_message, 'meta', v_meta)),
           consent_status = CASE WHEN v_consent AND v_existing.consent_status <> 'explicit' THEN 'explicit' ELSE consent_status END,
           consent_date   = CASE WHEN v_consent AND v_existing.consent_status <> 'explicit' THEN v_now ELSE consent_date END
     WHERE id = v_contact_id;
  ELSE
    v_tags := (SELECT array_agg(DISTINCT t) FROM unnest(v_tags || ARRAY['lead']) AS t);
    INSERT INTO public.contacts
      (org_id, sub_account_id, first_name, last_name, email, phone, source, tags, metadata,
       consent_status, consent_date)
    VALUES
      (v_sub.org_id, v_sub.id, nullif(v_first, ''), v_last, v_email, v_phone, v_source, v_tags,
       jsonb_build_object('website_source', v_source, 'intake_key', v_key.label) || CASE WHEN v_meta = '{}'::jsonb THEN '{}'::jsonb ELSE jsonb_build_object('intake_meta', v_meta) END,
       CASE WHEN v_consent THEN 'explicit' ELSE 'none' END,
       CASE WHEN v_consent THEN v_now ELSE NULL END)
    RETURNING id INTO v_contact_id;
    v_created := true;
  END IF;

  -- Timeline entry so the submission is visible on the contact
  INSERT INTO public.activities (org_id, sub_account_id, contact_id, type, content, metadata)
  VALUES (
    v_sub.org_id, v_sub.id, v_contact_id, 'note',
    'Website form (' || v_source || ')' || CASE WHEN v_message IS NULL THEN '' ELSE E'\n\n' || v_message END,
    jsonb_build_object(
      'via', 'intake',
      'source', v_source,
      'key_label', v_key.label,
      'consent', v_consent,
      'consent_text', p_payload->>'consent_text',
      'meta', v_meta
    )
  );

  -- New contacts fire contact_created automations. The anon route cannot run the
  -- engine, so runs are queued paused-and-due; processDueAutomationRuns picks them
  -- up on the next authenticated visit (same model as public form submissions).
  IF v_created THEN
    INSERT INTO public.automation_runs
      (org_id, sub_account_id, automation_id, contact_id, status, current_step, resume_at, log)
    SELECT a.org_id, a.sub_account_id, a.id, v_contact_id, 'paused', 0, v_now,
           jsonb_build_array(jsonb_build_object('event', 'trigger:contact_created', 'via', 'intake', 'timestamp', v_now))
      FROM public.automations a
     WHERE a.sub_account_id = v_sub.id
       AND a.enabled = true
       AND a.trigger_type = 'contact_created';
  END IF;

  UPDATE public.intake_keys SET last_used_at = v_now WHERE id = v_key.id;

  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'created', v_created,
    'org_id', v_sub.org_id,
    'sub_account_id', v_sub.id,
    'sub_account_name', v_sub.name,
    'key_label', v_key.label,
    'email_settings', v_sub.settings->'email',
    'notify_email', v_sub.settings->'intake'->>'notify_email'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.intake_contact(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.intake_contact(text, jsonb) TO anon, authenticated;
