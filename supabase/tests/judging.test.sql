-- Judging tests. Run after the migrations and seed, in a disposable
-- database or a rolled-back transaction:
--   psql "$DATABASE_URL" -f supabase/tests/judging.test.sql
-- Ends with ALL JUDGING TESTS PASSED.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'judge1@example.test', '{"full_name":"Judge One"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'judge2@example.test', '{"full_name":"Judge Two"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'oral@example.test', '{"full_name":"Oral Presenter"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'poster@example.test', '{"full_name":"Poster Presenter"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'delegate@example.test', '{"full_name":"Plain Delegate"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'exec@example.test', '{"full_name":"Exec Member"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'support@example.test', '{"full_name":"Support Member"}');
update public.profiles set account_status = 'approved', account_type = 'judge' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set account_status = 'approved', account_type = 'oral_presenter' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set account_status = 'approved', account_type = 'poster_presenter' where id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles set account_status = 'approved', account_type = 'delegate' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set account_status = 'approved', account_type = 'executive_committee' where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set account_status = 'approved', account_type = 'supporting_committee' where id = '00000000-0000-0000-0000-0000000000d2';

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  if uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.scores(k text, val int) returns jsonb language sql as $$
  select jsonb_object_agg(id::text, val) from public.judging_criteria where kind = k and edition_id = public.current_edition_id()
$$;
create or replace function pg_temp.raises(stmt text, code text) returns boolean language plpgsql as $$
begin execute stmt; return false;
exception when others then
  if sqlerrm like '%' || code || '%' then return true; end if;
  raise notice 'unexpected error: %', sqlerrm; return false;
end $$;

-- Defaults
select pg_temp.expect((select count(*) from public.judging_criteria where edition_id = public.current_edition_id()) = 10, 'starting criteria: five for talks and five for posters');
select pg_temp.expect((select allowed from public.access_rules where account_type = 'judge' and capability = 'judge_presentations'), 'judges can judge by default');
select pg_temp.expect(not (select allowed from public.access_rules where account_type = 'judge' and capability = 'review_submissions'), 'judges have no committee permission');
select pg_temp.expect((select allowed from public.access_rules where account_type = 'executive_committee' and capability = 'manage_judging'), 'executive committee manages judging by default');
select pg_temp.expect(not (select allowed from public.access_rules where account_type = 'supporting_committee' and capability = 'manage_judging'), 'supporting committee does not see marks by default');

-- A judge
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select count(*) from public.judging_board()) = 2, 'judge sees one talk and one poster');
select pg_temp.expect((select count(*) from public.judging_board() where marks_in = 0 and my_status is null) = 2, 'nothing marked yet');
select pg_temp.expect((public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', '{}'::jsonb, '', '', '', false)) ->> 'status' = 'draft', 'empty draft saves');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', '{}'::jsonb, 'Good', 'More', '', true)$$, 'INCOMPLETE_SCORES'), 'submitting needs every score');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', pg_temp.scores('oral', 8), 'Good', '', '', true)$$, 'INCOMPLETE_FEEDBACK'), 'submitting needs both pieces of feedback');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', pg_temp.scores('oral', 11), '', '', '', false)$$, 'BAD_SCORE'), 'scores above the maximum are refused');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', pg_temp.scores('oral', -1), '', '', '', false)$$, 'BAD_SCORE'), 'negative scores are refused');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'poster', '{}'::jsonb, '', '', '', false)$$, 'NOT_PRESENTER'), 'cannot mark a talk as a poster');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000c1', 'oral', '{}'::jsonb, '', '', '', false)$$, 'NOT_PRESENTER'), 'cannot mark a delegate');
select pg_temp.expect((public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', pg_temp.scores('oral', 8), 'Clear aims', 'Slow down', 'Strong candidate', true)) ->> 'total' = '40', 'submitted mark totals 40 of 50');
select pg_temp.expect((public.save_judging_mark('00000000-0000-0000-0000-0000000000b1', 'oral', pg_temp.scores('oral', 9), 'Clear aims', 'Slow down', '', false)) ->> 'status' = 'submitted', 'changing a submitted mark keeps it submitted');
select pg_temp.expect((select my_status from public.judging_board() where kind = 'oral') = 'submitted' and (select marks_in from public.judging_board() where kind = 'oral') = 1, 'board shows the judge''s progress');
do $$ begin
  insert into public.judging_marks (edition_id, judge_id, presenter_id, kind, status) values (public.current_edition_id(), auth.uid(), '00000000-0000-0000-0000-0000000000b2', 'poster', 'submitted');
  raise exception 'FAILED: judge wrote a mark directly';
exception when insufficient_privilege then raise notice 'ok - marks can only be saved through save_judging_mark'; end $$;
do $$ begin
  update public.judging_settings set released = true;
  if found then raise exception 'FAILED: judge released feedback'; end if;
  raise notice 'ok - judges cannot release feedback';
end $$;
reset role;
select set_config('t.code', card_code, false) from public.profiles where id = '00000000-0000-0000-0000-0000000000b2';
select set_config('t.delcode', card_code, false) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((public.judging_lookup(current_setting('t.code'))) ->> 'state' = 'ok' and (public.judging_lookup(upper(current_setting('t.code')))) -> 'kinds' = '["poster"]'::jsonb, 'scanning a poster presenter''s card finds them');
select pg_temp.expect((public.judging_lookup(current_setting('t.delcode'))) ->> 'state' = 'not_presenter', 'scanning a delegate says they are not presenting');
select pg_temp.expect((public.judging_lookup('zzzzzzzzzzzzzzzz')) ->> 'state' = 'unknown', 'an unknown code is unknown');

-- A second judge cannot see the first judge's marks
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect((select count(*) from public.judging_marks) = 0, 'judges only see their own marks');
select pg_temp.expect((select my_status from public.judging_board() where kind = 'oral') is null, 'another judge''s mark is not theirs');

-- Presenters and delegates
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from public.judging_marks) = 0, 'presenters cannot read marks');
select pg_temp.expect((public.my_judging_feedback()) ->> 'released' = 'false' and (public.my_judging_feedback()) -> 'items' is null, 'feedback hidden before release');
select pg_temp.expect(pg_temp.raises($$select * from public.judging_board()$$, 'NOT_ALLOWED'), 'presenters cannot open the judging list');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b2', 'poster', '{}'::jsonb, '', '', '', false)$$, 'NOT_ALLOWED'), 'presenters cannot mark');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect((select count(*) from public.judging_marks) = 0, 'supporting committee cannot read marks by default');

