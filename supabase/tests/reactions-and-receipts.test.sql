-- Emoji reactions and read receipts. Run against a disposable database with every
-- migration applied. Ends by printing ALL REACTION AND RECEIPT TESTS PASSED.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'chair@x.test', '{"full_name":"Chair Person"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'exec@x.test', '{"full_name":"Exec Person"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'amy@x.test', '{"full_name":"Amy Delegate"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'ben@x.test', '{"full_name":"Ben Delegate"}');
update public.profiles set full_name = split_part(email,'@',1) || ' Name' where full_name is null;
update public.profiles set account_type = 'executive_committee', account_status = 'approved' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set account_status = 'approved' where id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if; end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- ---------------------------------------------------------------- DMs
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_config('t.c', public.dm_start('00000000-0000-0000-0000-0000000000b1')::text, false);
select set_config('t.m1', (public.dm_send(current_setting('t.c')::uuid, 'Please upload your photo')).id::text, false);

-- Amy reads and reacts.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.dm_seen(current_setting('t.c')::uuid);
select public.dm_react(current_setting('t.m1')::uuid, '👍', true);
select public.dm_react(current_setting('t.m1')::uuid, '👍', true);
select public.dm_react(current_setting('t.m1')::uuid, '❤️', true);
select pg_temp.expect((select count(*) from public.dm_reactions where message_id = current_setting('t.m1')::uuid) = 2, 'two reactions, no duplicates');
select public.dm_react(current_setting('t.m1')::uuid, '❤️', false);
select pg_temp.expect((select count(*) from public.dm_reactions) = 1, 'reaction taken back');
do $$ begin perform public.dm_react(current_setting('t.m1')::uuid, '💩', true); raise exception 'FAILED: odd emoji';
exception when sqlstate 'P0001' then raise notice 'ok - only listed emoji'; end $$;
do $$ begin insert into public.dm_reactions (message_id, conversation_id, user_id, emoji) values (current_setting('t.m1')::uuid, current_setting('t.c')::uuid, auth.uid(), '🎉'); raise exception 'FAILED insert';
exception when insufficient_privilege then raise notice 'ok - no direct insert'; end $$;
-- Amy can't see the committee's last read time from the table any more.
do $$ begin perform last_read_at from public.dm_members; raise exception 'FAILED: raw read time visible';
exception when insufficient_privilege then raise notice 'ok - raw read times hidden'; end $$;
select pg_temp.expect((select count(*) from public.dm_members where conversation_id = current_setting('t.c')::uuid) = 2, 'members still listed');

-- Ben can't see or react in a conversation he isn't in.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect((select count(*) from public.dm_reactions) = 0, 'outsider sees no reactions');
do $$ begin perform public.dm_react(current_setting('t.m1')::uuid, '👍', true); raise exception 'FAILED outsider react';
exception when insufficient_privilege then raise notice 'ok - outsider cannot react'; end $$;
select pg_temp.expect((select count(*) from public.dm_read_state(current_setting('t.c')::uuid)) = 0, 'outsider gets no read state');

-- The chair sees Amy's reaction and that she has read it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select count(*) from public.dm_reactions where emoji = '👍') = 1, 'chair sees reaction');
select pg_temp.expect((select other_read_at from public.dm_read_state(current_setting('t.c')::uuid)) is not null, 'chair sees Amy has read it');

-- Delegates can't turn receipts off.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin perform public.set_read_receipts(false); raise exception 'FAILED: delegate turned receipts off';
exception when sqlstate 'P0001' then raise notice 'ok - delegates keep receipts'; end $$;
select public.dm_send(current_setting('t.c')::uuid, 'Done!');

-- The chair turns receipts off and reads Amy's reply.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.set_read_receipts(false);
select public.dm_seen(current_setting('t.c')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select other_read_at from public.dm_read_state(current_setting('t.c')::uuid)) is null, 'read state hides chair read time');
select pg_temp.expect((select other_read_at from public.dm_peer(current_setting('t.c')::uuid)) is null, 'peer hides chair read time');
select pg_temp.expect((select other_read_at from public.dm_inbox() where conversation_id = current_setting('t.c')::uuid) is null, 'inbox hides chair read time');
-- ...but the chair still sees Amy's.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select other_read_at from public.dm_read_state(current_setting('t.c')::uuid)) is not null, 'chair still sees receipts from others');
select pg_temp.expect((select unread from public.dm_inbox() where conversation_id = current_setting('t.c')::uuid) = 0, 'chair has no unread');
reset role;
-- The real read time is still kept, so the 24-hour email skips it.
select pg_temp.expect((select last_read_at from public.dm_members where conversation_id = current_setting('t.c')::uuid and user_id = '00000000-0000-0000-0000-0000000000a1') is not null, 'real read time still recorded');
update public.dm_messages set created_at = created_at - interval '25 hours' where body = 'Done!';
select pg_temp.expect((select count(*) from public.dm_due_emails() where user_id = '00000000-0000-0000-0000-0000000000a1') = 0, 'no email about a message read with receipts off');

-- ---------------------------------------------------------------- Enquiries
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select set_config('t.e', public.enquiry_open('question', 'Parking on the day', 'Where can I park?')::text, false);
select set_config('t.em', (select id::text from public.enquiry_messages where thread_id = current_setting('t.e')::uuid), false);
do $$ begin perform committee_opened_at from public.enquiry_threads; raise exception 'FAILED: opened time visible';
exception when insufficient_privilege then raise notice 'ok - committee opened time hidden'; end $$;

-- The chair (receipts off) opens it: the committee's inbox knows, the member doesn't.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.enquiry_seen(current_setting('t.e')::uuid);
select pg_temp.expect((select committee_opened_at from public.enquiry_committee_opened(array[current_setting('t.e')::uuid])) is not null, 'committee inbox sees it opened');
select pg_temp.expect((select committee_read_at from public.enquiry_threads where id = current_setting('t.e')::uuid) is null, 'no seen receipt with receipts off');
select public.enquiry_react(current_setting('t.em')::uuid, '🙏', true);

-- Another exec with receipts on opens it: now the member sees it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.enquiry_seen(current_setting('t.e')::uuid);
select pg_temp.expect((select committee_read_at from public.enquiry_threads where id = current_setting('t.e')::uuid) is not null, 'seen receipt with receipts on');
select public.enquiry_react(current_setting('t.em')::uuid, '🙏', true);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from public.enquiry_reactions where message_id = current_setting('t.em')::uuid and from_committee) = 2, 'member sees both committee reactions');
select pg_temp.expect((select count(*) from public.enquiry_committee_opened(array[current_setting('t.e')::uuid])) = 0, 'member cannot ask for opened times');
select public.enquiry_react(current_setting('t.em')::uuid, '✅', true);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect((select count(*) from public.enquiry_reactions) = 0, 'outsider sees no enquiry reactions');
do $$ begin perform public.enquiry_react(current_setting('t.em')::uuid, '👍', true); raise exception 'FAILED outsider';
exception when insufficient_privilege then raise notice 'ok - outsider cannot react to enquiry'; end $$;

-- Anyone can turn receipts back on.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.set_read_receipts(true);
reset role;
select pg_temp.expect((select read_receipts from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'receipts back on');
select 'ALL REACTION AND RECEIPT TESTS PASSED';
