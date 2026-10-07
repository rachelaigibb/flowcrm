// Isolated real PostgreSQL engine (PGlite); never connects to production or sends mail.
// PGLITE_MODULE=/tmp/flowcrm-db-verify/node_modules/@electric-sql/pglite/dist/index.js node tests/features/intake/followup-db.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const org='00000000-0000-0000-0000-000000000001', workspace='00000000-0000-0000-0000-000000000002', other='00000000-0000-0000-0000-000000000003', owner='00000000-0000-0000-0000-000000000004'
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE TABLE organizations(id uuid PRIMARY KEY);
 CREATE TABLE sub_accounts(id uuid PRIMARY KEY,org_id uuid,name text,settings jsonb);
 CREATE TABLE memberships(org_id uuid,user_id uuid,role text);
 CREATE TABLE sub_account_memberships(sub_account_id uuid,user_id uuid);
 CREATE TABLE contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,sub_account_id uuid,first_name text,last_name text,email text,phone text,source text,tags text[],metadata jsonb,consent_status text,consent_date timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,sub_account_id uuid,contact_id uuid,assigned_to uuid,title text,description text,due_date timestamptz,priority text,status text);
 CREATE TABLE activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,sub_account_id uuid,contact_id uuid,type text,content text,metadata jsonb);
 CREATE TABLE intake_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid,sub_account_id uuid,label text,key_hash text,revoked_at timestamptz,last_used_at timestamptz);
 CREATE TABLE automations(id uuid DEFAULT gen_random_uuid(),org_id uuid,sub_account_id uuid,enabled boolean,trigger_type text);
 CREATE TABLE automation_runs(org_id uuid,sub_account_id uuid,automation_id uuid,contact_id uuid,status text,current_step integer,resume_at timestamptz,log jsonb);
 INSERT INTO organizations VALUES('${org}');
 INSERT INTO sub_accounts VALUES('${workspace}','${org}','Vancouver','{}'),('${other}','${org}','Other','{}');
 INSERT INTO memberships VALUES('${org}','${owner}','owner');
 INSERT INTO intake_keys(org_id,sub_account_id,label,key_hash) VALUES('${org}','${workspace}','rachelgibbrealtor.ca',encode(sha256(convert_to('synthetic-key-123456','UTF8')),'hex')),('${org}','${other}','other-site',encode(sha256(convert_to('other-key-123456789','UTF8')),'hex'));
 INSERT INTO automations(org_id,sub_account_id,enabled,trigger_type) VALUES('${org}','${workspace}',true,'contact_created');
