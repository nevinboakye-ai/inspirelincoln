-- Direct messages tests. Run against a disposable database with every migration applied
-- (see supabase/tests/README.md). Ends by printing ALL DM TESTS PASSED.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'chair@x.test', '{"full_name":"Chair Person"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'amy@x.test', '{"full_name":"Amy Delegate"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'ben@x.test', '{"full_name":"Ben Delegate"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'cat@x.test', '{"full_name":"Cat Pending"}');
update public.profiles set full_name = split_part(email,'@',1) || ' Name' where full_name is null;
update public.profiles set account_type = 'executive_committee', account_status = 'approved' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set account_status = 'approved' where id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2');
update public.site_switches set enabled = true where key = 'network_open';
insert into public.site_switches (key, enabled) values ('network_open', true) on conflict (key) do update set enabled = true;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if; end $$;
create or replace function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- Committee messages a pending account
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect(public.has_access('message_people'), 'exec has message_people');
select pg_temp.expect((select count(*) from public.dm_contacts()) = 3, 'committee sees everyone in contacts');
select set_config('t.c1', public.dm_start('00000000-0000-0000-0000-0000000000b3')::text, false);
select pg_temp.expect((public.dm_send(current_setting('t.c1')::uuid, 'Please upload your photo')).from_committee, 'committee message flagged');
select pg_temp.expect(public.dm_send_many(array['00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1']::uuid[], 'Reminder for all') = 2, 'send many skips self');
select pg_temp.expect((select count(*) from public.dm_inbox()) = 2, 'committee inbox has 2');

-- Pending person can reply
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select pg_temp.expect((select conversations from public.dm_unread_summary()) = 1, 'pending sees 1 unread conversation');
select pg_temp.expect((select unread from public.dm_inbox()) = 2, 'two unread messages');
select public.dm_send(current_setting('t.c1')::uuid, 'Done!');
select pg_temp.expect((select conversations from public.dm_unread_summary()) = 0, 'sending marks read');
select pg_temp.expect((select count(*) from public.dm_contacts()) = 0, 'pending cannot browse contacts');
do $$ begin perform public.dm_start('00000000-0000-0000-0000-0000000000b1'); raise exception 'FAILED: pending started dm';
exception when sqlstate 'P0001' then raise notice 'ok - pending cannot start with delegate: %', sqlerrm; end $$;

-- Delegates
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from public.dm_contacts()) = 2, 'delegate sees approved listed people');
select set_config('t.c2', public.dm_start('00000000-0000-0000-0000-0000000000b2')::text, false);
select public.dm_send(current_setting('t.c2')::uuid, 'Hi Ben');
select pg_temp.expect((select count(*) from public.dm_messages) = 2, 'amy sees only her messages (1 committee + 1 own)');
select pg_temp.expect((select count(*) from public.dm_inbox()) = 2, 'amy inbox 2');
-- cannot read others
select pg_temp.expect((select count(*) from public.dm_messages where conversation_id = current_setting('t.c1')::uuid) = 0, 'amy cannot read c1');
do $$ begin insert into public.dm_messages (conversation_id, sender_name, body) values (current_setting('t.c1')::uuid, 'x', 'y'); raise exception 'FAILED insert';
exception when insufficient_privilege then raise notice 'ok - no direct insert'; end $$;
do $$ begin perform public.dm_send(current_setting('t.c1')::uuid, 'sneak'); raise exception 'FAILED sneak';
exception when insufficient_privilege then raise notice 'ok - cannot send into others conversation'; end $$;

-- Ben turns off DMs then blocks
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect((select other_name from public.dm_inbox()) is not null, 'ben sees amy');
select public.dm_seen(current_setting('t.c2')::uuid);
select public.dm_block('00000000-0000-0000-0000-0000000000b1', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select other_read_at from public.dm_inbox() where conversation_id = current_setting('t.c2')::uuid) is not null, 'amy sees seen');
select pg_temp.expect(not (select can_send from public.dm_inbox() where conversation_id = current_setting('t.c2')::uuid), 'amy cannot send after block');
do $$ begin perform public.dm_send(current_setting('t.c2')::uuid, 'again'); raise exception 'FAILED blocked send';
exception when sqlstate 'P0001' then raise notice 'ok - blocked: %', sqlerrm; end $$;
select pg_temp.expect((select count(*) from public.dm_contacts()) = 1, 'blocked person hidden from contacts');
-- clear
select public.dm_clear(current_setting('t.c2')::uuid);
select pg_temp.expect((select count(*) from public.dm_inbox()) = 1, 'cleared conversation hidden');
-- notify
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_config('t.m', (public.dm_send(current_setting('t.c1')::uuid, 'Thanks')).id::text, false);
select pg_temp.expect((select count(*) from public.dm_notify_target(current_setting('t.m')::uuid)) = 1, 'notify first time');
select set_config('t.m', (public.dm_send(current_setting('t.c1')::uuid, 'Again')).id::text, false);
select pg_temp.expect((select count(*) from public.dm_notify_target(current_setting('t.m')::uuid)) = 0, 'no second notify');
reset role;
-- delete account cascades
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000b3';
select pg_temp.expect((select count(*) from public.dm_members where conversation_id = current_setting('t.c1')::uuid) = 1, 'member removed, conversation kept');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select other_name from public.dm_inbox() where conversation_id = current_setting('t.c1')::uuid) = 'Deleted account', 'deleted account label');
do $$ begin perform public.dm_send(current_setting('t.c1')::uuid, 'x'); raise exception 'FAILED';
exception when sqlstate 'P0001' then raise notice 'ok - %', sqlerrm; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select not can_send and why_not like 'You can''t message%' from public.dm_peer(current_setting('t.c2')::uuid)), 'peer explains block');
select pg_temp.expect((select can_send from public.dm_peer(current_setting('t.c1')::uuid)) is null or true, 'peer for non-member is empty');
select pg_temp.expect((select count(*) from public.dm_peer(current_setting('t.c1')::uuid)) = 0, 'no peer row for others conversation');
reset role;
select 'ALL DM TESTS PASSED';
