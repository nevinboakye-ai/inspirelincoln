-- =====================================================================
-- Campus map: things to see in Lincoln.
--
--   * Eleven of the city's sights, from the Castle and Steep Hill to the
--     Arboretum and Ellis Mill, listed under "Things to see in Lincoln"
--     next to the cathedral and the stations.
--   * Locations are from the Historic England listings of each building.
--   * Safe to run more than once: places already added (by slug) are left
--     as they are.
-- =====================================================================

insert into public.map_places (slug, name, code, kind, description, lat, lng, directions, location_confirmed, published, sort)
values
  ('lincoln-castle', 'Lincoln Castle', 'CAST', 'landmark',
   'Built by William the Conqueror in 1068. Walk the medieval walls for views across the city, and see one of the four surviving copies of the 1215 Magna Carta. Paid entry.',
   53.23457, -0.539708, null, true, true, 30),
  ('bishops-palace', 'Lincoln Medieval Bishop''s Palace', 'PAL', 'landmark',
   'The ruins of the medieval palace of the Bishops of Lincoln, just south of the cathedral, with terraced gardens and views over the lower city. Run by English Heritage.',
   53.233002, -0.53645, null, true, true, 31),
  ('steep-hill', 'Steep Hill', 'HILL', 'landmark',
   'The cobbled street that climbs from the city centre to the Cathedral Quarter, lined with independent shops, tearooms and some of England''s oldest houses. It lives up to its name.',
   53.2332, -0.5385, null, true, true, 32),
  ('jews-house', 'Jew''s House', 'JH', 'landmark',
   'One of the oldest town houses in England still in use, built in the 12th century, near the foot of Steep Hill.',
   53.232168, -0.538771, null, true, true, 33),
  ('newport-arch', 'Newport Arch', 'ARCH', 'landmark',
   'A 3rd-century Roman gateway at the north end of Bailgate, and the only Roman arch in Britain that traffic still drives through.',
   53.237247, -0.538044, null, true, true, 34),
  ('lincoln-museum', 'Lincoln Museum and Usher Gallery', 'MUS', 'landmark',
   'The city''s museum of archaeology and history, with the Usher Gallery''s art collection next door, on Danes Terrace below the cathedral. Free entry.',
   53.2321, -0.5368, null, true, true, 35),
  ('lincoln-arboretum', 'Lincoln Arboretum', 'ARB', 'landmark',
   'A Victorian park opened in 1872, with a lake, a bandstand and terraced walks up the hillside. Free to visit.',
   53.231176, -0.526834, null, true, true, 36),
  ('high-bridge', 'High Bridge', 'BRG', 'landmark',
   'A medieval bridge over the River Witham from about 1160, with Tudor timber-framed shops on top: the oldest bridge in Britain that still has buildings on it.',
   53.228543, -0.540812, null, true, true, 37),
  ('stonebow', 'Stonebow and Guildhall', 'GATE', 'landmark',
   'The Tudor gateway over the High Street, with the city''s Guildhall above it, where Lincoln''s council still meets.',
   53.229231, -0.540474, null, true, true, 38),
  ('museum-of-lincolnshire-life', 'Museum of Lincolnshire Life', 'LIFE', 'landmark',
   'The story of everyday life in the county, from shops and trades to farming and war, in a 19th-century barracks on Burton Road.',
   53.237881, -0.544346, null, true, true, 39),
  ('ellis-mill', 'Ellis Mill', 'MILL', 'landmark',
   'A working windmill from 1798, the last of the many that once lined the ridge above the city. Check opening times before you go.',
   53.238161, -0.546674, null, true, true, 40)
on conflict (slug) do nothing;
