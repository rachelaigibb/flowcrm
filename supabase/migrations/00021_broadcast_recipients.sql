-- Permanent send-time audience, separate from mutable tags and test sends.
CREATE TABLE public.broadcast_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organizations(id),
 sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id),
 broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
 contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
 contact_name text NOT NULL,
 company text,
 address text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 sent_at timestamptz,
 provider_id text,
 error text,
 follow_up_status text NOT NULL DEFAULT 'not_followed_up' CHECK(follow_up_status IN ('not_followed_up','followed_up','interested','declined','replied')),
 follow_up_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 historical boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(broadcast_id,contact_id)
);
CREATE INDEX ON public.broadcast_recipients(sub_account_id,broadcast_id,status);
ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.broadcast_recipients TO authenticated;
GRANT ALL ON public.broadcast_recipients TO service_role;
CREATE POLICY recipients_access ON public.broadcast_recipients FOR ALL TO authenticated
 USING(sub_account_id IN (SELECT public.get_user_sub_account_ids()))
 WITH CHECK(sub_account_id IN (SELECT public.get_user_sub_account_ids()) AND EXISTS(SELECT 1 FROM public.broadcasts b WHERE b.id=broadcast_id AND b.org_id=broadcast_recipients.org_id AND b.sub_account_id=broadcast_recipients.sub_account_id) AND (contact_id IS NULL OR EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=contact_id AND c.org_id=broadcast_recipients.org_id AND c.sub_account_id=broadcast_recipients.sub_account_id)));
-- Recover only successes supported by stored activities. Unknown failures stay unknown.
INSERT INTO public.broadcast_recipients(org_id,sub_account_id,broadcast_id,contact_id,contact_name,company,address,status,sent_at,provider_id,historical)
SELECT DISTINCT ON(b.id,a.contact_id) b.org_id,b.sub_account_id,b.id,a.contact_id,
 COALESCE(NULLIF(concat_ws(' ',c.first_name,c.last_name),''),c.company,'Former contact'),c.company,
 COALESCE(a.metadata->>'to',c.email,c.phone,'Unknown'), 'sent',a.created_at,a.metadata->>'resend_id',true
FROM public.activities a JOIN public.broadcasts b ON a.metadata->>'broadcast_id'=b.id::text AND a.org_id=b.org_id AND a.sub_account_id=b.sub_account_id
LEFT JOIN public.contacts c ON c.id=a.contact_id AND c.org_id=b.org_id AND c.sub_account_id=b.sub_account_id
WHERE a.type IN ('email','sms') AND a.contact_id IS NOT NULL
ORDER BY b.id,a.contact_id,a.created_at DESC;
-- Transaction + row lock make repeated/concurrent task requests idempotent.
CREATE FUNCTION public.create_broadcast_followups(p_broadcast uuid,p_recipients uuid[],p_due date) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r record; t uuid; n integer:=0;
BEGIN
 IF p_due IS NULL OR cardinality(p_recipients)>500 THEN RAISE EXCEPTION 'Invalid follow-up selection'; END IF;
 FOR r IN SELECT br.*,b.name AS broadcast_name FROM public.broadcast_recipients br JOIN public.broadcasts b ON b.id=br.broadcast_id
 WHERE br.broadcast_id=p_broadcast AND br.id=ANY(p_recipients) AND br.status='sent' AND br.contact_id IS NOT NULL
 AND br.follow_up_status NOT IN ('declined','replied') AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=br.contact_id AND c.consent_status IN ('explicit','implied') AND NOT ('do-not-contact'=ANY(c.tags))) FOR UPDATE OF br
 LOOP
  IF r.follow_up_task_id IS NULL THEN
   INSERT INTO public.tasks(org_id,sub_account_id,assigned_to,title,description,due_date,priority,contact_id,status)
   VALUES(r.org_id,r.sub_account_id,auth.uid(),'Follow up: '||r.broadcast_name,'Broadcast: /broadcasts/'||r.broadcast_id,p_due,'medium',r.contact_id,'pending') RETURNING id INTO t;
   UPDATE public.broadcast_recipients SET follow_up_task_id=t WHERE id=r.id;
   n:=n+1;
  END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.create_broadcast_followups(uuid,uuid[],date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_broadcast_followups(uuid,uuid[],date) TO authenticated;
