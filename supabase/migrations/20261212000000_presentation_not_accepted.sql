-- =====================================================================
-- Presentation not accepted, and email templates the committee can edit.
--
-- 1. abstract_not_accepted: people who applied to present an oral or
--    poster and weren't accepted. Everyone attending has so far been
--    called a "delegate", so some of them aren't sure whether they're
--    presenting. The list itself is personal data, so it is loaded from a
--    private setup file and never committed here.
--
-- 2. not_accepted_recipients(): each person on that list, matched to
--    their account or selected-list entry (by email, then by name when
--    exactly one person has that name). Group email uses it for two
--    groups: "Presentation not accepted, attending as a delegate" and
--    "Presentation not accepted, no delegate place".
--
-- 3. email_templates: the committee's saved edits to Group email
--    templates. A row with the same id as a built-in template replaces
--    it; deleting the row puts the original back.
--
-- 4. email_broadcasts.audience_note records which of these groups a
--    group email went to, for the Sent list.
--
-- Safe to run more than once.
-- =====================================================================

create table if not exists public.abstract_not_accepted (
  email text primary key check (email = lower(email) and email like '%@%'),
  full_name text not null check (char_length(full_name) <= 120),
  institution text check (char_length(institution) <= 160),
  abstract_title text check (char_length(abstract_title) <= 500),
  added_at timestamptz not null default now()
);
alter table public.abstract_not_accepted enable row level security;

drop policy if exists "not accepted: committee read" on public.abstract_not_accepted;
drop policy if exists "not accepted: reviewers write" on public.abstract_not_accepted;
create policy "not accepted: committee read" on public.abstract_not_accepted for select
  using (public.has_access('send_email') or public.has_access('review_accounts'));
create policy "not accepted: reviewers write" on public.abstract_not_accepted for all
  using (public.has_access('review_accounts')) with check (public.has_access('review_accounts'));
grant select, insert, update, delete on public.abstract_not_accepted to authenticated;

-- A name reduced to lowercase letters and single spaces, for matching
-- "aymen dar" with "Aymen Dar " or "Ralph H.L Hudson" with "Ralph HL Hudson".
create or replace function public.person_key(n text)
returns text language sql immutable set search_path = public as $$
  select nullif(btrim(regexp_replace(lower(coalesce(n, '')), '[^a-z]+', ' ', 'g')), '')
$$;

-- The matching itself, for the recipients function below and for the
-- report at the end of the setup file. Not callable from the website.
drop function if exists public.not_accepted_recipients();
drop function if exists public.not_accepted_people();
create function public.not_accepted_people()
returns table (
  email text,
  full_name text,
  account_type public.account_type,
  account_status public.account_status,
  institution text,
  id uuid,
  joined boolean,
  attending boolean,
  matched_by text,
  abstract_title text,
  list_email text
)
language sql stable security definer set search_path = public as $$
    select
      coalesce(lower(p.email), r.email, n.email),
      coalesce(p.full_name, r.full_name, n.full_name),
      coalesce(p.account_type, r.account_type),
      p.account_status,
      coalesce(p.institution, r.institution, n.institution),
      p.id,
      p.id is not null,
      case
        when p.id is not null then p.account_status = 'approved'
          and public.all_types(p.account_type, p.extra_types)
              && array['delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist']::public.account_type[]
        else r.email is not null
      end,
      case
        when p.how = 1 or r.email = n.email then 'email'
        when p.id is not null or r.email is not null then 'name'
      end,
      n.abstract_title,
      n.email
    from public.abstract_not_accepted n
    -- Their selected-list entry: same email, or the only entry with their name.
    left join lateral (
      select x.email, x.full_name, x.institution, x.account_type from (
        select d.email, d.full_name, d.institution, d.account_type, 1 as how
          from public.delegate_roster d where d.email = n.email
        union all
        select d.email, d.full_name, d.institution, d.account_type, 2
          from public.delegate_roster d
         where public.person_key(d.full_name) = public.person_key(n.full_name)
           and (select count(*) from public.delegate_roster d2
                 where public.person_key(d2.full_name) = public.person_key(n.full_name)) = 1
      ) x order by x.how limit 1
    ) r on true
    -- Their account: same email, the email on their list entry, or the only account with their name.
    left join lateral (
      select y.* from (
        select q.id, q.email, q.full_name, q.institution, q.account_type, q.extra_types, q.account_status, 1 as how
          from public.profiles q where lower(q.email) = n.email
        union all
        select q.id, q.email, q.full_name, q.institution, q.account_type, q.extra_types, q.account_status, 2
          from public.profiles q where r.email is not null and lower(q.email) = r.email
        union all
        select q.id, q.email, q.full_name, q.institution, q.account_type, q.extra_types, q.account_status, 3
          from public.profiles q
         where public.person_key(q.full_name) = public.person_key(n.full_name)
           and (select count(*) from public.profiles q2
                 where public.person_key(q2.full_name) = public.person_key(n.full_name)) = 1
      ) y where y.email is not null order by y.how limit 1
    ) p on true
    order by lower(coalesce(p.full_name, r.full_name, n.full_name))
$$;
revoke all on function public.not_accepted_people() from public, anon, authenticated;

-- What Group email reads, for anyone who can send group emails or review accounts.
create function public.not_accepted_recipients()
returns table (
  email text,
  full_name text,
  account_type public.account_type,
  account_status public.account_status,
  institution text,
  id uuid,
  joined boolean,
  attending boolean,
  matched_by text,
  abstract_title text,
  list_email text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_access('send_email') or public.has_access('review_accounts')) then
    raise exception 'Not authorised';
  end if;
  return query select * from public.not_accepted_people();
end $$;
revoke all on function public.not_accepted_recipients() from public, anon;
grant execute on function public.not_accepted_recipients() to authenticated;

-- ---------------------------------------------------------------------
-- Saved email templates.
-- ---------------------------------------------------------------------
create table if not exists public.email_templates (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  use_note text not null default '' check (char_length(use_note) <= 400),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 10 and 10000),
  audience jsonb not null default '{}'::jsonb,
  login boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_name text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;

drop policy if exists "email templates: senders" on public.email_templates;
create policy "email templates: senders" on public.email_templates for all
  using (public.has_access('send_email')) with check (public.has_access('send_email'));
grant select, insert, update, delete on public.email_templates to authenticated;

drop trigger if exists email_templates_touch on public.email_templates;
create trigger email_templates_touch before update on public.email_templates
  for each row execute function public.touch_updated_at();

alter table public.email_broadcasts add column if not exists audience_note text;
