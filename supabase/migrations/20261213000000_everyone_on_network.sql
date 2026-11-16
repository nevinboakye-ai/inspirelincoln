-- =====================================================================
-- Everyone is on the delegate network.
--
-- Delegates could untick "List me on the delegate network" to hide
-- their card. That choice has been removed from the site, so:
--
--   * everyone who had hidden themselves is listed again;
--   * the column can no longer be set to false, so nobody can be
--     hidden from the network by an old page or a direct API call.
--
-- Only approved accounts with a name still appear, as before. The
-- separate choices (showing your email, and being open to messages)
-- are unchanged.
--
-- Safe to run more than once.
-- =====================================================================

update public.profiles set network_listed = true where network_listed is distinct from true;

alter table public.profiles alter column network_listed set default true;

alter table public.profiles drop constraint if exists profiles_network_listed_always;
alter table public.profiles add constraint profiles_network_listed_always check (network_listed);
