-- Oral and poster presenters confirm whether they'll attend to present.
-- One answer per person; they can change it until the day. The executive
-- committee (who can already see accounts) reads every answer.
create table if not exists public.presenter_attendance (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  response text not null check (response in ('confirmed', 'unavailable')),
  note text check (char_length(note) <= 500),
  responded_at timestamptz not null default now()
);
alter table public.presenter_attendance enable row level security;

-- Only approved oral and poster presenters can answer, and only for themselves.
create or replace function public.can_confirm_attendance()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.account_status = 'approved'
       and p.account_type in ('oral_presenter', 'poster_presenter')
  )
$$;

drop policy if exists "attendance: read own or exec" on public.presenter_attendance;
drop policy if exists "attendance: answer own" on public.presenter_attendance;
drop policy if exists "attendance: change own" on public.presenter_attendance;
create policy "attendance: read own or exec" on public.presenter_attendance
  for select using (user_id = auth.uid() or public.has_access('review_accounts'));
create policy "attendance: answer own" on public.presenter_attendance
  for insert with check (user_id = auth.uid() and public.can_confirm_attendance());
create policy "attendance: change own" on public.presenter_attendance
  for update using (user_id = auth.uid() and public.can_confirm_attendance())
  with check (user_id = auth.uid());

grant select, insert, update on public.presenter_attendance to authenticated;
