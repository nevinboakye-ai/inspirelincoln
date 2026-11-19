-- Research study tests. Run against a disposable database with every migration applied
-- (see supabase/tests/README.md). Ends by printing ALL RESEARCH TESTS PASSED.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f0', 'owner@x.test', '{"full_name":"Site Owner"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'pres@x.test', '{"full_name":"President"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'dana@x.test', '{"full_name":"Dana Delegate"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'pat@x.test', '{"full_name":"Pat Poster"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'wes@x.test', '{"full_name":"Wes Waitlisted"}'),
  ('00000000-0000-0000-0000-0000000000f5', 'pen@x.test', '{"full_name":"Pen Pending"}'),
  ('00000000-0000-0000-0000-0000000000f6', 'cam@x.test', '{"full_name":"Cam Committee"}');
update public.profiles set role = 'admin', account_type = 'president', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000f0';
update public.profiles set account_type = 'president', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set account_type = 'delegate', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000f2';
update public.profiles set account_type = 'poster_presenter', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000f3';
update public.profiles set account_type = 'delegate', account_status = 'waitlisted' where id = '00000000-0000-0000-0000-0000000000f4';
update public.profiles set account_type = 'delegate', account_status = 'pending' where id = '00000000-0000-0000-0000-0000000000f5';
update public.profiles set account_type = 'academic_team', extra_types = '{poster_presenter}', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000f6';

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if; end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- 1. Off by default, and can't be switched on with windows out of order
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select pg_temp.expect(not (select enabled from public.research_study), 'study is off by default');
select pg_temp.expect(public.can_run_research(), 'site owner has the research permission');
do $$ begin update public.research_study set enabled = true, post_opens_at = pre_closes_at - interval '1 day' where id = 1; raise exception 'FAILED: switched on with windows out of order';
exception when check_violation then raise notice 'ok - cannot switch on with windows out of order'; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect(not public.can_run_research(), 'president does not have the research permission by default');
update public.research_study set lead_name = 'HACK' where id = 1;
select pg_temp.expect((select lead_name from public.research_study) is null, 'president cannot change study settings');
do $$ begin perform public.research_summary(); raise exception 'FAILED: president read summary';
exception when insufficient_privilege then raise notice 'ok - president cannot see the summary'; end $$;

-- Delegates can't decide while the study is off
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin perform public.research_decide('consented', '1.0', true, false, false); raise exception 'FAILED: consent while off';
exception when sqlstate 'P0001' then raise notice 'ok - no consent while off: %', sqlerrm; end $$;

-- 2. The owner switches on with no ethics details recorded (windows moved so the first questionnaire is open now)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
update public.research_study set
  pre_closes_at = now() + interval '1 day', post_opens_at = now() + interval '2 days', post_closes_at = now() + interval '3 days',
  followup_opens_at = now() + interval '4 days', followup_closes_at = now() + interval '5 days' where id = 1;
update public.research_study set enabled = true where id = 1;
select pg_temp.expect((select enabled from public.research_study), 'owner switches the study on without ethics details');

-- 3. Eligibility
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
select pg_temp.expect((public.research_my_status() ->> 'eligible')::boolean, 'committee member is invited too');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
select pg_temp.expect(not (public.research_my_status() ->> 'eligible')::boolean, 'pending account is not invited');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select pg_temp.expect((public.research_my_status() ->> 'eligible')::boolean, 'waitlisted delegate is invited');

-- 4. Declining, then changing to yes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect(public.research_decide('declined') is null, 'poster presenter declines');
select pg_temp.expect(public.research_my_status() ->> 'decision' = 'declined', 'decline recorded');
select pg_temp.expect(public.research_my_status() ->> 'code' is null, 'no code shown after declining');
select pg_temp.expect(public.research_decide('consented', '1.0', false, false, false) like 'IN-%', 'poster presenter changes their mind and consents');

-- 5. Consent and the first questionnaire
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select set_config('t.code', public.research_decide('consented', '1.0', true, true, false), false);
select pg_temp.expect(current_setting('t.code') ~ '^IN-[A-Z2-9]{6}$', 'consent returns a study code');
select pg_temp.expect(public.research_decide('consented', '1.0', true, true, false) = current_setting('t.code'), 'consenting twice keeps the same code');
do $$ begin perform count(*) from public.research_enrolments; raise exception 'FAILED: read enrolments';
exception when insufficient_privilege then raise notice 'ok - no direct read of enrolments'; end $$;
do $$ begin perform count(*) from public.research_responses; raise exception 'FAILED: read responses';
exception when insufficient_privilege then raise notice 'ok - no direct read of responses'; end $$;
do $$ begin insert into public.research_responses (participant_code, stage, answers, instrument_version) values (current_setting('t.code'), 'pre', '{}', '1'); raise exception 'FAILED: direct insert';
exception when insufficient_privilege then raise notice 'ok - no direct insert of answers'; end $$;
do $$ begin perform public.research_submit('post', '{"a":"1"}', '1.0'); raise exception 'FAILED: post before open';
exception when sqlstate 'P0001' then raise notice 'ok - post questionnaire not open yet'; end $$;
select public.research_submit('pre', '{"se_01":"3"}', '1.0', now() - interval '5 minutes');
select pg_temp.expect(public.research_my_status() -> 'done' = '["pre"]'::jsonb, 'first questionnaire recorded');
do $$ begin perform public.research_submit('pre', '{"se_01":"9"}', '1.0'); raise exception 'FAILED: duplicate';
exception when sqlstate 'P0001' then raise notice 'ok - duplicate refused: %', sqlerrm; end $$;

-- 6. Someone not taking part can't submit
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
do $$ begin perform public.research_submit('pre', '{"se_01":"3"}', '1.0'); raise exception 'FAILED: submit without consent';
exception when sqlstate 'P0001' then raise notice 'ok - no answers without consent'; end $$;

-- 7. The research team sees counts and a de-identified export; the president does not
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select pg_temp.expect((public.research_summary() ->> 'consented')::int = 2 and (public.research_summary() ->> 'pre')::int = 1, 'summary counts');
select pg_temp.expect((select count(*) from public.research_export()) = 2, 'export has a row per participant (and per questionnaire)');
select pg_temp.expect((select bool_and(participant_code like 'IN-%') from public.research_export()), 'export carries study codes');
select pg_temp.expect((select count(*) from public.audit_events where entity = 'research_responses' and action = 'export') >= 1, 'export is logged');
select pg_temp.expect((select count(*) from public.research_invite_list()) = 4, 'everyone approved or waitlisted who has not decided is on the invite list (two presidents, the committee member, the waitlisted delegate)');
select pg_temp.expect((select count(*) from public.research_reminder_list('pre')) = 0, 'Pat did not agree to reminders and Dana has done it');
-- Give the president the permission for one person, then check it works
reset role;
insert into public.access_overrides (user_id, capability, allowed) values ('00000000-0000-0000-0000-0000000000f1', 'research_data', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect(public.can_run_research(), 'research permission can be given to one person');
reset role;
delete from public.access_overrides where user_id = '00000000-0000-0000-0000-0000000000f1';

-- 8. Withdrawal with deletion
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select public.research_withdraw(true);
select pg_temp.expect(public.research_my_status() ->> 'withdrawal' = 'delete', 'withdrawal recorded');
do $$ begin perform public.research_decide('consented', '1.0', true, true, false); raise exception 'FAILED: rejoin';
exception when sqlstate 'P0001' then raise notice 'ok - cannot rejoin after withdrawing'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f0');
select pg_temp.expect((public.research_summary() ->> 'pre')::int = 0, 'withdrawn answers deleted');
select pg_temp.expect((select count(*) from public.research_export() where participant_code = current_setting('t.code')) = 0, 'deleted participant not exported');

-- 9. Anonymising is refused before the last questionnaire closes
do $$ begin perform public.research_anonymise(); raise exception 'FAILED: anonymised early';
exception when sqlstate 'P0001' then raise notice 'ok - cannot anonymise while collecting'; end $$;
reset role;

select 'ALL RESEARCH TESTS PASSED';