`)
await db.exec(readFileSync(new URL('../../../supabase/migrations/20261007220056_website_inquiry_followups.sql',import.meta.url),'utf8'))
const rule={enabled:true,assigned_to:owner,key_labels:['rachelgibbrealtor.ca'],sources:['rachelgibbrealtor.ca:contact-form'],source_prefixes:['rachelgibbrealtor.ca:property-']}
const configure=async value=>db.query('UPDATE sub_accounts SET settings=$1 WHERE id=$2',[JSON.stringify({intake:{follow_up:value}}),workspace])
const event=(n,extra={})=>({submission_id:`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`,name:'Fixture Person',email:'fixture@example.invalid',message:'New inquiry',source:'rachelgibbrealtor.ca:contact-form',tags:['contact-form','web-lead'],consent:true,...extra})
const submit=async(payload,key='synthetic-key-123456')=>{
 await db.exec('SET ROLE anon')
 try { return (await db.query('SELECT public.intake_contact($1,$2::jsonb) AS result',[key,JSON.stringify(payload)])).rows[0].result }
 finally { await db.exec('RESET ROLE') }
}
const count=async table=>Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n)
assert.equal(await count('tasks'),0,'migration makes no retrospective tasks')
await configure(rule)
const first=await submit(event(1));assert.ok(first.task_id);assert.equal(first.created,true)
assert.equal(await count('tasks'),1);assert.equal(await count('contacts'),1);assert.equal(await count('automation_runs'),0,'inquiries do not enroll in marketing automations')
const task=(await db.query('SELECT * FROM tasks')).rows[0]
assert.equal(task.assigned_to,owner);assert.equal(task.sub_account_id,workspace);assert.equal(task.contact_id,first.contact_id);assert.equal(task.status,'pending')
assert.equal((await db.query("SELECT (due_date AT TIME ZONE 'America/Vancouver')::time::text AS time FROM tasks")).rows[0].time,'17:00:00')
for(let n=0;n<3;n++){const replay=await submit(event(1));assert.equal(replay.task_id,first.task_id);assert.equal(replay.duplicate,true)}
assert.equal(await count('activities'),1);assert.equal(await count('tasks'),1)
assert.equal((await submit(event(1,{message:'Different payload'}))).error,'submission_conflict')
assert.equal((await submit(event(2,{submission_id:undefined}))).error,'submission_id_required')
assert.equal((await submit(event(2,{submission_id:'bad'}))).error,'invalid_submission_id')
assert.equal((await submit(event(2),'wrong-key-123456789')).error,'invalid_key')
assert.equal(await count('tasks'),1)
const second=await submit(event(2,{message:'Another genuine inquiry'}));assert.equal(second.contact_id,first.contact_id);assert.notEqual(second.task_id,first.task_id);assert.equal(second.created,false)
const property=await submit(event(3,{source:'rachelgibbrealtor.ca:property-test'}));assert.ok(property.task_id)
const excluded=await submit(event(4,{source:'rachelgibbrealtor.ca:deal-list'}));assert.equal(excluded.task_id,null)
const valuation=await submit(event(5,{source:'rachelgibbrealtor.ca:valuation-report'}));assert.equal(valuation.task_id,null)
const dubai=await submit(event(1),'other-key-123456789');assert.equal(dubai.task_id,null);assert.notEqual(dubai.contact_id,first.contact_id)
assert.equal(await count('tasks'),3)
await db.exec(`UPDATE tasks SET status='completed' WHERE id='${first.task_id}'`)
assert.equal((await submit(event(1))).task_id,first.task_id);assert.equal(await count('tasks'),3,'completed task is never recreated by replay')
await configure({...rule,assigned_to:'99999999-0000-0000-0000-000000000000'})
assert.equal((await submit(event(6))).error,'follow_up_assignment_invalid');assert.equal(await count('tasks'),3)
await configure(rule)
await db.exec(`CREATE FUNCTION reject_fixture_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title LIKE '%Rollback%' THEN RAISE EXCEPTION 'fixture task failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION reject_fixture_task();`)
const before={contacts:await count('contacts'),activities:await count('activities'),receipts:await count('intake_submission_receipts')}
await assert.rejects(submit(event(7,{name:'Rollback Fixture',email:'rollback@example.invalid'})),/fixture task failure/)
assert.deepEqual({contacts:await count('contacts'),activities:await count('activities'),receipts:await count('intake_submission_receipts')},before,'task failure rolls back whole intake')
await configure({...rule,enabled:false});assert.equal((await submit(event(8))).task_id,null)
await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM intake_submission_receipts'),/permission denied/);await db.exec('RESET ROLE; SET ROLE authenticated');await assert.rejects(db.exec("DELETE FROM intake_submission_receipts"),/permission denied/);await db.exec('RESET ROLE')
const dates=[['2026-10-09 09:00','2026-10-13 17:00'],['2026-10-10 12:00','2026-10-13 17:00'],['2026-10-12 09:00','2026-10-13 17:00'],['2026-04-02 14:00','2026-04-06 17:00'],['2026-02-13 22:00','2026-02-17 17:00'],['2026-05-15 10:00','2026-05-19 17:00'],['2026-06-30 10:00','2026-07-02 17:00'],['2026-07-31 10:00','2026-08-04 17:00'],['2026-09-04 10:00','2026-09-08 17:00'],['2026-09-29 10:00','2026-10-01 17:00'],['2026-11-10 10:00','2026-11-12 17:00'],['2026-12-24 10:00','2026-12-28 17:00'],['2026-12-31 23:59','2027-01-04 17:00'],['2026-10-07 09:00','2026-10-08 17:00'],['2026-10-07 23:59','2026-10-08 17:00']]
for(const [input,expected] of dates){const r=await db.query("SELECT to_char(public.next_vancouver_business_due($1::timestamp AT TIME ZONE 'America/Vancouver') AT TIME ZONE 'America/Vancouver','YYYY-MM-DD HH24:MI') AS due",[input]);assert.equal(r.rows[0].due,expected,input)}
// UTC boundary must be interpreted as the prior local day.
assert.equal((await db.query("SELECT to_char(public.next_vancouver_business_due('2026-10-10T03:00Z') AT TIME ZONE 'America/Vancouver','YYYY-MM-DD HH24:MI') AS due")).rows[0].due,'2026-10-13 17:00')
assert.deepEqual((await db.query('SELECT unnest(public.bc_statutory_holidays(2026))::text AS day')).rows.map(r=>r.day),['2026-01-01','2026-02-16','2026-04-03','2026-05-18','2026-07-01','2026-08-03','2026-09-07','2026-09-30','2026-10-12','2026-11-11','2026-12-25'])
await db.close()
console.log('PASS: atomic intake/task/receipt; replay/conflict/rollback; new and existing contacts; source/workspace/assignment isolation; no retrospective tasks or inquiry automation enrollment; private receipt permissions; all 11 BC 2026 holidays, Thanksgiving/weekends/year rollover and Vancouver boundary.')
