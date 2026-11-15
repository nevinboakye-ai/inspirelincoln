-- =====================================================================
-- Direct messages in My Hub.
--
--   * One-to-one conversations between people with accounts, kept on the
--     website so nothing has to go through email.
--   * The committee (anyone with the new "Direct messages" permission,
--     by default every committee role) can message anyone with an
--     account, whatever their status, and can send the same message to
--     several people at once. Each person gets it in their own private
--     conversation.
--   * Confirmed delegates can message each other through the delegate
--     network while it is open, unless the site owner switches delegate
--     messages off, or the person has turned off messages from other
--     delegates in their privacy settings.
--   * Anyone can always reply in a conversation the other person started
--     (so a delegate can answer the committee), unless one of them has
--     blocked the other. A block never stops the committee.
--   * Only the two people in a conversation can read it. Every change
--     goes through the functions below, which check who is asking.
--   * Conversations go with the accounts in them: when both people's
--     accounts are deleted, so is the conversation.
-- =====================================================================

-- The permission.
insert into public.access_capabilities (key, label, description, sort) values
  ('message_people', 'Direct messages', 'Message anyone with an account from My Hub, whatever their status, and send one message to several people at once.', 57)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'message_people',
       t.account_type not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

-- The site owner's switch for delegate-to-delegate messages. Starts on:
-- the delegate network switch still has to be on as well.
insert into public.site_switches (key, enabled) values ('delegate_messages', true) on conflict do nothing;

-- Each person's choices.
alter table public.profiles add column if not exists dm_open boolean not null default true;
alter table public.profiles add column if not exists dm_email boolean not null default true;

-- Conversations. pair_key is the two account ids in order, so there is
-- only ever one conversation between the same two people.
create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  pair_key text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_sender_id uuid,
  last_body text
);

