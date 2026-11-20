-- Oral presentation rooms tests. Run after the migrations and seed, in a
-- disposable database or a rolled-back transaction:
--   psql "$DATABASE_URL" -f supabase/tests/oral-rooms.test.sql
-- Ends with ALL ORAL ROOM TESTS PASSED.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e0a1', 'oral1@example.test', '{"full_name":"Oral One"}'),
  ('00000000-0000-0000-0000-00000000e0a2', 'oral2@example.test', '{"full_name":"Oral Two"}'),
  ('00000000-0000-0000-0000-00000000e0a3', 'Oral3@Example.test', '{"full_name":"Oral Three"}'),
  ('00000000-0000-0000-0000-00000000e0c1', 'plain@example.test', '{"full_name":"Plain Delegate"}'),
  ('00000000-0000-0000-0000-00000000e0d1', 'execo@example.test', '{"full_name":"Exec Member"}');
update public.profiles set account_status = 'approved', account_type = 'oral_presenter'
 where id in ('00000000-0000-0000-0000-00000000e0a1', '00000000-0000-0000-0000-00000000e0a2', '00000000-0000-0000-0000-00000000e0a3');
update public.profiles set account_status = 'approved', account_type = 'delegate' where id = '00000000-0000-0000-0000-00000000e0c1';
update public.profiles set account_status = 'approved', account_type = 'executive_committee' where id = '00000000-0000-0000-0000-00000000e0d1';
insert into public.delegate_roster (email, full_name, account_type) values ('listonly@example.test', 'List Only', 'oral_presenter') on conflict do nothing;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  if uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.raises(stmt text, code text) returns boolean language plpgsql as $$
begin execute stmt; return false;
exception when others then
  if sqlerrm like '%' || code || '%' then return true; end if;
  raise notice 'unexpected error: %', sqlerrm; return false;
end $$;
create or replace function pg_temp.room(slug_part text) returns text language sql as $$
  select id::text from public.sessions where id in (select public.oral_sessions()) and slug like '%' || slug_part || '%' limit 1
$$;

select pg_temp.expect((select count(*) from public.oral_sessions()) = 2, 'two oral presentation sessions found');
select pg_temp.expect((select capacity from public.oral_rooms where session_id = pg_temp.room('inb')::uuid) = 5, 'Isaac Newton Building takes five talks');
select pg_temp.expect((select capacity from public.oral_rooms where session_id = pg_temp.room('lms')::uuid) = 4, 'LMS0005 takes four talks');
select pg_temp.expect((select allowed from public.access_rules where account_type = 'executive_committee' and capability = 'allocate_orals'), 'executive committee can allocate oral rooms');
select pg_temp.expect(not (select allowed from public.access_rules where account_type = 'delegate' and capability = 'allocate_orals'), 'delegates cannot');

-- A delegate can't see or change anything.
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1');
select pg_temp.expect((select count(*) from public.oral_presenter_people()) = 0, 'a delegate sees no presenters');
select pg_temp.expect(pg_temp.raises($$select public.oral_allocation_save(null, '[]'::jsonb)$$, 'NOT_ALLOWED'), 'a delegate cannot save the board');
select pg_temp.expect(pg_temp.raises($$select public.oral_settings_save(true)$$, 'NOT_ALLOWED'), 'a delegate cannot publish');
select pg_temp.expect(pg_temp.raises($$insert into public.oral_allocations (edition_id, email) values (public.current_edition_id(), 'x@y.z')$$, 'permission denied'), 'nobody writes to the table directly');
reset role;

-- The committee member sees everyone, with or without an account.
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select pg_temp.expect((select count(*) from public.oral_presenter_people() where email in ('oral1@example.test', 'oral2@example.test', 'oral3@example.test', 'listonly@example.test')) = 4, 'three accounts and one on the selected list');
select pg_temp.expect(exists (select 1 from public.oral_presenter_people() where email = 'oral3@example.test'), 'emails are lowercased');
select pg_temp.expect(pg_temp.raises($$select public.oral_settings_save(true)$$, 'NOTHING_TO_PUBLISH'), 'cannot publish an empty board');

