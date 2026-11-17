-- =====================================================================
-- Emoji reactions, and read receipts the committee can turn off.
--
--   * Anyone in a direct message conversation, and anyone in an enquiry
--     conversation (the member who started it and the committee), can
--     react to a message with one of a small set of emoji. Tapping the
--     same emoji again takes it back.
--   * Committee members can turn their read receipts off. Then other
--     people no longer see "Seen" when they have read a message.
--   * Turning receipts off only hides it. The website still records
--     when they read each conversation (dm_members.last_read_at), so the
--     24-hour unread email (dm_due_emails) keeps working: nobody is
--     emailed about messages they have already read.
--   * So that the hidden times can't be read straight from the tables,
--     people can now only see who is in a conversation, not when the
--     other person last read it. The website asks dm_read_state instead,
--     which leaves the time out when receipts are off.
--
-- Run this after the matching website update is live. The new website
-- works before this has been run (without reactions or the setting); the
-- old website's chats stop updating live once this has been run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The emoji people can choose. Kept short so the picker fits on a phone.
-- ---------------------------------------------------------------------
create or replace function public.reaction_emoji()
returns text[] language sql immutable as $$
  select array['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '✅']
$$;
grant execute on function public.reaction_emoji() to authenticated;

-- ---------------------------------------------------------------------
-- Read receipts setting.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists read_receipts boolean not null default true;

-- Whether someone can use the setting: the committee, and anyone who
-- answers enquiries or messages people on the committee's behalf.
create or replace function public.can_hide_read_receipts()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_committee() or public.has_access('message_people') or public.has_access('answer_enquiries')
$$;
grant execute on function public.can_hide_read_receipts() to authenticated;

-- Turn your own read receipts on or off. Anyone can turn them back on.
create or replace function public.set_read_receipts(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  if not coalesce(p_on, true) and not public.can_hide_read_receipts() then
    raise exception 'Only committee members can turn read receipts off.' using errcode = 'P0001';
  end if;
  update public.profiles set read_receipts = coalesce(p_on, true) where id = auth.uid();
end;
$$;
revoke all on function public.set_read_receipts(boolean) from public, anon;
grant execute on function public.set_read_receipts(boolean) to authenticated;

-- When someone else may see that this person has read up to: their real
-- read time, or nothing if they've turned receipts off.
create or replace function public.visible_read_at(p_user uuid, p_read_at timestamptz)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case when coalesce((select read_receipts from public.profiles where id = p_user), true) then p_read_at end
$$;
revoke all on function public.visible_read_at(uuid, timestamptz) from public, anon;
grant execute on function public.visible_read_at(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Direct messages: hide the raw read times from the table.
-- ---------------------------------------------------------------------
-- People could read the other person's last_read_at (and cleared_at and
-- notified_at) straight from dm_members. Now they can only see who is in
-- the conversation. The functions below run as the owner, so they still
-- see everything.
revoke select on public.dm_members from authenticated;
grant select (conversation_id, user_id) on public.dm_members to authenticated;

-- What the chat polls for: whether you're in the conversation, whether the
-- other person is still there, and when they read it (if they share that).
create or replace function public.dm_read_state(p_conversation uuid)
returns table (member boolean, other_gone boolean, other_read_at timestamptz)
language sql stable security definer set search_path = public as $$
  select true,
         o.user_id is null,
         case when o.user_id is null then null else public.visible_read_at(o.user_id, o.last_read_at) end
    from public.dm_members me
    left join public.dm_members o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
   where me.conversation_id = p_conversation and me.user_id = auth.uid()
$$;
revoke all on function public.dm_read_state(uuid) from public, anon;
grant execute on function public.dm_read_state(uuid) to authenticated;

-- The inbox and the chat header: same as before, but other_read_at is left
-- out when the other person has turned receipts off.
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
         case when coalesce(p.read_receipts, true) then o.last_read_at end,
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

create or replace function public.dm_peer(p_conversation uuid)
returns table (
  other_id uuid, other_name text, other_institution text, other_year text, other_roles public.account_type[],
  other_position text, other_avatar_path text, other_read_at timestamptz, my_cleared_at timestamptz,
  blocked_by_me boolean, can_send boolean, why_not text
)
language sql stable security definer set search_path = public as $$
  select o.user_id, coalesce(p.full_name, 'Deleted account'), p.institution, p.year_of_study,
         case when p.id is null then null else public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)) end,
         p.committee_position, p.avatar_path,
         case when coalesce(p.read_receipts, true) then o.last_read_at end,
         me.cleared_at,
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

