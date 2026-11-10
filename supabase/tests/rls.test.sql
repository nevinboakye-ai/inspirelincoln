-- Row level security tests. Run against a disposable database that has the
-- migration and seed applied (see supabase/tests/README.md). Each check raises
-- an exception on failure; the script ends by printing ALL RLS TESTS PASSED.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'reviewer@example.test', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'alice@example.test', '{"full_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000d', 'bob@example.test', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'reviewer2@example.test', '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'reviewer' where id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e');
update public.editions set abstract_config = abstract_config || '{"submissionsOpen": true}';

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

select set_config('t.published_sessions', (select count(*) from public.sessions where published)::text, false);
insert into public.map_places (slug, name, kind, published) values ('rls-hidden-place', 'Hidden place', 'building', false);

-- 1. Anonymous visitors
select pg_temp.as_user(null);
select pg_temp.expect((select count(*) from public.sessions) = current_setting('t.published_sessions')::int and current_setting('t.published_sessions')::int > 0, 'anon reads published sessions');
select pg_temp.expect((select count(*) from public.map_places) > 0, 'anon reads published map places');
select pg_temp.expect((select count(*) from public.map_places where slug = 'rls-hidden-place') = 0, 'anon cannot see unpublished map places');
do $$ begin
  insert into public.map_places (slug, name) values ('rls-anon-place', 'Anon place');
  raise exception 'FAILED: anon added a map place';
exception when insufficient_privilege then raise notice 'ok - anon cannot add map places'; end $$;
select pg_temp.expect((select count(*) from public.contact_enquiries) = 0, 'anon cannot read enquiries');
insert into public.contact_enquiries (name, email, category, subject, message, consent) values ('Test Person', 'x@example.test', 'general', 'Hello there', 'This is a sufficiently long message.', true);
select pg_temp.expect((select count(*) from public.profiles) = 0, 'anon cannot read profiles');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'anon cannot read abstracts');
do $$ begin
  insert into public.contact_enquiries (name, email, category, subject, message, consent) values ('T', 'x@example.test', 'general', 'Hi', 'short', true);
  raise exception 'FAILED: invalid enquiry accepted';
exception when check_violation then raise notice 'ok - invalid enquiry rejected by constraints'; end $$;
do $$ begin
  for i in 1..5 loop
    insert into public.contact_enquiries (name, email, category, subject, message, consent) values ('Test Person', 'x@example.test', 'general', 'Hello there', 'This is a sufficiently long message.', true);
  end loop;
  raise exception 'FAILED: rate limit not applied';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - contact rate limit applies (%)', sqlerrm;
end $$;
reset role;

-- 2. Delegates cannot escalate
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'FAILED: role escalation allowed';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - delegate cannot change own role';
end $$;
update public.profiles set full_name = 'Alice A' where id = auth.uid();
select pg_temp.expect((select full_name from public.profiles where id = auth.uid()) = 'Alice A', 'delegate can update own profile');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'delegate sees only own profile');

-- 3. Abstract lifecycle
insert into public.abstracts (edition_id, submitter_id, presenting_author, email, university, programme_year, title, category, background, aim, methods, results, conclusion, consent_data, declaration_original, consent_showcase, status)
select id, auth.uid(), 'Alice A', 'alice@example.test', 'Lincoln', 'MBChB Year 3', 'A study of digital triage', 'Digital health and technology', 'b', 'a', 'm', 'r', 'c', true, true, true, 'draft' from public.editions where is_current;
update public.abstracts set title = 'A study of digital triage tools' where submitter_id = auth.uid();
update public.abstracts set status = 'submitted' where submitter_id = auth.uid();
select pg_temp.expect((select submitted_at is not null from public.abstracts where submitter_id = auth.uid()), 'submission timestamp set');
do $$ begin
  update public.abstracts set title = 'Changed after submission' where submitter_id = auth.uid();
  raise exception 'FAILED: edited after submission';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - submitted abstract is locked';
end $$;
do $$ begin
  update public.abstracts set status = 'accepted' where submitter_id = auth.uid();
  raise exception 'FAILED: author accepted own abstract';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - author cannot decide own abstract';
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'another delegate cannot read the abstract');
reset role;

