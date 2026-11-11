-- =====================================================================
-- Campus map: the places delegates arrive at, and the city's best-known
-- sight, so they can find their way in from town.
--
--   * Lincoln Central railway station, Lincoln Central bus station and
--     Lincoln Cathedral, as landmarks with verified locations.
--   * Safe to run more than once: places the committee has already added
--     (by the same slug) are left as they are.
-- =====================================================================

insert into public.map_places (slug, name, code, kind, description, lat, lng, directions, location_confirmed, published, sort)
values
  ('lincoln-station', 'Lincoln Central railway station', 'RAIL', 'landmark',
   'Lincoln''s railway station, in the city centre. Trains run from London King''s Cross (direct, or change at Newark), Nottingham and Sheffield. Campus is under 10 minutes away on foot.',
   53.22628, -0.53963,
   'Leave by the main entrance on St Mary''s Street and head west towards the Brayford Pool waterfront.',
   true, true, 20),
  ('lincoln-bus-station', 'Lincoln Central bus station', 'BUS', 'landmark',
   'The city''s main bus station, beside the railway station. Local and regional buses and coaches stop here. Campus is about 10 minutes away on foot.',
   53.22632, -0.53791, null, true, true, 21),
  ('lincoln-cathedral', 'Lincoln Cathedral', 'CATH', 'landmark',
   'Lincoln''s medieval cathedral, at the top of the hill in the old city. About 25 minutes from campus on foot, the last part up Steep Hill. Worth a visit if you have time before or after the conference.',
   53.23426, -0.53625, null, true, true, 22)
on conflict (slug) do nothing;
