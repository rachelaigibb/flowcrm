// Isolated PostgreSQL proof, no connection strings or production access.
// PGLITE_MODULE=/tmp/flowcrm-db-verify/node_modules/@electric-sql/pglite/dist/index.js node tests/features/broadcasts/engagement-db.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE FUNCTION public.get_user_sub_account_ids() RETURNS SETOF uuid LANGUAGE sql AS $$ SELECT current_setting('test.workspace')::uuid $$;
 CREATE TABLE public.broadcasts(id uuid PRIMARY KEY, org_id uuid, sub_account_id uuid, channel text);
 CREATE TABLE public.broadcast_recipients(id uuid PRIMARY KEY, broadcast_id uuid, org_id uuid, sub_account_id uuid, provider_id text, follow_up_status text);
 ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.broadcasts,public.broadcast_recipients TO authenticated;
 CREATE POLICY b ON public.broadcasts FOR SELECT TO authenticated USING(sub_account_id IN(SELECT public.get_user_sub_account_ids()));
 CREATE POLICY r ON public.broadcast_recipients FOR SELECT TO authenticated USING(sub_account_id IN(SELECT public.get_user_sub_account_ids()));
 INSERT INTO public.broadcasts VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','email'),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','email');
 INSERT INTO public.broadcast_recipients VALUES('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',NULL,'replied'),('00000000-0000-0000-0000-000000000222','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','other-provider','interested');
`)
await db.exec(readFileSync(new URL('../../../supabase/migrations/00022_resend_engagement.sql',import.meta.url),'utf8'))
await db.exec(`SET ROLE service_role;
 INSERT INTO public.email_delivery_events(event_id,provider_id,event_type,occurred_at,link) VALUES('early','provider','email.clicked','2026-10-05T12:00:00Z','https://example.com/a');
 INSERT INTO public.email_delivery_events(event_id,provider_id,event_type,occurred_at,link) VALUES('early','provider','email.clicked','2026-10-05T13:00:00Z','https://example.com/changed') ON CONFLICT(event_id) DO NOTHING;
 INSERT INTO public.email_delivery_events(event_id,provider_id,event_type,occurred_at) VALUES('other','other-provider','email.delivered',now());
 RESET ROLE; SET test.workspace='00000000-0000-0000-0000-000000000001'; SET ROLE authenticated;`)
assert.equal((await db.query('SELECT * FROM public.email_delivery_events')).rows.length,0,'early events remain invisible before provider ID is saved')
await db.exec(`RESET ROLE; UPDATE public.broadcast_recipients SET provider_id='provider' WHERE id='00000000-0000-0000-0000-000000000111'; SET ROLE authenticated;`)
const result=await db.query('SELECT event_id,link FROM public.email_delivery_events')
assert.deepEqual(result.rows,[{event_id:'early',link:'https://example.com/a'}],'late matching and immutable duplicate identity')
await assert.rejects(db.exec(`INSERT INTO public.email_delivery_events(event_id,provider_id,event_type,occurred_at) VALUES('fake','provider','email.delivered',now())`),/permission denied/)
await assert.rejects(db.exec(`UPDATE public.email_delivery_events SET link='https://example.com/changed'`),/permission denied/)
await db.exec(`SET test.workspace='00000000-0000-0000-0000-000000000002'`)
assert.deepEqual((await db.query('SELECT event_id FROM public.email_delivery_events')).rows,[{event_id:'other'}],'tenant isolation')
await db.exec('RESET ROLE; SET ROLE anon')
await assert.rejects(db.query('SELECT * FROM public.email_delivery_events'),/permission denied/)
await db.exec('RESET ROLE; SET ROLE service_role')
await assert.rejects(db.exec(`UPDATE public.email_delivery_events SET link='changed'`),/permission denied/)
await db.exec('RESET ROLE')
await assert.rejects(db.exec("UPDATE public.broadcast_recipients SET provider_id='provider' WHERE id='00000000-0000-0000-0000-000000000222'"),/duplicate key/)
assert.deepEqual((await db.query('SELECT follow_up_status FROM public.broadcast_recipients ORDER BY id')).rows,[{follow_up_status:'replied'},{follow_up_status:'interested'}])
await db.close()
console.log('PASS: migration syntax, early-event matching, duplicate immutability, tenant isolation, anon/client write denial, append-only service privileges, manual outcome preservation')
