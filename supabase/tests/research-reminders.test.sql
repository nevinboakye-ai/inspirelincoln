-- Research reminder tests. Run against a fresh disposable database with every
-- migration applied. Ends by printing ALL RESEARCH REMINDER TESTS PASSED.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'una@x.test', '{"full_name":"Una Undecided"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'pia@x.test', '{"full_name":"Pia Participant"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'pen@x.test', '{"full_name":"Pen Pending"}');
update public.profiles set account_type = 'delegate', account_status = 'approved' where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
update public.profiles set account_type = 'delegate', account_status = 'pending' where id = '00000000-0000-0000-0000-0000000000e3';

create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- Off: nothing is sent.
set role service_role;
select pg_temp.expect((select count(*) from public.research_due_reminders()) = 0, 'nothing while the study is off');
reset role;

do $$ begin set local role authenticated; perform public.research_due_reminders(); raise exception 'FAILED: signed-in user ran reminders';
exception when insufficient_privilege then raise notice 'ok - only the server can run reminders'; end $$;

update public.research_study set enabled = true,
  pre_closes_at = now() + interval '5 days', post_opens_at = now() + interval '6 days', post_closes_at = now() + interval '7 days',
  followup_opens_at = now() + interval '8 days', followup_closes_at = now() + interval '9 days' where id = 1;

-- Pia takes part and agrees to reminders.
insert into public.research_enrolments (participant_code, user_id, decision, consent_version, consent_contact)
values ('IN-TEST22', '00000000-0000-0000-0000-0000000000e2', 'consented', '1.0', true);

set role service_role;
create temp table r1 as select * from public.research_due_reminders();
select pg_temp.expect((select count(*) from r1 where kind = 'invite') = 1 and (select email from r1 where kind = 'invite') = 'una@x.test', 'undecided person gets the invitation, pending account does not');
select pg_temp.expect((select count(*) from r1 where kind = 'pre') = 1 and (select email from r1 where kind = 'pre') = 'pia@x.test', 'participant who agreed gets the open-questionnaire reminder');
select pg_temp.expect((select count(*) from public.research_due_reminders()) = 0, 'nobody is emailed twice in a row');
reset role;

-- Two days later, both are due again.
update public.research_invite_nudges set last_sent_at = now() - interval '2 days 1 minute';
update public.research_enrolments set last_reminded = jsonb_build_object('pre', now() - interval '2 days 1 minute');
set role service_role;
select pg_temp.expect((select count(*) from public.research_due_reminders()) = 2, 'reminded again after two days');
reset role;
select pg_temp.expect((select sent from public.research_invite_nudges) = 2, 'invitation reminders are counted');

-- In the last day, the invitation reminder comes every 12 hours.
update public.research_study set pre_closes_at = now() + interval '20 hours' where id = 1;
update public.research_invite_nudges set last_sent_at = now() - interval '13 hours';
set role service_role;
select pg_temp.expect((select count(*) from public.research_due_reminders() where kind = 'invite') = 1, 'every 12 hours in the last day');
reset role;

-- Once Una answers, the invitation reminders stop.
insert into public.research_enrolments (participant_code, user_id, decision) values ('IN-TEST11', '00000000-0000-0000-0000-0000000000e1', 'declined');
update public.research_invite_nudges set last_sent_at = now() - interval '3 days';
set role service_role;
select pg_temp.expect((select count(*) from public.research_due_reminders() where kind = 'invite') = 0, 'no reminders after answering');
reset role;

select 'ALL RESEARCH REMINDER TESTS PASSED';
