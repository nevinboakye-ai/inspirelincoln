-- =====================================================================
-- Booked rooms, catering and on-the-day details from the University.
--
--   * Every room the University has booked is added to the rooms list (so
--     sessions can be set to it) and to the campus map, under its building:
--     INB0113 Atrium, INB0114 Lecture Theatre, LMS0005, LMS0008, LMS0011,
--     LMS2002 to LMS2009 and LMS2011.
--   * "Main lecture theatre (to be confirmed)" becomes INB0114 Lecture
--     Theatre, the only lecture theatre booked, so the welcome, keynotes and
--     closing point to it. LMS005 is renamed LMS0005, the University's code.
--   * A prayer room is added under LMS. Its room is set in the dashboard
--     once the committee picks a spare LMS room.
--   * Catering times and menus are added to the breaks, the registration
--     spot (in INB, in front of the café) is confirmed, and three FAQs are
--     added for the day: food, arriving and the prayer room.
--   * Two sights move to their OpenStreetMap positions.
--   * Safe to run more than once.
-- =====================================================================

-- Rooms -----------------------------------------------------------------
update public.rooms
   set name = 'INB0114 Lecture Theatre',
       building = 'Isaac Newton Building (INB)',
       directions = 'Follow the INSPIRE signs from the registration desk.'
 where name = 'Main lecture theatre (to be confirmed)';

update public.rooms
   set name = 'LMS0005', floor = coalesce(floor, 'Ground floor')
 where name = 'LMS005';

