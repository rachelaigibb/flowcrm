-- Append-only provider evidence. No raw payload, recipient address, IP or device data.
-- Keep unmatched events: Resend can deliver a webhook before provider_id is saved.
CREATE TABLE public.email_delivery_events (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 255),
 provider_id text NOT NULL CHECK(length(provider_id) BETWEEN 1 AND 255),
 event_type text NOT NULL CHECK(event_type IN ('email.sent','email.delivered','email.clicked','email.bounced','email.complained','email.delivery_delayed','email.failed','email.suppressed')),
 occurred_at timestamptz NOT NULL,
 link text CHECK(length(link) <= 16384),
 received_at timestamptz NOT NULL DEFAULT now(),
 CHECK((event_type='email.clicked' AND link IS NOT NULL) OR (event_type<>'email.clicked' AND link IS NULL))
);
CREATE INDEX email_delivery_events_provider_idx ON public.email_delivery_events(provider_id,event_id);
-- One provider message belongs to one recipient. Preflight existing duplicates before applying.
CREATE UNIQUE INDEX broadcast_recipients_provider_idx ON public.broadcast_recipients(provider_id) WHERE provider_id IS NOT NULL;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_delivery_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT SELECT,INSERT ON public.email_delivery_events TO service_role;
-- Match provider IDs only through a recipient and email campaign the caller can see.
-- Unmatched events have no tenant-visible row. No client can insert/alter evidence.
CREATE POLICY email_delivery_events_read ON public.email_delivery_events FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.broadcast_recipients r
 JOIN public.broadcasts b ON b.id=r.broadcast_id AND b.org_id=r.org_id AND b.sub_account_id=r.sub_account_id
 WHERE r.provider_id=email_delivery_events.provider_id AND b.channel='email'
 AND r.sub_account_id IN (SELECT public.get_user_sub_account_ids()))
);
