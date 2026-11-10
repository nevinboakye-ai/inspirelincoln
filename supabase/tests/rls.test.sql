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

-- 10. Account types, review and committee access
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'pres@example.test', '{"full_name":"Pres","account_type":"president","privacy_ack":true,"policy_version":"test"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'exec@example.test', '{"full_name":"Exec","account_type":"executive_committee","committee_position":"Events"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'sup@example.test', '{"full_name":"Sup","account_type":"supporting_committee"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'poster@example.test', '{"full_name":"Poster","account_type":"poster_presenter"}'),
  ('00000000-0000-0000-0000-0000000000f5', 'oral@example.test', '{"full_name":"Oral","account_type":"oral_presenter"}'),
  ('00000000-0000-0000-0000-0000000000f6', 'wait@example.test', '{"full_name":"Wait","account_type":"delegate"}'),
  ('00000000-0000-0000-0000-0000000000f7', 'sneaky@example.test', '{"full_name":"Sneaky","account_type":"not_a_type"}');
select pg_temp.expect((select account_status from public.profiles where id = '00000000-0000-0000-0000-0000000000f1') = 'pending', 'new accounts start pending, even a president');
select pg_temp.expect((select account_type from public.profiles where id = '00000000-0000-0000-0000-0000000000f7') = 'delegate', 'unknown account types fall back to delegate');
select pg_temp.expect((select count(*) from public.consent_records where user_id = '00000000-0000-0000-0000-0000000000f1' and purpose = 'privacy_notice') = 1, 'privacy acknowledgement recorded at sign-up');

-- A pending president has no committee powers.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect(not public.is_committee(), 'pending president is not committee');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'pending president sees only own profile');
do $$ begin
  update public.profiles set account_status = 'approved' where id = auth.uid();
  raise exception 'FAILED: self-approved';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - cannot approve own account';
end $$;
do $$ begin
  perform public.review_account('00000000-0000-0000-0000-0000000000f2', 'approved');
  raise exception 'FAILED: pending account reviewed others';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - pending account cannot review others';
end $$;
reset role;

-- The site admin approves the president; the president approves the executive member.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.review_account('00000000-0000-0000-0000-0000000000f1', 'approved');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect(public.is_leadership(), 'approved president has leadership access');
select public.review_account('00000000-0000-0000-0000-0000000000f2', 'approved');
-- The site owner sits above the president.
do $$ begin
  update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-0000000000f3';
  raise exception 'FAILED: president changed a site role';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - president cannot change site roles';
end $$;
do $$ begin
  perform public.review_account('00000000-0000-0000-0000-00000000000a', 'declined');
  raise exception 'FAILED: president declined the site owner';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - president cannot change the site owner''s account';
end $$;
reset role;

-- Executive members review accounts but cannot approve other executives.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect(public.is_exec() and not public.is_leadership(), 'approved exec has exec but not leadership access');
select pg_temp.expect((select count(*) from public.profiles) >= 7, 'exec can read profiles to review them');
select public.review_account('00000000-0000-0000-0000-0000000000f3', 'approved');
select public.review_account('00000000-0000-0000-0000-0000000000f4', 'approved');
select public.review_account('00000000-0000-0000-0000-0000000000f5', 'approved');
select public.review_account('00000000-0000-0000-0000-0000000000f6', 'waitlisted');
do $$ begin
  perform public.review_account('00000000-0000-0000-0000-0000000000f6', 'approved', 'executive_committee');
  raise exception 'FAILED: exec appointed an exec';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - exec cannot appoint executive members';
end $$;
do $$ begin
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000f3';
  raise exception 'FAILED: exec changed site role';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - exec cannot change site roles';
end $$;
reset role;
select pg_temp.expect((select status from public.registrations where user_id = '00000000-0000-0000-0000-0000000000f6') = 'waitlisted', 'waitlisting also waitlists the registration');
select pg_temp.expect((select status from public.registrations where user_id = '00000000-0000-0000-0000-0000000000f4') = 'confirmed', 'approval confirms the registration');

-- Waitlist position is private.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
select pg_temp.expect(public.my_waitlist_position() = 1, 'waitlisted person sees own place in the queue');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'waitlisted person sees only own profile');
reset role;

