-- Registration and the main lecture theatre are in the Isaac Newton Building,
-- which is now the main venue. LMS005 stays in the Ross Lucas building.
update public.map_places
   set parent_id = (select id from public.map_places where slug = 'inb'),
       description = 'Check in here when you arrive. The exact spot will be confirmed.'
 where slug = 'registration';

update public.map_places
   set parent_id = (select id from public.map_places where slug = 'inb'),
       description = 'Welcome, keynotes and closing. The room will be confirmed.'
 where slug = 'main-theatre';

update public.map_places
   set description = 'The main INSPIRE venue: registration, the main lecture theatre and the first group of oral presentations (five speakers). Rooms will be confirmed.',
       sort = 0
 where slug = 'inb';

update public.map_places
   set description = 'Home of Lincoln Medical School. The second group of oral presentations is in LMS005.',
       sort = 4
 where slug = 'lms';

update public.rooms
   set building = 'Isaac Newton Building (INB)'
 where name = 'Main lecture theatre (to be confirmed)';
