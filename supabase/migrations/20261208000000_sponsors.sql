-- =====================================================================
-- Sponsors.
--
--   * Committee members who can edit the website add, edit, hide and
--     reorder sponsors on the Sponsors page of the dashboard.
--   * Published sponsors are listed on /sponsors, along the foot of every
--     page and on the home page. Those marked "show on Delegate Cards"
--     also appear, small, on the back of every Delegate Card.
--   * Starts with the two 2026 sponsors. Upload their logos from the
--     dashboard; until then their names are shown instead.
--   * Safe to run more than once.
-- =====================================================================

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  contribution text not null default '',
  description text,
  url text,
  logo_url text,
  show_on_card boolean not null default true,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sponsors enable row level security;

drop policy if exists "sponsors: public read" on public.sponsors;
create policy "sponsors: public read" on public.sponsors for select using (published or public.is_editor());
drop policy if exists "sponsors: editors write" on public.sponsors;
create policy "sponsors: editors write" on public.sponsors for all using (public.is_editor()) with check (public.is_editor());

drop trigger if exists sponsors_touch on public.sponsors;
create trigger sponsors_touch before update on public.sponsors for each row execute function public.touch_updated_at();

insert into public.sponsors (name, contribution, description, url, sort)
select v.name, v.contribution, v.description, v.url, v.sort
  from (values
    ('Royal College of Physicians and Surgeons of Glasgow',
     'Materials for delegates and 2 × £25 Amazon vouchers',
     'The Royal College supports doctors, surgeons, dentists and allied professionals through training, examinations and professional development.',
     'https://rcpsg.ac.uk', 10),
    ('Geeky Medics',
     '2 × 12-month Clinical Skills Plan subscriptions',
     'Clinical skills, OSCE and revision resources used by medical students and doctors around the world.',
     'https://geekymedics.com', 20)
  ) as v(name, contribution, description, url, sort)
 where not exists (select 1 from public.sponsors s where lower(s.name) = lower(v.name));