-- 11. Submissions and feedback
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
insert into public.presentation_submissions (edition_id, user_id, kind, title, file_path, file_name, file_type, file_size, status)
  values ((select id from public.editions where is_current), auth.uid(), 'poster', 'My poster', '00000000-0000-0000-0000-0000000000f4/poster/a.pdf', 'a.pdf', 'application/pdf', 1000, 'approved');
select pg_temp.expect((select status from public.presentation_submissions where user_id = auth.uid()) = 'submitted', 'presenters cannot set their own status');
do $$ begin
  insert into public.presentation_submissions (edition_id, user_id, kind, title, file_path, file_name, file_type, file_size)
    values ((select id from public.editions where is_current), auth.uid(), 'slides', 'Wrong kind', '00000000-0000-0000-0000-0000000000f4/slides/a.pdf', 'a.pdf', 'application/pdf', 1000);
  raise exception 'FAILED: poster presenter submitted slides';
exception when insufficient_privilege then raise notice 'ok - poster presenter cannot submit slides'; end $$;
do $$ begin
  insert into public.presentation_submissions (edition_id, user_id, kind, title, file_path, file_name, file_type, file_size)
    values ((select id from public.editions where is_current), auth.uid(), 'poster', 'Other folder', '00000000-0000-0000-0000-0000000000f5/poster/a.pdf', 'a.pdf', 'application/pdf', 1000);
  raise exception 'FAILED: file path outside own folder accepted';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - submissions must point at your own folder';
end $$;
do $$ begin
  insert into public.submission_feedback (submission_id, decision, body) values ((select id from public.presentation_submissions limit 1), 'approved', 'self');
  raise exception 'FAILED: presenter reviewed own work';
exception when insufficient_privilege then raise notice 'ok - presenters cannot give feedback'; end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
select pg_temp.expect((select count(*) from public.presentation_submissions) = 0, 'presenters cannot see others'' submissions');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
do $$ begin
  insert into public.presentation_submissions (edition_id, user_id, kind, title, file_path, file_name, file_type, file_size)
    values ((select id from public.editions where is_current), auth.uid(), 'poster', 'Delegate', '00000000-0000-0000-0000-0000000000f6/poster/a.pdf', 'a.pdf', 'application/pdf', 1000);
  raise exception 'FAILED: delegate submitted';
exception when insufficient_privilege then raise notice 'ok - delegates cannot submit'; end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect((select count(*) from public.presentation_submissions) = 1, 'supporting committee sees submissions');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'supporting committee cannot read other profiles');
select pg_temp.expect((select presenter_name from public.presentation_submissions limit 1) = 'Poster', 'submission carries the presenter name');
insert into public.submission_feedback (submission_id, decision, body) values ((select id from public.presentation_submissions limit 1), 'changes_requested', 'Shorter methods please');
select pg_temp.expect((select author_name from public.submission_feedback limit 1) = 'Sup', 'feedback is stamped with the reviewer');
select pg_temp.expect((select status from public.presentation_submissions limit 1) = 'changes_requested', 'a decision updates the submission');
select pg_temp.expect(public.is_editor(), 'supporting committee can edit content');
select pg_temp.expect(not public.is_admin(), 'supporting committee has no personal data access');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select pg_temp.expect((select count(*) from public.submission_feedback) = 1, 'presenter reads feedback on own work');
reset role;

-- 12. Consents and special category data
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
do $$ begin
  update public.profiles set accessibility_needs = 'Wheelchair access' where id = auth.uid();
  raise exception 'FAILED: needs saved without consent';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - access needs need explicit consent';
end $$;
insert into public.consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'special_category', true, 'test');
update public.profiles set accessibility_needs = 'Wheelchair access' where id = auth.uid();
insert into public.consent_records (user_id, purpose, granted, policy_version) values (auth.uid(), 'special_category', false, 'test');
select pg_temp.expect((select accessibility_needs from public.profiles where id = auth.uid()) is null, 'withdrawing consent deletes access needs');
do $$ begin
  update public.consent_records set granted = true where user_id = auth.uid();
  if found then raise exception 'FAILED: consent history rewritten'; end if;
  raise notice 'ok - consent history cannot be changed';
end $$;
do $$ begin
  insert into public.consent_records (user_id, purpose, granted, policy_version, source) values (auth.uid(), 'marketing_email', true, 'test', 'signup');
  raise exception 'FAILED: forged a sign-up consent';
