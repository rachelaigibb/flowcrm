-- ============================================================================
-- 00012: Automation execution engine support
-- ============================================================================
-- The Phase 2 code writes sub_account_id and log to automation_runs, but
-- migration 00006 never created those columns — manual runs have been failing
-- silently. This adds them, plus resume_at for pausable "wait" steps, and a
-- SECURITY DEFINER enqueue function so public (anon) form submissions can
-- queue automation runs without an RLS-passing session.

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS sub_account_id uuid REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS log jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resume_at timestamptz;

-- Backfill sub_account_id from the parent automation for any existing rows
UPDATE public.automation_runs r
SET sub_account_id = a.sub_account_id
FROM public.automations a
WHERE r.automation_id = a.id AND r.sub_account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_runs_sub_account
  ON public.automation_runs(sub_account_id);

-- Partial index for the engine's "due paused runs" query
CREATE INDEX IF NOT EXISTS idx_automation_runs_resume
  ON public.automation_runs(status, resume_at)
  WHERE status = 'paused';

-- ============================================================================
-- enqueue_form_automation_runs
-- ============================================================================
-- Public form submissions run as anon and cannot pass the RLS policies on
-- automation_runs. This derives org/sub-account from the form row itself
-- (never trusting client-supplied tenant ids) and enqueues paused runs due
-- immediately; the engine picks them up on the next authenticated visit.

CREATE OR REPLACE FUNCTION public.enqueue_form_automation_runs(
  p_form_id uuid,
  p_contact_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form record;
  v_count integer := 0;
BEGIN
  SELECT id, org_id, sub_account_id, published
    INTO v_form
    FROM public.forms
   WHERE id = p_form_id;

  IF v_form.id IS NULL OR NOT v_form.published THEN
    RETURN 0;
  END IF;

  -- The contact must belong to the form's sub-account (blocks forged ids)
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
     WHERE c.id = p_contact_id
       AND c.sub_account_id = v_form.sub_account_id
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.automation_runs
    (org_id, sub_account_id, automation_id, contact_id, status, current_step, resume_at, log)
  SELECT
    a.org_id, a.sub_account_id, a.id, p_contact_id, 'paused', 0, now(),
    jsonb_build_array(jsonb_build_object(
      'event', 'form_submission',
      'form_id', p_form_id,
      'timestamp', now()
    ))
  FROM public.automations a
  WHERE a.org_id = v_form.org_id
    AND a.sub_account_id = v_form.sub_account_id
    AND a.enabled = true
    AND a.trigger_type = 'form_submission'
    AND (
      a.trigger_config->>'form_id' IS NULL
      OR a.trigger_config->>'form_id' = ''
      OR a.trigger_config->>'form_id' = p_form_id::text
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_form_automation_runs(uuid, uuid) TO anon, authenticated;
