-- v0.9.0 scheduler: Vercel Cron calls /api/cron/tick every 5 minutes. The
-- route writes one heartbeat row per job here so the app can show when the
-- scheduler last ran. Only the service role (the cron route) writes; signed-in
-- users can read. Rows hold timestamps and a tick-level error only, never
-- tenant data.

CREATE TABLE IF NOT EXISTS public.system_jobs (
  name text PRIMARY KEY,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_ok_at timestamptz,
  last_error text
);

ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read job heartbeats" ON public.system_jobs;
CREATE POLICY "Signed-in users can read job heartbeats"
  ON public.system_jobs FOR SELECT TO authenticated USING (true);

-- Due-work lookups the tick runs every 5 minutes.
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_due
  ON public.broadcasts (scheduled_at) WHERE status = 'scheduled';
