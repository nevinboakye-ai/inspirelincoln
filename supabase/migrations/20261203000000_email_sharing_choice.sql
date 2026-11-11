-- =====================================================================
-- Asking everyone once whether to show their email to other delegates.
--
--   * Email stays hidden unless someone chooses to share it.
--   * After signing in, anyone who hasn't made that choice yet is asked
--     once, in the "finish your profile" prompt. Either answer is saved,
--     and they can change it any time on their profile.
--   * People who already share their email have made their choice.
-- =====================================================================

alter table public.profiles add column if not exists network_email_asked boolean not null default false;
update public.profiles set network_email_asked = true where network_show_email and not network_email_asked;