-- ---------------------------------------------------------------------
-- Enquiries: keep the committee's real read time private.
-- ---------------------------------------------------------------------
-- committee_read_at is what the member sees as "Seen by the committee".
-- It now only moves when a committee member with receipts on opens the
-- conversation (or the committee replies). committee_opened_at is the real
-- time anyone on the committee last opened it, which the committee's inbox
-- uses for its unread dots. Members can't read it.
alter table public.enquiry_threads add column if not exists committee_opened_at timestamptz;
update public.enquiry_threads set committee_opened_at = committee_read_at where committee_opened_at is null and committee_read_at is not null;

revoke select on public.enquiry_threads from authenticated;
grant select (id, user_id, topic, subject, status, last_from, last_message_at, member_read_at, committee_read_at, created_at)
  on public.enquiry_threads to authenticated;

-- When the committee last opened each conversation, for the committee's inbox.
create or replace function public.enquiry_committee_opened(p_ids uuid[])
returns table (id uuid, committee_opened_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.committee_opened_at
    from public.enquiry_threads t
   where public.has_access('answer_enquiries') and t.id = any(p_ids)
$$;
revoke all on function public.enquiry_committee_opened(uuid[]) from public, anon;
grant execute on function public.enquiry_committee_opened(uuid[]) to authenticated;

create or replace function public.enquiry_seen(p_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.enquiry_threads set member_read_at = now()
   where id = p_thread and user_id = auth.uid();
  if not found and public.has_access('answer_enquiries') then
    update public.enquiry_threads
       set committee_opened_at = now(),
           committee_read_at = case
             when coalesce((select read_receipts from public.profiles where id = auth.uid()), true) then now()
             else committee_read_at
           end
     where id = p_thread;
  end if;
end;
$$;

-- Sending: as before, plus committee_opened_at when the committee replies.
create or replace function public.enquiry_send(p_thread uuid, p_body text)
returns public.enquiry_messages language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  t public.enquiry_threads;
  committee boolean;
  msg public.enquiry_messages;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into t from public.enquiry_threads where id = p_thread for update;
  if me.id is null or t.id is null then raise exception 'That conversation isn''t available.' using errcode = '42501'; end if;
  if t.user_id = me.id then
    committee := false;
    if (select count(*) from public.enquiry_messages m join public.enquiry_threads x on x.id = m.thread_id
         where x.user_id = me.id and not m.from_committee and m.created_at > now() - interval '1 hour') >= 40 then
      raise exception 'You''re sending messages very quickly. Please wait a few minutes.' using errcode = 'P0001';
    end if;
  elsif public.has_access('answer_enquiries') then
    committee := true;
  else
    raise exception 'That conversation isn''t available.' using errcode = '42501';
  end if;

  insert into public.enquiry_messages (thread_id, author_id, author_name, from_committee, body)
  values (t.id, me.id, coalesce(nullif(btrim(me.full_name), ''), case when committee then 'INSPIRE committee' else 'Member' end), committee, btrim(p_body))
  returning * into msg;

  update public.enquiry_threads
     set status = case when committee then 'answered' else 'open' end,
         last_from = case when committee then 'committee' else 'member' end,
         last_message_at = msg.created_at,
         member_read_at = case when committee then member_read_at else msg.created_at end,
         committee_read_at = case when committee then msg.created_at else committee_read_at end,
         committee_opened_at = case when committee then msg.created_at else committee_opened_at end
   where id = t.id;
  return msg;
end;
$$;

-- ---------------------------------------------------------------------
-- Reactions on direct messages.
-- ---------------------------------------------------------------------
create table if not exists public.dm_reactions (
  message_id uuid not null references public.dm_messages (id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji = any(public.reaction_emoji())),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists dm_reactions_conversation_idx on public.dm_reactions (conversation_id);

alter table public.dm_reactions enable row level security;
drop policy if exists "dm reactions: members" on public.dm_reactions;
create policy "dm reactions: members" on public.dm_reactions for select using (public.dm_is_member(conversation_id));
revoke all on public.dm_reactions from anon;
revoke insert, update, delete on public.dm_reactions from authenticated;
grant select on public.dm_reactions to authenticated;

-- Add (p_on true) or take back (p_on false) a reaction.
create or replace function public.dm_react(p_message uuid, p_emoji text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  msg public.dm_messages;
  other uuid;
begin
  select * into msg from public.dm_messages where id = p_message;
  if me is null or msg.id is null
     or not exists (select 1 from public.dm_members where conversation_id = msg.conversation_id and user_id = me) then
    raise exception 'That message isn''t available.' using errcode = '42501';
  end if;
  if not coalesce(p_on, false) then
    delete from public.dm_reactions where message_id = p_message and user_id = me and emoji = p_emoji;
    return;
  end if;
  if p_emoji is null or not (p_emoji = any(public.reaction_emoji())) then
    raise exception 'Choose one of the emoji shown.' using errcode = 'P0001';
  end if;
  select user_id into other from public.dm_members where conversation_id = msg.conversation_id and user_id <> me;
  if other is not null and public.dm_blocked(me, other) and not public.has_access('message_people') then
    raise exception 'You can''t react in this conversation.' using errcode = 'P0001';
  end if;
  insert into public.dm_reactions (message_id, conversation_id, user_id, emoji)
  values (p_message, msg.conversation_id, me, p_emoji)
  on conflict do nothing;
end;
$$;
revoke all on function public.dm_react(uuid, text, boolean) from public, anon;
grant execute on function public.dm_react(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Reactions on enquiry messages.
-- ---------------------------------------------------------------------
create table if not exists public.enquiry_reactions (
  message_id uuid not null references public.enquiry_messages (id) on delete cascade,
  thread_id uuid not null references public.enquiry_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Kept so the member sees who on the committee reacted, as with replies.
  user_name text not null,
  from_committee boolean not null,
  emoji text not null check (emoji = any(public.reaction_emoji())),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists enquiry_reactions_thread_idx on public.enquiry_reactions (thread_id);

alter table public.enquiry_reactions enable row level security;
drop policy if exists "enquiry reactions: own or committee" on public.enquiry_reactions;
create policy "enquiry reactions: own or committee" on public.enquiry_reactions for select
  using (exists (
    select 1 from public.enquiry_threads t
     where t.id = thread_id and (t.user_id = auth.uid() or public.has_access('answer_enquiries'))
  ));
revoke all on public.enquiry_reactions from anon;
revoke insert, update, delete on public.enquiry_reactions from authenticated;
grant select on public.enquiry_reactions to authenticated;

create or replace function public.enquiry_react(p_message uuid, p_emoji text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  msg public.enquiry_messages;
  t public.enquiry_threads;
  committee boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into msg from public.enquiry_messages where id = p_message;
  select * into t from public.enquiry_threads where id = msg.thread_id;
  if me.id is null or t.id is null then raise exception 'That message isn''t available.' using errcode = '42501'; end if;
  if t.user_id = me.id then
    committee := false;
  elsif public.has_access('answer_enquiries') then
    committee := true;
  else
    raise exception 'That message isn''t available.' using errcode = '42501';
  end if;
  if not coalesce(p_on, false) then
    delete from public.enquiry_reactions where message_id = p_message and user_id = me.id and emoji = p_emoji;
    return;
  end if;
  if p_emoji is null or not (p_emoji = any(public.reaction_emoji())) then
    raise exception 'Choose one of the emoji shown.' using errcode = 'P0001';
  end if;
  insert into public.enquiry_reactions (message_id, thread_id, user_id, user_name, from_committee, emoji)
  values (p_message, t.id, me.id, coalesce(nullif(btrim(me.full_name), ''), case when committee then 'INSPIRE committee' else 'Member' end), committee, p_emoji)
  on conflict do nothing;
end;
$$;
revoke all on function public.enquiry_react(uuid, text, boolean) from public, anon;
grant execute on function public.enquiry_react(uuid, text, boolean) to authenticated;
