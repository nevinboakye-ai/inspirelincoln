-- Judge messaging and parking tests. Run after the migrations and seed, in a
-- disposable database or a rolled-back transaction:
--   psql "$DATABASE_URL" -f supabase/tests/judge-messages.test.sql
-- Ends with ALL JUDGE MESSAGE TESTS PASSED.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'judge1@example.test', '{"full_name":"Judge One"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'delegate@example.test', '{"full_name":"Plain Delegate"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'support@example.test', '{"full_name":"Support Member"}');
update public.profiles set account_status = 'approved', account_type = 'judge' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set account_status = 'approved', account_type = 'delegate', network_listed = true, dm_open = true where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set account_status = 'approved', account_type = 'supporting_committee' where id = '00000000-0000-0000-0000-0000000000d2';
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect(public.is_judge_only(auth.uid()), 'judge is judge only');
select pg_temp.expect(public.dm_can_message('00000000-0000-0000-0000-0000000000d2') is null, 'judge can message committee');
select pg_temp.expect(public.dm_can_message('00000000-0000-0000-0000-0000000000c1') = 'committee_only', 'judge cannot message delegate');
select pg_temp.expect((select array_agg(id) from public.dm_contacts()) = array['00000000-0000-0000-0000-0000000000d2'::uuid], 'judge contacts are the committee');
select pg_temp.expect(public.dm_start('00000000-0000-0000-0000-0000000000d2') is not null, 'judge starts a chat with committee');
insert into public.delegate_travel (user_id, mode, car_registration) values (auth.uid(), 'car', 'AB12 CDE');
delete from public.delegate_travel where user_id = auth.uid();
reset role;
select pg_temp.expect(not exists (select 1 from public.delegate_travel where user_id = '00000000-0000-0000-0000-0000000000a1'), 'judge removed own registration');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect(public.dm_can_message('00000000-0000-0000-0000-0000000000a1') = 'closed', 'delegate cannot message judge');
select pg_temp.expect(not exists (select 1 from public.dm_contacts() where id = '00000000-0000-0000-0000-0000000000a1'), 'judge not in delegate contacts');
reset role;
rollback;
\echo ALL JUDGE MESSAGE TESTS PASSED