create table if not exists public.dm_members (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  -- "Delete for me": messages up to this time are hidden from them.
  cleared_at timestamptz,
  -- The last time we emailed them about an unread message here.
  notified_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists dm_members_user_idx on public.dm_members (user_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  -- Kept with the message so it still reads correctly if the account goes.
  sender_name text not null,
  -- Sent by someone with the "Direct messages" permission.
  from_committee boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_conversation_idx on public.dm_messages (conversation_id, created_at);
create index if not exists dm_messages_sender_idx on public.dm_messages (sender_id, created_at);

create table if not exists public.dm_blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- Remove a conversation once nobody is left in it.
create or replace function public.dm_drop_empty()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.dm_conversations c
   where c.id = old.conversation_id
     and not exists (select 1 from public.dm_members m where m.conversation_id = c.id);
  return null;
end;
$$;
drop trigger if exists dm_members_drop_empty on public.dm_members;
create trigger dm_members_drop_empty after delete on public.dm_members
  for each row execute function public.dm_drop_empty();

-- Whether the signed-in person is in a conversation. Security definer so
-- the policies below don't look themselves up.
create or replace function public.dm_is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_members where conversation_id = p_conversation and user_id = auth.uid())
$$;
grant execute on function public.dm_is_member(uuid) to authenticated;

alter table public.dm_conversations enable row level security;
alter table public.dm_members enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_blocks enable row level security;

drop policy if exists "dm conversations: members" on public.dm_conversations;
create policy "dm conversations: members" on public.dm_conversations for select using (public.dm_is_member(id));
drop policy if exists "dm members: same conversation" on public.dm_members;
create policy "dm members: same conversation" on public.dm_members for select using (public.dm_is_member(conversation_id));
drop policy if exists "dm messages: members" on public.dm_messages;
create policy "dm messages: members" on public.dm_messages for select using (public.dm_is_member(conversation_id));
drop policy if exists "dm blocks: own" on public.dm_blocks;
create policy "dm blocks: own" on public.dm_blocks for select using (blocker = auth.uid());

revoke insert, update, delete on public.dm_conversations, public.dm_members, public.dm_messages, public.dm_blocks from anon, authenticated;
revoke all on public.dm_conversations, public.dm_members, public.dm_messages, public.dm_blocks from anon;
grant select on public.dm_conversations, public.dm_members, public.dm_messages, public.dm_blocks to authenticated;

create or replace function public.dm_pair(a uuid, b uuid)
returns text language sql immutable as $$
  select least(a, b)::text || ':' || greatest(a, b)::text
$$;

create or replace function public.dm_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

-- Why the signed-in person can't start a conversation with someone, or
-- null if they can. Codes: not_found, self, blocked, not_approved, off,
-- closed.
create or replace function public.dm_can_message(p_other uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles;
  them public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into them from public.profiles where id = p_other;
  if me.id is null or them.id is null then return 'not_found'; end if;
  if me.id = them.id then return 'self'; end if;
  if public.has_access('message_people') then return null; end if;
  if public.dm_blocked(me.id, them.id) then return 'blocked'; end if;
  -- They've already written to me: I can always reply.
  if exists (
    select 1 from public.dm_conversations c join public.dm_messages m on m.conversation_id = c.id
     where c.pair_key = public.dm_pair(me.id, them.id) and m.sender_id = them.id
  ) then return null; end if;
  if me.account_status <> 'approved' and me.role <> 'admin' then return 'not_approved'; end if;
  if not public.network_is_open()
     or not coalesce((select enabled from public.site_switches where key = 'delegate_messages'), true) then
    return 'off';
  end if;
  if them.account_status <> 'approved' or not them.network_listed or not them.dm_open then return 'closed'; end if;
  return null;
end;
$$;

create or replace function public.dm_reason_text(code text, who text)
returns text language sql immutable as $$
  select case code
    when 'self' then 'You can''t message yourself.'
    when 'blocked' then 'You can''t message ' || who || '.'
    when 'not_approved' then 'You can message other delegates once the committee confirms your place.'
    when 'off' then 'Messages between delegates aren''t open just now.'
    when 'closed' then who || ' isn''t taking messages from other delegates.'
    else 'That person isn''t available.'
  end
$$;

-- Find or create the conversation with someone. Returns its id. An
-- existing conversation is always returned, so either person can open it.
create or replace function public.dm_start(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  why text;
  who text;
begin
  if me is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  select c.id into cid from public.dm_conversations c
    join public.dm_members m on m.conversation_id = c.id and m.user_id = me
   where c.pair_key = public.dm_pair(me, p_other);
  if cid is not null then return cid; end if;

  why := public.dm_can_message(p_other);
  if why is not null then
    select coalesce(nullif(btrim(full_name), ''), 'That person') into who from public.profiles where id = p_other;
    raise exception '%', public.dm_reason_text(why, coalesce(who, 'That person')) using errcode = 'P0001';
  end if;
  if not public.has_access('message_people') and (
    select count(*) from public.dm_conversations where created_by = me and created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'You''ve started a lot of conversations today. Please try again tomorrow.' using errcode = 'P0001';
  end if;

  insert into public.dm_conversations (pair_key, created_by) values (public.dm_pair(me, p_other), me)
  on conflict (pair_key) do update set pair_key = excluded.pair_key
  returning id into cid;
  insert into public.dm_members (conversation_id, user_id) values (cid, me), (cid, p_other) on conflict do nothing;
  return cid;
end;
$$;

-- The message itself, after the checks. Not callable directly.
create or replace function public.dm_post(p_conversation uuid, p_sender public.profiles, p_body text, p_committee boolean)
returns public.dm_messages language plpgsql security definer set search_path = public as $$
declare msg public.dm_messages;
begin
  insert into public.dm_messages (conversation_id, sender_id, sender_name, from_committee, body)
  values (p_conversation, p_sender.id, coalesce(nullif(btrim(p_sender.full_name), ''), 'INSPIRE member'), p_committee, btrim(p_body))
  returning * into msg;
  update public.dm_conversations
     set last_message_at = msg.created_at, last_sender_id = p_sender.id, last_body = left(msg.body, 200)
   where id = p_conversation;
  update public.dm_members set last_read_at = msg.created_at where conversation_id = p_conversation and user_id = p_sender.id;
  return msg;
end;
$$;
revoke all on function public.dm_post(uuid, public.profiles, text, boolean) from public, anon, authenticated;

-- Send a message in a conversation you're in.
create or replace function public.dm_send(p_conversation uuid, p_body text)
returns public.dm_messages language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  other uuid;
  committee boolean := public.has_access('message_people');
  why text;
  who text;
begin
  select * into me from public.profiles where id = auth.uid();
  perform 1 from public.dm_conversations where id = p_conversation for update;
  if me.id is null or not exists (select 1 from public.dm_members where conversation_id = p_conversation and user_id = me.id) then
    raise exception 'That conversation isn''t available.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Messages need to be between 1 and 4000 characters.' using errcode = 'P0001';
  end if;
  select user_id into other from public.dm_members where conversation_id = p_conversation and user_id <> me.id;
  if other is null then
    raise exception 'This account has been removed, so they can''t get new messages.' using errcode = 'P0001';
  end if;
  if not committee then
    why := public.dm_can_message(other);
    if why is not null then
      select coalesce(nullif(btrim(full_name), ''), 'That person') into who from public.profiles where id = other;
      raise exception '%', public.dm_reason_text(why, who) using errcode = 'P0001';
    end if;
    if (select count(*) from public.dm_messages where sender_id = me.id and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'You''re sending messages very quickly. Please wait a few minutes.' using errcode = 'P0001';
    end if;
  end if;
  return public.dm_post(p_conversation, me, p_body, committee);
end;
$$;

-- The committee sends the same message to several people. Each gets it in
-- their own conversation. Returns how many were sent.
create or replace function public.dm_send_many(p_people uuid[], p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  pid uuid;
  cid uuid;
  sent int := 0;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or not public.has_access('message_people') then
    raise exception 'You can''t send group messages.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Messages need to be between 1 and 4000 characters.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_people, 1), 0) > 500 then
    raise exception 'Send to 500 people or fewer at a time.' using errcode = 'P0001';
  end if;
  for pid in select distinct u from unnest(p_people) u where u <> me.id and exists (select 1 from public.profiles p where p.id = u) loop
    insert into public.dm_conversations (pair_key, created_by) values (public.dm_pair(me.id, pid), me.id)
    on conflict (pair_key) do update set pair_key = excluded.pair_key
    returning id into cid;
    insert into public.dm_members (conversation_id, user_id) values (cid, me.id), (cid, pid) on conflict do nothing;
    perform public.dm_post(cid, me, p_body, true);
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

-- Mark a conversation read.
create or replace function public.dm_seen(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.dm_members set last_read_at = now() where conversation_id = p_conversation and user_id = auth.uid()
$$;

-- Hide everything so far from your own view. New messages bring it back.
create or replace function public.dm_clear(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.dm_members set cleared_at = now(), last_read_at = now() where conversation_id = p_conversation and user_id = auth.uid()
$$;

-- Block or unblock someone.
create or replace function public.dm_block(p_other uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_other = auth.uid() then raise exception 'That person isn''t available.' using errcode = '42501'; end if;
  if p_on then
    insert into public.dm_blocks (blocker, blocked) select auth.uid(), p_other where exists (select 1 from public.profiles where id = p_other)
    on conflict do nothing;
  else
    delete from public.dm_blocks where blocker = auth.uid() and blocked = p_other;
  end if;
end;
$$;

-- Your conversations, newest first, with the other person's details.
create or replace function public.dm_inbox()
returns table (
  conversation_id uuid, other_id uuid, other_name text, other_institution text, other_roles public.account_type[],
  other_position text, other_avatar_path text, last_message_at timestamptz, last_body text, last_from_me boolean,
  unread int, other_read_at timestamptz, blocked_by_me boolean, can_send boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, o.user_id, coalesce(p.full_name, 'Deleted account'), p.institution,
         case when p.id is null then null else public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)) end,
         p.committee_position, p.avatar_path,
         c.last_message_at, c.last_body, c.last_sender_id = auth.uid(),
         (select count(*)::int from public.dm_messages x
           where x.conversation_id = c.id and x.sender_id is distinct from auth.uid()
             and x.created_at > greatest(coalesce(me.last_read_at, '-infinity'), coalesce(me.cleared_at, '-infinity'))),
         o.last_read_at,
         exists (select 1 from public.dm_blocks b where b.blocker = auth.uid() and b.blocked = o.user_id),
         o.user_id is not null and (public.has_access('message_people') or public.dm_can_message(o.user_id) is null)
    from public.dm_members me
    join public.dm_conversations c on c.id = me.conversation_id
    left join public.dm_members o on o.conversation_id = c.id and o.user_id <> auth.uid()
    left join public.profiles p on p.id = o.user_id
   where me.user_id = auth.uid()
     and c.last_message_at is not null
     and (me.cleared_at is null or c.last_message_at > me.cleared_at)
   order by c.last_message_at desc
   limit 300
$$;

-- What the menu badge and the new-message pop-up need. Cheap enough to ask often.
create or replace function public.dm_unread_summary()
returns table (conversations int, latest_id uuid, latest_conversation uuid, latest_name text, latest_body text, latest_at timestamptz)
language sql stable security definer set search_path = public as $$
  with unread as (
    select x.*
      from public.dm_members me
      join public.dm_messages x on x.conversation_id = me.conversation_id
     where me.user_id = auth.uid()
       and x.sender_id is distinct from auth.uid()
       and x.created_at > greatest(coalesce(me.last_read_at, '-infinity'), coalesce(me.cleared_at, '-infinity'))
  ), latest as (
    select * from unread order by created_at desc limit 1
  )
  select (select count(distinct conversation_id)::int from unread),
         l.id, l.conversation_id, l.sender_name, left(l.body, 160), l.created_at
    from (select 1) one left join latest l on true
$$;

-- People you can start a conversation with, for the "New message" picker.
create or replace function public.dm_contacts()
returns table (id uuid, full_name text, institution text, year_of_study text, roles public.account_type[],
               committee_position text, avatar_path text, account_status public.account_status)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where profiles.id = auth.uid();
  if me.id is null then return; end if;
  if public.has_access('message_people') then
    return query
      select p.id, p.full_name, p.institution, p.year_of_study, public.all_types(p.account_type, p.extra_types),
             p.committee_position, p.avatar_path, p.account_status
        from public.profiles p
       where p.id <> me.id and nullif(btrim(p.full_name), '') is not null
       order by lower(p.full_name)
       limit 3000;
    return;
  end if;
  if (me.account_status <> 'approved' and me.role <> 'admin') or not public.network_is_open()
     or not coalesce((select enabled from public.site_switches where key = 'delegate_messages'), true) then
    return;
  end if;
  return query
    select p.id, p.full_name, p.institution, p.year_of_study, public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)),
           case when exists (
               select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
                where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
             ) then p.committee_position end,
           p.avatar_path, p.account_status
      from public.profiles p
     where p.id <> me.id and p.account_status = 'approved' and p.network_listed and p.dm_open
       and nullif(btrim(p.full_name), '') is not null
       and not public.dm_blocked(me.id, p.id)
     order by lower(p.full_name)
     limit 3000;
end;
$$;

-- Whether to email the other person about a message just sent: once per
-- unread stretch, at most hourly, only if they want these emails and
-- haven't been on the website in the last ten minutes. Marks it sent.
create or replace function public.dm_notify_target(p_message uuid)
returns table (email text, full_name text, sender_name text)
language plpgsql security definer set search_path = public as $$
declare
  msg public.dm_messages;
  them public.dm_members;
begin
  select * into msg from public.dm_messages where id = p_message and sender_id = auth.uid();
  if msg.id is null then return; end if;
  select * into them from public.dm_members where conversation_id = msg.conversation_id and user_id <> auth.uid();
  if them.user_id is null then return; end if;
  if them.notified_at is not null and (them.notified_at > coalesce(them.last_read_at, '-infinity') or them.notified_at > now() - interval '1 hour') then
    return;
  end if;
  if exists (select 1 from public.user_activity a where a.user_id = them.user_id and a.last_seen_at > now() - interval '10 minutes') then
    return;
  end if;
  if not exists (select 1 from public.profiles p where p.id = them.user_id and p.dm_email and p.email is not null) then return; end if;
  update public.dm_members set notified_at = now() where conversation_id = them.conversation_id and user_id = them.user_id;
  return query select p.email, p.full_name, msg.sender_name from public.profiles p where p.id = them.user_id;
end;
$$;

-- One conversation's other person and what you can do there, for the chat.
create or replace function public.dm_peer(p_conversation uuid)
returns table (
  other_id uuid, other_name text, other_institution text, other_year text, other_roles public.account_type[],
  other_position text, other_avatar_path text, other_read_at timestamptz, my_cleared_at timestamptz,
  blocked_by_me boolean, can_send boolean, why_not text
)
language sql stable security definer set search_path = public as $$
  select o.user_id, coalesce(p.full_name, 'Deleted account'), p.institution, p.year_of_study,
         case when p.id is null then null else public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)) end,
         p.committee_position, p.avatar_path, o.last_read_at, me.cleared_at,
         exists (select 1 from public.dm_blocks b where b.blocker = auth.uid() and b.blocked = o.user_id),
         o.user_id is not null and (public.has_access('message_people') or public.dm_can_message(o.user_id) is null),
         case
           when o.user_id is null then 'This account has been removed, so they can''t get new messages.'
           when public.has_access('message_people') then null
           else (select public.dm_reason_text(w, coalesce(p.full_name, 'They')) from public.dm_can_message(o.user_id) w where w is not null)
         end
    from public.dm_members me
    left join public.dm_members o on o.conversation_id = me.conversation_id and o.user_id <> auth.uid()
    left join public.profiles p on p.id = o.user_id
   where me.conversation_id = p_conversation and me.user_id = auth.uid()
$$;

-- Someone's own choices: whether other delegates can start conversations
-- with them, and whether to email them about unread messages.
create or replace function public.dm_set_prefs(p_open boolean, p_email boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set dm_open = coalesce(p_open, dm_open), dm_email = coalesce(p_email, dm_email) where id = auth.uid()
$$;

revoke all on function public.dm_pair(uuid, uuid) from public, anon;
revoke all on function public.dm_blocked(uuid, uuid) from public, anon;
revoke all on function public.dm_can_message(uuid) from public, anon;
revoke all on function public.dm_start(uuid) from public, anon;
revoke all on function public.dm_send(uuid, text) from public, anon;
revoke all on function public.dm_send_many(uuid[], text) from public, anon;
revoke all on function public.dm_seen(uuid) from public, anon;
revoke all on function public.dm_clear(uuid) from public, anon;
revoke all on function public.dm_block(uuid, boolean) from public, anon;
revoke all on function public.dm_inbox() from public, anon;
revoke all on function public.dm_unread_summary() from public, anon;
revoke all on function public.dm_contacts() from public, anon;
revoke all on function public.dm_notify_target(uuid) from public, anon;
revoke all on function public.dm_set_prefs(boolean, boolean) from public, anon;
revoke all on function public.dm_peer(uuid) from public, anon;
grant execute on function public.dm_pair(uuid, uuid) to authenticated;
grant execute on function public.dm_blocked(uuid, uuid) to authenticated;
grant execute on function public.dm_can_message(uuid) to authenticated;
grant execute on function public.dm_start(uuid) to authenticated;
grant execute on function public.dm_send(uuid, text) to authenticated;
grant execute on function public.dm_send_many(uuid[], text) to authenticated;
grant execute on function public.dm_seen(uuid) to authenticated;
grant execute on function public.dm_clear(uuid) to authenticated;
grant execute on function public.dm_block(uuid, boolean) to authenticated;
grant execute on function public.dm_inbox() to authenticated;
grant execute on function public.dm_unread_summary() to authenticated;
grant execute on function public.dm_contacts() to authenticated;
grant execute on function public.dm_notify_target(uuid) to authenticated;
grant execute on function public.dm_set_prefs(boolean, boolean) to authenticated;
grant execute on function public.dm_peer(uuid) to authenticated;