select pg_temp.expect(public.oral_allocation_save(0, jsonb_build_array(
  jsonb_build_object('email', 'oral1@example.test', 'session_id', pg_temp.room('inb'), 'position', 2, 'locked', true),
  jsonb_build_object('email', 'ORAL2@example.test', 'session_id', pg_temp.room('inb'), 'position', 1, 'locked', false),
  jsonb_build_object('email', 'oral3@example.test', 'session_id', pg_temp.room('lms'), 'position', 7, 'locked', false),
  jsonb_build_object('email', 'listonly@example.test', 'session_id', '', 'position', 0, 'locked', true)
)) = 1, 'saving the board returns version 1');
select pg_temp.expect((select position from public.oral_allocations where email = 'oral3@example.test') = 1, 'positions are renumbered from 1 in each room');
select pg_temp.expect((select position from public.oral_allocations where email = 'oral1@example.test') = 2, 'running order kept');
select pg_temp.expect((select session_id is null and locked from public.oral_allocations where email = 'listonly@example.test'), 'someone can be locked out of the rooms');
select pg_temp.expect(pg_temp.raises($$select public.oral_allocation_save(0, '[]'::jsonb)$$, 'STALE'), 'an out-of-date board is refused');
select pg_temp.expect(pg_temp.raises(format($$select public.oral_allocation_save(1, '[{"email":"a@b.c","session_id":"%s"}]'::jsonb)$$, (select id from public.sessions where slug = 'lunch-and-posters')), 'BAD_SESSION'), 'only oral sessions are rooms');
select pg_temp.expect(not exists (select 1 from public.programme_assignments where session_id in (select public.oral_sessions())), 'nothing in anyone''s day before the rooms are shown');
reset role;

-- A presenter can't see their room until it's shown.
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a3');
select pg_temp.expect(public.my_oral_talk() is null, 'hidden until shown');
select pg_temp.expect((select count(*) from public.oral_allocations) = 0, 'presenters cannot read the board');
reset role;