-- 4. Reviewers
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'unassigned reviewer cannot read abstracts');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.review_assignments (abstract_id, reviewer_id, assigned_by) select id, '00000000-0000-0000-0000-00000000000b', auth.uid() from public.abstracts;
update public.abstracts set status = 'under_review';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect((select count(*) from public.abstracts) = 1, 'assigned reviewer reads assigned abstract');
select pg_temp.expect((select count(*) from public.review_criteria) = 4, 'reviewer reads rubric');
insert into public.reviews (assignment_id, scores, comments, status) select id, '{"x":4}', 'Good', 'draft' from public.review_assignments;
update public.reviews set status = 'submitted', recommendation = 'accept';
select pg_temp.expect((select submitted_at is not null from public.reviews), 'review submission timestamp set');
do $$ begin
  update public.reviews set comments = 'changed';
  raise exception 'FAILED: submitted review edited';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - submitted review is locked';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect((select count(*) from public.reviews) = 0, 'other reviewer cannot read the review');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'other reviewer cannot read the abstract');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from public.reviews) = 0, 'author cannot read reviews');
reset role;

-- 5. Decisions and showcase
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.abstracts set status = 'accepted', presentation_type = 'Poster presentation';
select pg_temp.expect((select decided_at is not null from public.abstracts), 'decision timestamp set');
update public.abstracts set showcase_published = true;
reset role;
select pg_temp.as_user(null);
select pg_temp.expect((select count(*) from public.showcase_abstracts) = 1, 'consented accepted abstract appears in showcase');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'anon still cannot read the abstracts table');
reset role;

-- 6. Posters: accepted author can upload record
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.poster_uploads (abstract_id, file_path, orientation, uploaded_by) select id, auth.uid() || '/poster.pdf', 'portrait', auth.uid() from public.abstracts;
select pg_temp.expect((select count(*) from public.poster_uploads) = 1, 'accepted author records poster upload');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into public.poster_uploads (abstract_id, file_path, uploaded_by) select id, auth.uid() || '/x.pdf', auth.uid() from public.abstracts;
  if (select count(*) from public.poster_uploads) > 0 then raise exception 'FAILED: other user saw/added poster'; end if;
  raise notice 'ok - other user cannot attach poster (no visible abstract)';
end $$;
reset role;

-- 7. Registrations and check-in
insert into public.registrations (edition_id, user_id, status) select id, '00000000-0000-0000-0000-00000000000c', 'confirmed' from public.editions where is_current;
insert into public.registrations (edition_id, user_id, status) select id, '00000000-0000-0000-0000-00000000000d', 'pending' from public.editions where is_current;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect((select count(*) from public.registrations) = 1, 'delegate sees only own registration');
do $$ begin
  perform public.check_in((select checkin_token from public.registrations limit 1));
  raise exception 'FAILED: delegate ran check-in';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - delegate cannot run check-in';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select not already_checked_in from public.check_in((select checkin_token from public.registrations where user_id = '00000000-0000-0000-0000-00000000000c'))), 'admin checks in confirmed delegate');
select pg_temp.expect((select already_checked_in from public.check_in((select checkin_token from public.registrations where user_id = '00000000-0000-0000-0000-00000000000c'))), 'second scan reports already checked in');
select pg_temp.expect((select checked_in_at is null from public.registrations where user_id = '00000000-0000-0000-0000-00000000000d'), 'pending registration is not checked in');
select pg_temp.expect((select count(*) from public.audit_events where entity = 'abstracts') >= 3, 'abstract changes are audited');
select pg_temp.expect((select count(*) from public.contact_enquiries) = 1, 'admin reads enquiries');
reset role;

-- 8. Agenda
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.agenda_items (user_id, session_id) select auth.uid(), id from public.sessions limit 2;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect((select count(*) from public.agenda_items) = 0, 'agendas are private');
do $$ begin
  insert into public.agenda_items (user_id, session_id) select '00000000-0000-0000-0000-00000000000c', id from public.sessions limit 1 offset 3;
  raise exception 'FAILED: wrote to another agenda';
exception when insufficient_privilege then raise notice 'ok - cannot write another user''s agenda'; end $$;
reset role;

-- 9. Editors
select set_config('request.jwt.claim.sub', '', false);
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.sessions set title = title || '' where slug = 'welcome-and-housekeeping';
update public.map_places set lat = 53.2277, lng = -0.5500 where slug = 'rls-hidden-place';
select pg_temp.expect((select lat from public.map_places where slug = 'rls-hidden-place') = 53.2277, 'editors can pin map places');
select pg_temp.expect((select count(*) from public.abstracts) = 0, 'editors cannot read abstracts');
select pg_temp.expect((select count(*) from public.contact_enquiries) = 0, 'editors cannot read enquiries');
reset role;

select 'ALL RLS TESTS PASSED' as result;
