-- Sequential deal number per workspace, assigned on insert; the title gets a "#N · " prefix
-- unless it already has one (imports set their own numbers).
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS number integer;
CREATE UNIQUE INDEX IF NOT EXISTS deals_sub_account_number_key ON public.deals (sub_account_id, number) WHERE number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_deal_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.number IS NULL THEN
    -- serialize per workspace so two inserts can't take the same number
    PERFORM pg_advisory_xact_lock(hashtext(NEW.sub_account_id::text));
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number FROM public.deals WHERE sub_account_id = NEW.sub_account_id;
  END IF;
  IF NEW.title IS NOT NULL AND NEW.title !~ '^#\d+\s*·' THEN
    NEW.title := '#' || NEW.number || ' · ' || NEW.title;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deals_assign_number ON public.deals;
CREATE TRIGGER deals_assign_number BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_deal_number();

-- Backfill: imported deals keep the number from their title/metadata; anything else is numbered by creation order after them.
UPDATE public.deals SET number = (metadata->>'deal_no')::int
WHERE number IS NULL AND metadata->>'deal_no' ~ '^\d+$';
WITH ranked AS (
  SELECT id, sub_account_id, ROW_NUMBER() OVER (PARTITION BY sub_account_id ORDER BY created_at, id) AS rn,
         (SELECT COALESCE(MAX(number), 0) FROM public.deals d2 WHERE d2.sub_account_id = d.sub_account_id) AS base
  FROM public.deals d WHERE number IS NULL
)
UPDATE public.deals d SET number = r.base + r.rn FROM ranked r WHERE d.id = r.id;
