-- Pins the main venue on the campus map. The point is the centre of the
-- Lincoln Medical School (Ross Lucas Medical Sciences Building) outline in
-- OpenStreetMap. Only fills it in if nobody has set a location yet.
update public.map_places
   set lat = 53.227703, lng = -0.549729
 where slug = 'lms' and lat is null;
