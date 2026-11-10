-- More switches for the site owner. All start off.
--   site_open      : the public website. While off, visitors only reach the log in
--                    and account set-up pages, and delegates only reach My Hub.
--                    Committee members and the site owner still see everything.
--   delegate_card  : the Delegate Card in My Hub.
--   map_open       : the campus map. While off it shows "Coming soon".
insert into public.site_switches (key, enabled) values
  ('site_open', false), ('delegate_card', false), ('map_open', false)
on conflict do nothing;