-- The committee
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect((select count(*) from public.judging_marks) = 1, 'executive committee sees every mark');
select pg_temp.expect((select count(*) from public.judging_judges()) = 2, 'committee sees both judges');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b2', 'poster', '{}'::jsonb, '', '', '', false)$$, 'NOT_ALLOWED'), 'managing judging is not judging');
update public.judging_settings set open = false where edition_id = public.current_edition_id();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect(pg_temp.raises($$select public.save_judging_mark('00000000-0000-0000-0000-0000000000b2', 'poster', '{}'::jsonb, '', '', '', false)$$, 'JUDGING_CLOSED'), 'no marking once judging closes');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
update public.judging_settings set released = true, release_names = false, release_scores = true, released_at = now() where edition_id = public.current_edition_id();

-- After release
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((public.my_judging_feedback()) ->> 'released' = 'true', 'feedback released');
select pg_temp.expect(jsonb_array_length((public.my_judging_feedback()) -> 'items') = 1, 'presenter sees their one piece of feedback');
select pg_temp.expect((public.my_judging_feedback()) -> 'items' -> 0 ->> 'judge' is null, 'judge name hidden when not released');
select pg_temp.expect((public.my_judging_feedback()) -> 'items' -> 0 ->> 'total' = '45', 'marks shown when released');
select pg_temp.expect(((public.my_judging_feedback()) -> 'items' -> 0) ? 'committee_note' = false, 'the committee note never reaches the presenter');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect(jsonb_array_length((public.my_judging_feedback()) -> 'items') = 0, 'other presenters see none of it');

reset role;
rollback;
\echo ALL JUDGING TESTS PASSED
