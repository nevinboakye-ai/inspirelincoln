-- Campus map places for the interactive map at /map.
-- Coordinates are optional: a place without coordinates is listed but not pinned,
-- so nothing is ever placed on the map without a verified location.

create table if not exists public.map_places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  code text,
  kind text not null default 'building' check (kind in ('venue', 'room', 'building', 'landmark', 'amenity')),
  description text not null default '',
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  parent_id uuid references public.map_places (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  directions text,
  location_confirmed boolean not null default false,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint map_places_lat_lng_together check ((lat is null) = (lng is null)),
  constraint map_places_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists map_places_parent_idx on public.map_places (parent_id);

alter table public.map_places enable row level security;
drop policy if exists "map_places: public read" on public.map_places;
create policy "map_places: public read" on public.map_places for select using (published or public.is_editor());
drop policy if exists "map_places: editors write" on public.map_places;
create policy "map_places: editors write" on public.map_places for all using (public.is_editor()) with check (public.is_editor());

drop trigger if exists map_places_audit on public.map_places;
create trigger map_places_audit after insert or update or delete on public.map_places for each row execute function public.audit_row_change();

grant select on public.map_places to anon, authenticated;
grant insert, update, delete on public.map_places to authenticated;
