-- =====================================================================
-- Enquiries in My Hub.
--
--   * Anyone with an account can start a conversation with the committee
--     from My Hub: a question, a request, technical help or anything else.
--     The committee replies in the same conversation, so nothing goes
--     through email.
--   * Only the person who started a conversation, and committee members
--     with the new "Member enquiries" permission, can see it. By default
--     that's the executive committee, vice president and president; the
--     site owner can change this on the Platform dashboard.
--   * Every change goes through the functions below, which check who is
--     asking. Nobody can write to the tables directly.
--   * Conversations are deleted with the account that started them.
-- =====================================================================

-- The permission.
insert into public.access_capabilities (key, label, description, sort) values
  ('answer_enquiries', 'Member enquiries', 'Read and reply to the questions and requests delegates send from My Hub.', 55)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'answer_enquiries',
       t.account_type in ('executive_committee', 'vice_president', 'president')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

-- Conversations.
create table if not exists public.enquiry_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic in ('question', 'request', 'technical', 'access', 'presenting', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  -- open: waiting for the committee. answered: the committee replied last. closed: resolved.
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  last_from text not null default 'member' check (last_from in ('member', 'committee')),
  last_message_at timestamptz not null default now(),
  member_read_at timestamptz,
  committee_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists enquiry_threads_user_idx on public.enquiry_threads (user_id, last_message_at desc);
create index if not exists enquiry_threads_inbox_idx on public.enquiry_threads (status, last_message_at desc);

-- Messages.
create table if not exists public.enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.enquiry_threads (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  -- Kept with the message so the conversation still reads correctly if a
  -- committee member's account is later removed.
  author_name text not null,
  from_committee boolean not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists enquiry_messages_thread_idx on public.enquiry_messages (thread_id, created_at);

alter table public.enquiry_threads enable row level security;
alter table public.enquiry_messages enable row level security;

drop policy if exists "enquiry threads: own or committee" on public.enquiry_threads;
create policy "enquiry threads: own or committee" on public.enquiry_threads for select
  using (user_id = auth.uid() or public.has_access('answer_enquiries'));

drop policy if exists "enquiry threads: committee delete" on public.enquiry_threads;
create policy "enquiry threads: committee delete" on public.enquiry_threads for delete
  using (public.has_access('answer_enquiries'));

drop policy if exists "enquiry messages: own or committee" on public.enquiry_messages;
create policy "enquiry messages: own or committee" on public.enquiry_messages for select
  using (exists (
    select 1 from public.enquiry_threads t
     where t.id = thread_id and (t.user_id = auth.uid() or public.has_access('answer_enquiries'))
  ));

revoke insert, update on public.enquiry_threads, public.enquiry_messages from anon, authenticated;

-- Start a conversation. Returns its id.
create or replace function public.enquiry_open(p_topic text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  tid uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  if (select count(*) from public.enquiry_threads
       where user_id = me.id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You''ve started a lot of enquiries today. Please add to one you already have.' using errcode = 'P0001';
  end if;
  insert into public.enquiry_threads (user_id, topic, subject, member_read_at)
  values (me.id, p_topic, btrim(p_subject), now())
  returning id into tid;
  insert into public.enquiry_messages (thread_id, author_id, author_name, from_committee, body)
  values (tid, me.id, coalesce(nullif(btrim(me.full_name), ''), 'Member'), false, btrim(p_body));
  return tid;
end;
$$;

-- Add a message. The person who started the conversation writes as
-- themselves; anyone with the permission writes as the committee.
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
         committee_read_at = case when committee then msg.created_at else committee_read_at end
   where id = t.id;
  return msg;
end;
$$;

-- Mark a conversation as read by whoever is looking at it.
create or replace function public.enquiry_seen(p_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.enquiry_threads set member_read_at = now()
   where id = p_thread and user_id = auth.uid();
  if not found and public.has_access('answer_enquiries') then
    update public.enquiry_threads set committee_read_at = now() where id = p_thread;
  end if;
end;
$$;

-- Close or reopen. The committee can do either; the member can close
-- their own conversation (sending a new message reopens it).
create or replace function public.enquiry_set_status(p_thread uuid, p_closed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t public.enquiry_threads;
begin
  select * into t from public.enquiry_threads where id = p_thread;
  if t.id is null or not (t.user_id = auth.uid() or public.has_access('answer_enquiries')) then
    raise exception 'That conversation isn''t available.' using errcode = '42501';
  end if;
  update public.enquiry_threads
     set status = case when p_closed then 'closed' when last_from = 'committee' then 'answered' else 'open' end
   where id = p_thread;
end;
$$;

revoke all on function public.enquiry_open(text, text, text) from public, anon;
revoke all on function public.enquiry_send(uuid, text) from public, anon;
revoke all on function public.enquiry_seen(uuid) from public, anon;
revoke all on function public.enquiry_set_status(uuid, boolean) from public, anon;
grant execute on function public.enquiry_open(text, text, text) to authenticated;
grant execute on function public.enquiry_send(uuid, text) to authenticated;
grant execute on function public.enquiry_seen(uuid) to authenticated;
grant execute on function public.enquiry_set_status(uuid, boolean) to authenticated;

-- Who sent each conversation, for the committee's inbox: just what's
-- needed to answer them, and only for people who have written in.
create or replace function public.enquiry_people(p_ids uuid[])
returns table (id uuid, full_name text, institution text, year_of_study text, roles public.account_type[], avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.institution, p.year_of_study, public.all_types(p.account_type, p.extra_types), p.avatar_path
    from public.profiles p
   where public.has_access('answer_enquiries')
     and p.id = any(p_ids)
     and exists (select 1 from public.enquiry_threads t where t.user_id = p.id)
$$;
revoke all on function public.enquiry_people(uuid[]) from public, anon;
grant execute on function public.enquiry_people(uuid[]) to authenticated;

-- =====================================================================
-- Instagram on profiles, and the committee first on the delegate network.
--
--   * People can add their Instagram username next to their LinkedIn. It
--     shows wherever the bio does: their card and the delegate network.
--   * The delegate network now also returns every role each person holds,
--     so the website can list the committee first (the executive, then
--     the teams) and give their cards a look of their own.
-- =====================================================================

alter table public.profiles add column if not exists instagram text;
alter table public.profiles drop constraint if exists profiles_instagram_check;
alter table public.profiles add constraint profiles_instagram_check
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- =====================================================================
-- Presenting status stays private until the site owner releases it.
--
--   * A new switch, "presenting_public", starts off. While it is off,
--     other delegates don't see who is presenting: oral presenter, poster
--     presenter and the oral waiting list are left off cards and the
--     delegate network (people show as delegates), and so are
--     presentation titles.
--   * People always see their own, and the committee always sees
--     everyone's.
-- =====================================================================
insert into public.site_switches (key, enabled) values ('presenting_public', false) on conflict do nothing;

create or replace function public.presenting_visible(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.site_switches where key = 'presenting_public'), false)
      or p_owner = auth.uid()
      or public.is_committee()
$$;

-- The roles others may see: presenting roles are dropped while hidden.
create or replace function public.visible_types(p_owner uuid, p_types public.account_type[])
returns public.account_type[] language sql stable security definer set search_path = public as $$
  select case
    when public.presenting_visible(p_owner) then p_types
    else coalesce(
      nullif(array(select r from unnest(p_types) r where r not in ('oral_presenter', 'poster_presenter', 'oral_waitlist')), '{}'),
      array['delegate']::public.account_type[])
  end
$$;
grant execute on function public.presenting_visible(uuid) to authenticated;
grant execute on function public.visible_types(uuid, public.account_type[]) to authenticated;

create or replace function public.card_json(t public.profiles)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', t.id,
    'full_name', t.full_name,
    'institution', t.institution,
    'year_of_study', t.year_of_study,
    'roles', to_jsonb(public.visible_types(t.id, public.all_types(t.account_type, t.extra_types))),
    'committee_position', case when exists (
        select 1 from unnest(public.all_types(t.account_type, t.extra_types)) r
         where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
      ) then t.committee_position end,
    'bio', t.bio,
    'linkedin_url', t.linkedin_url,
    'instagram', t.instagram,
    'email', case when t.network_show_email then t.email end,
    'presentation_title', case when public.visible_types(t.id, public.all_types(t.account_type, t.extra_types)) && array['oral_presenter', 'poster_presenter']::public.account_type[]
      then t.presentation_title end,
    'avatar_path', t.avatar_path
  )
$$;

drop function if exists public.network_directory();
create function public.network_directory()
returns table (id text, full_name text, institution text, year_of_study text, account_type public.account_type,
               committee_position text, bio text, linkedin_url text, email text, joined boolean, avatar_path text,
               instagram text, roles public.account_type[])
language sql stable security definer set search_path = public as $$
  with me as (
    select (p.account_status = 'approved' or p.role = 'admin') as member,
           public.has_access('review_accounts') as staff
      from public.profiles p
     where p.id = auth.uid() and (public.network_is_open() or public.is_site_owner())
  ), people as (
    select p.id::text, p.full_name, p.institution, p.year_of_study,
           case when p.account_type in ('oral_presenter', 'poster_presenter', 'oral_waitlist') and not public.presenting_visible(p.id)
             then 'delegate'::public.account_type else p.account_type end,
           case when exists (
               select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
                where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
             ) then p.committee_position end,
           p.bio, p.linkedin_url,
           case when p.network_show_email then p.email end,
           true,
           p.avatar_path,
           p.instagram,
           public.visible_types(p.id, public.all_types(p.account_type, p.extra_types))
      from public.profiles p, me
     where (me.member or me.staff)
       and p.network_listed and p.account_status = 'approved' and p.full_name is not null
    union all
    select 'selected:' || md5(r.email), r.full_name, r.institution, r.year_of_study, r.account_type,
           null, null, null, null, false, null, null, public.all_types(r.account_type, r.extra_types)
      from public.delegate_roster r, me
     where me.staff
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
  )
  select * from people order by lower(full_name)
$$;
revoke all on function public.network_directory() from public, anon;
grant execute on function public.network_directory() to authenticated;