-- A manual placement from before (the other room) is replaced.
insert into public.programme_assignments (edition_id, user_id, session_id, role)
values (public.current_edition_id(), '00000000-0000-0000-0000-00000000e0a3', pg_temp.room('inb')::uuid, 'presenting');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_settings_save(true);
reset role;
select pg_temp.expect((select note from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a1' and role = 'presenting') = 'Talk 2 of 2', 'presenter placed in their room, with their talk number');
select pg_temp.expect((select count(*) from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a3') = 1, 'one room each: the old placement is gone');
select pg_temp.expect((select session_id::text from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a3') = pg_temp.room('lms'), 'in the room on the board');
select pg_temp.expect((select label from public.judging_entries where presenter_id = '00000000-0000-0000-0000-00000000e0a3' and kind = 'oral') = 'LMS0005, talk 1', 'judges see the room and talk number');
select pg_temp.expect((select label from public.judging_entries where presenter_id = '00000000-0000-0000-0000-00000000e0a2' and kind = 'oral') = 'Isaac Newton Building, talk 1', '"room to be confirmed" left off');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a3');
select pg_temp.expect((public.my_oral_talk()->>'position')::int = 1 and (public.my_oral_talk()->>'of')::int = 1, 'presenter sees their talk once shown');
select pg_temp.expect(public.my_oral_talk()->>'session_id' = pg_temp.room('lms'), 'and their room');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1');
select pg_temp.expect(public.my_oral_talk() is null, 'a delegate has no talk');
reset role;

-- A judge's own label is kept; a move updates everything else straight away.
update public.judging_entries set label = 'Ask at the desk' where presenter_id = '00000000-0000-0000-0000-00000000e0a2' and kind = 'oral';
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select pg_temp.expect(public.oral_allocation_save(1, jsonb_build_array(
  jsonb_build_object('email', 'oral1@example.test', 'session_id', pg_temp.room('lms'), 'position', 1, 'locked', true),
  jsonb_build_object('email', 'oral2@example.test', 'session_id', pg_temp.room('lms'), 'position', 2, 'locked', false),
  jsonb_build_object('email', 'oral3@example.test', 'session_id', null, 'position', 0, 'locked', true)
)) = 2, 'second save');
reset role;
select pg_temp.expect((select session_id::text from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a1' and role = 'presenting') = pg_temp.room('lms'), 'moved presenter moved in their day');
select pg_temp.expect((select count(*) from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a1') = 1, 'and only in one room');
select pg_temp.expect(not exists (select 1 from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0a3' and session_id in (select public.oral_sessions())), 'taken out of the rooms: out of their day');
select pg_temp.expect((select label from public.judging_entries where presenter_id = '00000000-0000-0000-0000-00000000e0a2' and kind = 'oral') = 'Ask at the desk', 'a label the committee wrote is kept');
select pg_temp.expect((select label from public.judging_entries where presenter_id = '00000000-0000-0000-0000-00000000e0a1' and kind = 'oral') = 'LMS0005, talk 1', 'judges'' label follows the move');

-- Hiding the rooms takes them out of everyone's day.
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_settings_save(false);
reset role;
select pg_temp.expect(not exists (select 1 from public.programme_assignments where role = 'presenting' and session_id in (select public.oral_sessions())), 'hidden again: out of every day');

-- Room sizes.
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_rooms_save(jsonb_build_array(jsonb_build_object('session_id', pg_temp.room('lms'), 'capacity', '')));
reset role;
select pg_temp.expect((select capacity from public.oral_rooms where session_id = pg_temp.room('lms')::uuid) is null, 'number of talks can be cleared');


-- The audience ----------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e0c2', 'plain2@example.test', '{"full_name":"Plain Two"}'),
  ('00000000-0000-0000-0000-00000000e0e1', 'judgeo@example.test', '{"full_name":"Judge O"}');
update public.profiles set account_status = 'approved', account_type = 'poster_presenter' where id = '00000000-0000-0000-0000-00000000e0c2';
update public.profiles set account_status = 'approved', account_type = 'judge' where id = '00000000-0000-0000-0000-00000000e0e1';

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1');
select pg_temp.expect((select count(*) from public.oral_audience_people()) = 0, 'a delegate sees no audience list');
select pg_temp.expect(pg_temp.raises($$select public.oral_audience_set('plain@example.test', null, true)$$, 'NOT_ALLOWED'), 'a delegate cannot move anyone');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select pg_temp.expect((select grp from public.oral_audience_people() where email = 'plain@example.test') = 'delegate', 'delegates are grouped');
select pg_temp.expect((select grp from public.oral_audience_people() where email = 'plain2@example.test') = 'poster', 'poster presenters are grouped');
select pg_temp.expect((select grp from public.oral_audience_people() where email = 'judgeo@example.test') = 'judge', 'judges are grouped');
select pg_temp.expect((select grp from public.oral_audience_people() where email = 'execo@example.test') = 'committee', 'committee is grouped');
select pg_temp.expect(not exists (select 1 from public.oral_audience_people() where email = 'oral1@example.test'), 'oral presenters are not in the audience');
select pg_temp.expect(pg_temp.raises($$select public.oral_audience_publish(true)$$, 'NOTHING_TO_PUBLISH'), 'cannot show an empty audience');
select pg_temp.expect(public.oral_audience_save(0, jsonb_build_array(
  jsonb_build_object('email', 'plain@example.test', 'session_id', pg_temp.room('lms'), 'locked', false),
  jsonb_build_object('email', 'plain2@example.test', 'session_id', pg_temp.room('inb'), 'locked', false),
  jsonb_build_object('email', 'judgeo@example.test', 'session_id', pg_temp.room('inb'), 'locked', false)
)) = 1, 'audience saved');
select pg_temp.expect(pg_temp.raises($$select public.oral_audience_save(0, '[]'::jsonb)$$, 'STALE'), 'an out-of-date audience is refused');
reset role;

-- The judge was placed by hand on the On the day page: that wins.
insert into public.programme_assignments (edition_id, user_id, session_id, role)
values (public.current_edition_id(), '00000000-0000-0000-0000-00000000e0e1', pg_temp.room('lms')::uuid, 'judging');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1');
select pg_temp.expect(public.my_oral_room() is null, 'room hidden until shown');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_audience_publish(true);
reset role;
select pg_temp.expect((select session_id::text from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0c1' and role = 'attending') = pg_temp.room('lms'), 'delegate placed in their room for the day');
select pg_temp.expect((select count(*) from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0e1') = 1, 'a hand-made place (the judge) is kept and not doubled');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1');
select pg_temp.expect(public.my_oral_room()->>'session_id' = pg_temp.room('lms'), 'delegate sees their room');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_audience_set('PLAIN@example.test', pg_temp.room('inb')::uuid, true);
reset role;
select pg_temp.expect((select locked from public.oral_audience where email = 'plain@example.test'), 'moved by hand is locked');
select pg_temp.expect((select session_id::text from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0c1' and role = 'attending') = pg_temp.room('inb'), 'their day follows the move');
select pg_temp.expect((select count(*) from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0c1') = 1, 'and they''re in one room only');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_audience_set('plain@example.test', null, true);
reset role;
select pg_temp.expect(not exists (select 1 from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0c1'), 'out of the rooms: out of their day');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1');
select public.oral_audience_publish(false);
select public.oral_rooms_save(jsonb_build_array(jsonb_build_object('session_id', pg_temp.room('inb'), 'capacity', 5, 'seats', 120)));
select public.oral_rooms_save(jsonb_build_array(jsonb_build_object('session_id', pg_temp.room('inb'), 'capacity', 5)));
reset role;
select pg_temp.expect(not exists (select 1 from public.programme_assignments where note = 'Your room for all the oral presentations'), 'hidden again: out of every day');
select pg_temp.expect(exists (select 1 from public.programme_assignments where user_id = '00000000-0000-0000-0000-00000000e0e1' and role = 'judging'), 'the judge''s own place is never touched');
select pg_temp.expect((select seats from public.oral_rooms where session_id = pg_temp.room('inb')::uuid) = 120, 'seats saved, and kept when not sent');

select 'ALL ORAL ROOM TESTS PASSED';
rollback;
