-- =====================================================================
-- Two new questions for delegates.
--
--   1. Before uploading slides or a poster, presenters tick a box to say
--      they've added their QR code to it. Each upload records that they did.
--
--   2. My Hub asks every approved delegate how they're getting to INSPIRE:
--      an INSPIRE-organised coach, another coach, train, car, or they live
--      in Lincoln. Drivers also give their car registration, for parking.
--      One answer per person; they can change it until the day. The
--      executive committee and people managers read every answer.
-- =====================================================================

-- 1. The QR code check on each upload. Earlier uploads were made before
--    the question existed, so they stay false.
alter table public.presentation_submissions
  add column if not exists qr_code_confirmed boolean not null default false;

-- 2. How each delegate is travelling.
create table if not exists public.delegate_travel (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('inspire_coach', 'external_coach', 'train', 'car', 'local')),
  -- Only drivers give a registration; it's cleared for every other answer.
  car_registration text check (
    (mode = 'car' and char_length(car_registration) between 2 and 10)
    or (mode <> 'car' and car_registration is null)
  ),
  updated_at timestamptz not null default now()
);
alter table public.delegate_travel enable row level security;

-- Only approved accounts can answer, and only for themselves.
create or replace function public.can_answer_travel()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'approved')
$$;

drop policy if exists "travel: read own or staff" on public.delegate_travel;
drop policy if exists "travel: answer own" on public.delegate_travel;
drop policy if exists "travel: change own" on public.delegate_travel;
create policy "travel: read own or staff" on public.delegate_travel
  for select using (user_id = auth.uid() or public.has_access('review_accounts') or public.has_access('manage_people'));
create policy "travel: answer own" on public.delegate_travel
  for insert with check (user_id = auth.uid() and public.can_answer_travel());
create policy "travel: change own" on public.delegate_travel
  for update using (user_id = auth.uid() and public.can_answer_travel())
  with check (user_id = auth.uid());

grant select, insert, update on public.delegate_travel to authenticated;
grant execute on function public.can_answer_travel() to authenticated;