exception when insufficient_privilege then raise notice 'ok - cannot forge sign-up consents'; end $$;
reset role;

-- 13. Group email is for leadership only
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect((select count(*) from public.email_broadcasts) = 0, 'exec cannot read group email history');
do $$ begin
  insert into public.email_broadcasts (sent_by, subject, body, purpose, audience_types, audience_statuses) values (auth.uid(), 'Hello', 'A message body', 'service', '{delegate}', '{approved}');
  raise exception 'FAILED: exec logged a broadcast';
exception when insufficient_privilege then raise notice 'ok - exec cannot send group email'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into public.email_broadcasts (sent_by, subject, body, purpose, audience_types, audience_statuses) values (auth.uid(), 'Hello', 'A message body', 'service', '{delegate}', '{approved}');
select pg_temp.expect((select count(*) from public.email_broadcasts) = 1, 'president can send and see group email');
reset role;

-- 14. Self-service deletion
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f7');
select public.delete_my_account();
reset role;
select pg_temp.expect((select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000f7') = 0, 'people can delete their own account');
select pg_temp.expect((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000f7') = 0, 'deleting an account removes the profile');

-- 15. Access the site owner controls
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect(public.has_access('edit_website') and not public.has_access('send_email'), 'supporting committee gets its default access');
select pg_temp.expect(array_length(public.my_access(), 1) = 2, 'my_access lists exactly what someone can do');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
do $$ begin
  update public.access_rules set allowed = true where account_type = 'delegate' and capability = 'edit_website';
  if found then raise exception 'FAILED: president changed the access rules'; end if;
  raise notice 'ok - president cannot change the access rules';
end $$;
do $$ begin
  insert into public.access_overrides (user_id, capability, allowed) values (auth.uid(), 'edit_website', true);
  raise exception 'FAILED: president granted themselves access';
exception when insufficient_privilege then raise notice 'ok - president cannot grant individual access'; end $$;
select pg_temp.expect((select count(*) from public.access_overrides) = 0, 'president cannot see other people''s individual access');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.access_rules set allowed = true where account_type = 'poster_presenter' and capability = 'check_in';
insert into public.access_overrides (user_id, capability, allowed) values
  ('00000000-0000-0000-0000-0000000000f3', 'send_email', true),
  ('00000000-0000-0000-0000-0000000000f3', 'edit_website', false),
  ('00000000-0000-0000-0000-0000000000f6', 'edit_website', true);
select pg_temp.expect((select updated_by from public.access_overrides where user_id = '00000000-0000-0000-0000-0000000000f3' and capability = 'send_email') = '00000000-0000-0000-0000-00000000000a', 'changes record who made them');
reset role;
select pg_temp.expect((select count(*) from public.audit_events where entity = 'access_overrides') >= 3, 'access changes are in the audit log');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select pg_temp.expect(public.has_access('check_in') and not public.has_access('edit_website'), 'a rule change reaches everyone of that account type');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect(public.has_access('send_email'), 'an individual grant adds access');
select pg_temp.expect(not public.is_editor(), 'an individual block removes access, even from the default');
do $$ begin
  insert into public.faqs (question, answer) values ('Blocked?', 'Should not save');
  raise exception 'FAILED: blocked person edited the website';
exception when insufficient_privilege then raise notice 'ok - the database enforces a block'; end $$;
select pg_temp.expect((select count(*) from public.broadcast_recipients('{delegate}', '{approved,waitlisted}', false)) >= 1, 'a granted sender can reach recipients');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
select pg_temp.expect(public.has_access('edit_website'), 'an individual grant works for someone not yet approved');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.review_account('00000000-0000-0000-0000-0000000000f6', 'declined');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
select pg_temp.expect(not public.has_access('edit_website'), 'a declined account loses individual grants');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin
  perform * from public.broadcast_recipients('{delegate}', '{approved}', false);
  raise exception 'FAILED: exec listed recipients';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - only people allowed to send can list recipients';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.access_rules set allowed = false where capability = 'edit_website';
select pg_temp.expect(public.has_access('edit_website'), 'the site owner can never lock themselves out');
reset role;

select 'ALL RLS TESTS PASSED' as result;