insert into public.rooms (edition_id, name, building, floor, sort)
select e.id, r.name, r.building, r.floor, r.sort
  from (select id from public.editions where year = 2026) e
 cross join (values
   ('INB0113 Atrium', 'Isaac Newton Building (INB)', null, 3),
   ('LMS0008', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Ground floor', 10),
   ('LMS0011', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Ground floor', 11),
   ('LMS2002', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 12),
   ('LMS2003', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 13),
   ('LMS2004', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 14),
   ('LMS2005', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 15),
   ('LMS2006', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 16),
   ('LMS2007', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 17),
   ('LMS2008', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 18),
   ('LMS2009', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 19),
   ('LMS2011', 'Ross Lucas Medical Sciences Building (Lincoln Medical School)', 'Second floor', 20)
 ) as r(name, building, floor, sort)
 where not exists (select 1 from public.rooms x where x.edition_id = e.id and x.name = r.name);

-- Map places --------------------------------------------------------------
update public.map_places
   set name = 'Registration desk and catering',
       description = 'Check in here when you arrive. All food and drinks are served here, in front of the café: breakfast 8:00 to 9:00, a mid-morning break 9:45 to 10:00, lunch 11:30 to 12:45 and afternoon refreshments 14:15 to 14:40.',
       directions = 'In the Isaac Newton Building, in front of the café. Follow the INSPIRE signs and volunteers on arrival.',
       location_confirmed = true
 where slug = 'registration';

update public.map_places
   set name = 'INB0114 Lecture Theatre', code = 'INB0114',
       description = 'Welcome, keynotes and closing.',
       location_confirmed = true
 where slug = 'main-theatre';

update public.map_places
   set name = 'LMS0005', code = 'LMS0005',
       description = 'Oral presentations, second group (four speakers). Ground floor.'
 where slug = 'lms005';

update public.map_places
   set description = 'The main INSPIRE venue: the registration desk, all food and drinks (in front of the café), the INB0114 Lecture Theatre and the first group of oral presentations (five speakers).'
 where slug = 'inb';

update public.map_places
   set description = 'Home of Lincoln Medical School. The second group of oral presentations is in LMS0005, with workshops in the other booked rooms. A1 signs outside point the way from the Isaac Newton Building.'
 where slug = 'lms';

insert into public.map_places (slug, name, code, kind, description, parent_id, room_id, directions, location_confirmed, published, sort)
select p.slug, p.name, p.code, 'room', p.description,
       (select id from public.map_places where slug = p.parent),
       (select r.id from public.rooms r join public.editions e on e.id = r.edition_id and e.year = 2026 where r.name = p.room limit 1),
       p.directions, p.confirmed, true, p.sort
  from (values
   ('inb0113', 'INB0113 Atrium', 'INB0113', 'Booked for INSPIRE 2026.', 'inb', 'INB0113 Atrium', null, true, 3),
   ('lms0008', 'LMS0008', 'LMS0008', 'Booked for INSPIRE 2026. Ground floor.', 'lms', 'LMS0008', null, true, 10),
   ('lms0011', 'LMS0011', 'LMS0011', 'Booked for INSPIRE 2026. Ground floor.', 'lms', 'LMS0011', null, true, 11),
   ('lms2002', 'LMS2002', 'LMS2002', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2002', null, true, 12),
   ('lms2003', 'LMS2003', 'LMS2003', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2003', null, true, 13),
   ('lms2004', 'LMS2004', 'LMS2004', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2004', null, true, 14),
   ('lms2005', 'LMS2005', 'LMS2005', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2005', null, true, 15),
   ('lms2006', 'LMS2006', 'LMS2006', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2006', null, true, 16),
   ('lms2007', 'LMS2007', 'LMS2007', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2007', null, true, 17),
   ('lms2008', 'LMS2008', 'LMS2008', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2008', null, true, 18),
   ('lms2009', 'LMS2009', 'LMS2009', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2009', null, true, 19),
   ('lms2011', 'LMS2011', 'LMS2011', 'Booked for INSPIRE 2026. Second floor.', 'lms', 'LMS2011', null, true, 20),
   ('prayer-room', 'Prayer room', null, 'A quiet room for prayer and reflection, in one of the spare LMS rooms. Signs on the day show the way.', 'lms', null,
    'Ask at the registration desk or follow the prayer room signs in the Ross Lucas building.', false, 21)
 ) as p(slug, name, code, description, parent, room, directions, confirmed, sort)
on conflict (slug) do nothing;

-- Sights moved to their OpenStreetMap positions.
update public.map_places set lat = 53.231854, lng = -0.537428 where slug = 'lincoln-museum';
update public.map_places set lat = 53.23784, lng = -0.544978 where slug = 'museum-of-lincolnshire-life';

-- Programme: catering in the breaks ---------------------------------------
update public.sessions s set description = v.description
  from (values
   ('breakfast', 'Arrive, collect your badge at the registration desk in the Isaac Newton Building and have breakfast: tea, coffee, water and breakfast pastries, served in front of the café.'),
   ('refreshment-break', 'Tea, coffee and water, served in the Isaac Newton Building in front of the café.'),
   ('lunch-and-posters', 'Lunch alongside the poster exhibition: a sandwich or wrap, crisps and fruit, with tea, coffee and juices, served in the Isaac Newton Building in front of the café. Presenters stand with their posters to discuss their work with delegates and judges.'),
   ('afternoon-break', 'Afternoon refreshments in the Isaac Newton Building, in front of the café: tea, coffee, water, biscuits and bite-sized cakes. Then move to your next workshop.')
 ) as v(slug, description), public.editions e
 where s.slug = v.slug and s.edition_id = e.id and e.year = 2026;

update public.sessions s
   set title = replace(s.title, 'LMS005', 'LMS0005'),
       description = replace(s.description, 'LMS005 ', 'LMS0005 ')
  from public.editions e
 where s.edition_id = e.id and e.year = 2026
   and s.slug in ('oral-presentations-lms005', 'oral-presentations-inb');

-- FAQs ------------------------------------------------------------------
insert into public.faqs (edition_id, question, answer, category, sort, published)
select e.id, f.question, f.answer, 'On the day', f.sort, true
  from (select id from public.editions where year = 2026) e
 cross join (values
   ('Is food provided?', 'Yes. Everything is served in the Isaac Newton Building, in front of the café: tea, coffee, water and breakfast pastries from 8:00 to 9:00; tea, coffee and water from 9:45 to 10:00; lunch from 11:30 to 12:45 (a sandwich or wrap, crisps and fruit, with tea, coffee and juices); and tea, coffee, water, biscuits and bite-sized cakes from 14:15 to 14:40. Tell us about any dietary needs when you register.', 6),
   ('Where do I go when I arrive?', 'Go to the registration desk in the Isaac Newton Building (INB) to collect your badge. Sessions run in INB and the Ross Lucas Medical Sciences Building (LMS) next door, and A1 signs outside point the way between the two.', 7),
   ('Is there a prayer room?', 'Yes. A quiet room in the Ross Lucas Medical Sciences Building (LMS) is set aside for prayer and reflection, with signs on the day. Ask at the registration desk if you can''t find it.', 8)
 ) as f(question, answer, sort)
 where not exists (select 1 from public.faqs x where x.question = f.question and x.edition_id = e.id);
