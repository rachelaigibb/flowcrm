-- Local candidate only. No rule is enabled by this migration; activation is separate.
-- One durable receipt per submission. No messages, raw payloads, IPs or devices stored.
CREATE TABLE public.intake_submission_receipts (
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  payload_hash text NOT NULL,
  contact_id uuid REFERENCES public.contacts ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks ON DELETE SET NULL,
  contact_created boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sub_account_id, submission_id)
);
ALTER TABLE public.intake_submission_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_submission_receipts FROM PUBLIC, anon, authenticated;
-- Only the existing key-authenticated SECURITY DEFINER intake function uses receipts.

CREATE FUNCTION public.bc_statutory_holidays(p_year integer) RETURNS date[]
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE
  a integer:=p_year%19; b integer:=p_year/100; c integer:=p_year%100;
  d integer:=b/4; e integer:=b%4; f integer:=(b+8)/25;
  g integer:=(b-f+1)/3; h integer:=(19*a+b-d-g+15)%30;
  i integer:=c/4; k integer:=c%4; l integer:=(32+2*e+2*i-h-k)%7;
  m integer:=(a+11*h+22*l)/451;
  easter date:=make_date(p_year,(h+l-7*m+114)/31,((h+l-7*m+114)%31)+1);
  feb date:=make_date(p_year,2,1); aug date:=make_date(p_year,8,1);
  sep date:=make_date(p_year,9,1); oct date:=make_date(p_year,10,1);
  may25 date:=make_date(p_year,5,25);
BEGIN
  -- BC statutory dates, not federal/bank holidays. No assumed substitute days:
  -- BC substitution requires agreement; no such office calendar is configured.
  RETURN ARRAY[make_date(p_year,1,1), feb+((8-extract(isodow FROM feb)::integer)%7)+14,
    easter-2, may25-(((extract(isodow FROM may25)::integer+5)%7)+1),
    make_date(p_year,7,1), aug+((8-extract(isodow FROM aug)::integer)%7),
    sep+((8-extract(isodow FROM sep)::integer)%7), make_date(p_year,9,30),
    oct+((8-extract(isodow FROM oct)::integer)%7)+7,make_date(p_year,11,11),make_date(p_year,12,25)];
END $$;
CREATE FUNCTION public.next_vancouver_business_due(p_received timestamptz) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE day date:=(p_received AT TIME ZONE 'America/Vancouver')::date+1;
BEGIN
  WHILE extract(isodow FROM day)>5 OR day=ANY(public.bc_statutory_holidays(extract(year FROM day)::integer)) LOOP
    day:=day+1;
  END LOOP;
  RETURN (day+time '17:00') AT TIME ZONE 'America/Vancouver';
END $$;
REVOKE ALL ON FUNCTION public.bc_statutory_holidays(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_vancouver_business_due(timestamptz) FROM PUBLIC;

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
  v_submission uuid;
  v_hash text;
  v_receipt public.intake_submission_receipts%ROWTYPE;
  v_rule jsonb;
  v_follow_up boolean := false;
  v_assignee uuid;
  v_task_id uuid;
  v_activity_id uuid;
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

  v_rule := v_sub.settings->'intake'->'follow_up';
  v_follow_up := coalesce(v_rule->>'enabled'='true',false) AND coalesce(v_rule->'key_labels' ? v_key.label,false) AND (
    coalesce(v_rule->'sources' ? v_source,false) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(v_rule->'source_prefixes','[]'::jsonb)) prefix
      WHERE length(prefix)>0 AND starts_with(v_source,prefix)
    )
  );
  IF nullif(p_payload->>'submission_id','') IS NOT NULL THEN
    IF p_payload->>'submission_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('error','invalid_submission_id');
    END IF;
    v_submission := (p_payload->>'submission_id')::uuid;
    v_hash := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
    -- Serialize identical retries, even when the contact does not exist yet.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_sub.id::text||':'||v_submission::text,0));
    SELECT * INTO v_receipt FROM public.intake_submission_receipts
      WHERE sub_account_id=v_sub.id AND submission_id=v_submission;
    IF FOUND THEN
      IF v_receipt.payload_hash<>v_hash THEN RETURN jsonb_build_object('error','submission_conflict'); END IF;
      RETURN jsonb_build_object('contact_id',v_receipt.contact_id,'created',v_receipt.contact_created,
        'duplicate',true,'task_id',v_receipt.task_id,'org_id',v_sub.org_id,'sub_account_id',v_sub.id);
    END IF;
  ELSIF v_follow_up THEN
    -- Enabled inquiry workflows require stable event identity; never guess by email/time.
    RETURN jsonb_build_object('error','submission_id_required');
  END IF;
  IF v_follow_up THEN
    IF coalesce(v_rule->>'assigned_to','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('error','follow_up_assignment_invalid');
    END IF;
    v_assignee := (v_rule->>'assigned_to')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id=v_sub.org_id AND m.user_id=v_assignee
      AND (m.role IN ('owner','admin') OR EXISTS (SELECT 1 FROM public.sub_account_memberships sm WHERE sm.sub_account_id=v_sub.id AND sm.user_id=v_assignee))) THEN
      RETURN jsonb_build_object('error','follow_up_assignment_invalid');
    END IF;
  END IF;
  -- Distinct inquiries by the same email still make separate tasks, but one contact.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_sub.id::text||':'||v_email,1));

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
  ) RETURNING id INTO v_activity_id;

  IF v_follow_up THEN
    INSERT INTO public.tasks(org_id,sub_account_id,contact_id,assigned_to,title,description,due_date,priority,status)
    VALUES(v_sub.org_id,v_sub.id,v_contact_id,v_assignee,
      'Respond to website inquiry: '||coalesce(nullif(v_name,''),v_email),
      'Respond personally to this inquiry. No automated client message was sent by this workflow.'||E'\nSource: '||v_source||
      E'\nInquiry activity: '||v_activity_id::text||E'\nSubmission: '||v_submission::text||
      E'\nDue by 5 p.m. America/Vancouver on the next weekday excluding BC statutory holidays.',
      public.next_vancouver_business_due(v_now),'high','pending') RETURNING id INTO v_task_id;
    UPDATE public.activities SET metadata=metadata||jsonb_build_object('submission_id',v_submission,'follow_up_task_id',v_task_id)
      WHERE id=v_activity_id;
  END IF;
  IF v_submission IS NOT NULL THEN
    INSERT INTO public.intake_submission_receipts(sub_account_id,submission_id,payload_hash,contact_id,task_id,contact_created,received_at)
      VALUES(v_sub.id,v_submission,v_hash,v_contact_id,v_task_id,v_created,v_now);
  END IF;

  -- New contacts fire contact_created automations. The anon route cannot run the
  -- engine, so runs are queued paused-and-due; processDueAutomationRuns picks them
  -- up on the next authenticated visit (same model as public form submissions).
  IF v_created AND NOT v_follow_up THEN
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
    'task_id', v_task_id,
    'duplicate', false,
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
