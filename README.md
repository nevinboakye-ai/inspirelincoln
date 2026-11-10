# INSPIRE National Medical Research Conference website

The website, delegate portal, abstract system and admin dashboard for INSPIRE.
The 2026 edition, **Digital Health: From Innovation to Evidence**, takes place on
Saturday 21 November 2026 at Lincoln Medical School, University of Lincoln.

Built with Next.js (App Router, TypeScript), Tailwind CSS, Motion, Supabase
(database, auth and file storage) and deployed on Vercel.

- [What's included](#whats-included)
- [Run it locally](#run-it-locally)
- [Set up Supabase](#set-up-supabase)
- [Deploy to Vercel and point the domain](#deploy-to-vercel-and-point-the-domain)
- [External services and credentials](#external-services-and-credentials)
- [Running the conference from the admin dashboard](#running-the-conference-from-the-admin-dashboard)
- [Content rules](#content-rules)
- [Project structure](#project-structure)
- [Testing](#testing) (full report in [docs/TESTING.md](docs/TESTING.md))

## What's included

The public site is deliberately small and built for phones, since most people use it on the day:
home, programme (with a personal agenda and calendar export), campus map, speakers, venue and
FAQs, about, contact and the legal pages. Phones get a bottom bar with Home, Programme, Map and
My ticket.

**Accounts.** Everyone registers with an account type: delegate, oral presenter, poster
presenter, supporting committee, executive committee, vice president or president. New accounts
are *awaiting review* until the committee approves, waitlists or declines them. Waitlisted people
see their place in the queue.

**Portal (`/portal`).** Ticket QR code once approved, account status, saved agenda,
announcements, profile, access and dietary needs (with explicit consent), email and photography
choices, a full data download and account deletion. Oral presenters upload slides (PDF,
PowerPoint or Keynote) and poster presenters upload posters (PDF, PNG or JPG), up to 50 MB, with
versions and committee feedback.

**Committee dashboard (`/admin`).** What each person sees depends on their permissions. The
defaults by account type are:

| Permission | Who has it by default |
| --- | --- |
| Edit the website (programme, speakers, committee, map, FAQs, announcements, settings) | Supporting committee and above |
| Review slides and posters | Supporting committee and above |
| Review accounts (approve, waitlist or decline) | Executive committee and above |
| Delegate records (registrations, abstracts, enquiries, audit log) | Executive committee and above |
| Check-in desk | Executive committee and above |
| Approve committee accounts | President and vice president |
| Group emails | President and vice president |

**Platform dashboard (`/admin/platform`).** Only the site owner (site role `admin`) sees it. The
owner always has every permission and can:

- switch any permission on or off for a whole account type,
- allow or block a single permission for one person (for example, let a delegate volunteer
  run the check-in desk),
- jump straight to editing committee profiles, accepting accounts and reviewing submissions,
- see recent permission changes, which are all written to the audit log.

Signed-in editors also get an "Edit this page" shortcut on the public pages.

Every rule is enforced twice: in server code and by Postgres row level security
(`supabase/tests/rls.test.sql`).

The site works without Supabase too: public pages fall back to the bundled
content in `src/content/seed.ts`, and sign-in features show as unavailable.

## Run it locally

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev                  # http://localhost:3000
```

Other commands: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test`.

## Set up Supabase

1. In the Supabase dashboard, open **SQL Editor** and run, in order:
   1. `supabase/migrations/20261110000000_initial_schema.sql` (tables, security policies, storage buckets)
   2. `supabase/migrations/20261110010000_map_places.sql` (campus map places)
   3. `supabase/migrations/20261111000000_accounts_and_submissions.sql` (account types and review,
      slide and poster submissions, feedback, consent records, group email log)
   4. `supabase/migrations/20261112000000_site_owner.sql` (site owner above the president)
   5. `supabase/migrations/20261113000000_access_control.sql` (permissions the site owner can
      change from the platform dashboard)
   6. `supabase/migrations/20261114000000_delegate_network.sql` (the selected delegate list, which
      approves listed people as soon as they set up their account, and the delegate network)
   7. `supabase/seed.sql` (the 2026 edition, confirmed timetable, rooms, committee, map places, FAQs)

   The selected delegate list itself is personal data, so it is never committed here. Load it
   from the private SQL file the committee holds, or add people one at a time from
   Committee dashboard > Accounts > Selected delegates.

   **Database already set up?** Run only the ones you haven't run yet. Existing accounts are
   marked approved by migration 3, so nobody loses access.

   Or, with the Supabase CLI: `supabase link` then `supabase db push` and run the seed file.
   The seed is generated from `src/content/seed.ts` with `npx -y tsx scripts/generate-seed.ts`.
2. **Authentication → URL Configuration:** set *Site URL* to `https://inspirelincoln.uk` and add
   `https://inspirelincoln.uk/**` (and your Vercel preview pattern, e.g.
   `https://*-<team>.vercel.app/**`) to *Redirect URLs*.
3. **Send auth emails from inspirelincoln.uk.** In Resend, add the domain `inspirelincoln.uk` and
   add the DNS records it shows at Spaceship. Then in Supabase, **Authentication → Emails → SMTP
   Settings**, turn on custom SMTP:
   host `smtp.resend.com`, port `465`, username `resend`, password a Resend API key,
   sender email `noreply@inspirelincoln.uk`, sender name `INSPIRE`.
4. **Branded email templates.** In **Authentication → Emails → Templates**, for each template paste
   the subject from `supabase/templates/SUBJECTS.md` and the body from the matching file in
   `supabase/templates/` (confirm sign up, reset password, magic link, change email, invite,
   reauthentication). Links go through `/auth/confirm`, so they work even when opened in a
   different browser. Regenerate with `npx -y tsx scripts/generate-email-templates.ts`.
5. **Make the site owner.** Sign up on the site with your committee account type, then run in the SQL editor:
   ```sql
   update public.profiles set role = 'admin', account_status = 'approved' where email = 'you@example.com';
   ```
   From then on, approve everyone else from **Committee dashboard → Accounts**.

## Deploy to Vercel and point the domain

1. In Vercel, **Add New → Project**, import `nevinboakye-ai/inspirelincoln`. The framework is
   detected automatically; no build settings need changing.
2. Add the environment variables from `.env.example` (at minimum `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Mark
   `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` as sensitive.
3. Deploy, check the preview, then under **Settings → Domains** add `inspirelincoln.uk` and
   `www.inspirelincoln.uk`.
4. At Spaceship (DNS for the domain), replace the GitHub Pages records with the ones Vercel shows.
   Typically: remove the four `185.199.108.153` to `185.199.111.153` A records and add an A record for `@` pointing to
   Vercel's IP, and change the `www` CNAME to Vercel's target. Use the exact values on the Vercel
   Domains page, as Vercel may give project-specific ones.
5. Once the domain shows as valid in Vercel, turn off GitHub Pages for the repository
   (**Settings → Pages**). The `CNAME` file in the repo is only used by GitHub Pages and can then be deleted.

## External services and credentials

| Service | What for | Required? | Where the credential goes |
| --- | --- | --- | --- |
| Supabase | Database, sign-in, file storage | Yes, for anything beyond static pages | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel |
| Supabase service role key | Faster account deletion (a database function covers it otherwise) | Optional | `SUPABASE_SERVICE_ROLE_KEY` in Vercel only (server-side) |
| Vercel | Hosting | Yes | Not needed |
| Spaceship | DNS for inspirelincoln.uk | Yes | DNS records only |
| Resend | Sign-up and password emails (via Supabase SMTP), account decisions, feedback, group emails, contact form | Strongly recommended | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` in Vercel; SMTP in Supabase |
| Privacy notice | Shows where Supabase stores data | Recommended | `NEXT_PUBLIC_DATA_REGION` in Vercel, e.g. `London (eu-west-2)` |
| External registration platform | Ticketing, if used | Optional | Paste the link in Admin → Conference settings |

The sending domain for `EMAIL_FROM` must be verified in Resend (add the DNS records Resend gives you at Spaceship).

Never commit secrets or paste the service role key anywhere public.

## Running the conference from the committee dashboard

- **Accounts:** new registrations wait under *Accounts → Awaiting review*. Check the details, change
  the account type if needed, then approve, waitlist or decline. Ticking "Email them" sends a
  branded email with your optional note. Approving confirms their place and gives them a ticket.
- **Slides and posters:** under *Submissions*, open one to preview it, then comment, request
  changes or approve. The presenter is emailed and sees the feedback, with your name and position,
  in their portal.
- **Group emails (president and vice president):** under *Group email*, pick account types and
  statuses, choose "Conference update" or "News or promotion" (promotional emails only go to people
  who opted in, as the law requires), count recipients, send yourself a test, then send.
- **Programme:** set start/end times in settings to enable the precise countdown and calendar
  files. Add times, rooms and speakers to sessions as they are confirmed; untimed sessions are
  labelled provisional.
- **Campus map:** under *Map places*, click the map to pin a place or drag its pin. Only pin what you
  have checked on site. The Ross Lucas Medical Sciences Building (LMS) ships without a pin because no
  published coordinates were available; pin it once and LMS005 and the other rooms inside it use the
  same pin. Link a place to a programme room to list that room's sessions on the map. Tick
  "Location confirmed" when a room is final. Map tiles come from CARTO (OpenStreetMap data) and load
  in the visitor's browser.
- **On the day:** turn on *Event-day mode*, open *Check-in* on a phone or laptop at the desk and scan
  QR codes (camera scanning works in Chrome/Edge on Android; manual code entry works everywhere).
- **Afterwards:** set status to "Conference concluded" and turn on *Post-conference mode*.
  For the next year, create a new edition and switch to it.
- **Retention:** the privacy notice promises deletion dates: contact enquiries within 12 months,
  access and dietary needs by 28 February 2027, tickets and submissions by 31 March 2027, audit
  logs after 24 months. Diarise these.

## Content rules

Nothing on the site is invented. Speakers, sponsors, attendance figures and session times only
appear once added in the admin dashboard. Where information isn't confirmed the site says so
("to be confirmed", "projected", or a clearly labelled placeholder). Institutions are described by
their actual relationship, without implying endorsement. Only verified history milestones are shown.

## Project structure

```
src/app            routes (public pages, /portal, /review, /admin, auth)
src/components     UI, grouped by area
src/content        bundled fallback content (seed) and theme topics
src/lib            data access, auth, validation, time zones, calendar, admin registry
supabase/          migration, seed and row level security tests
tests/             unit tests (Vitest)
docs/TESTING.md    testing report
```

## Testing

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Row level security tests: apply the migration and seed to a disposable database, then
`psql "$DATABASE_URL" -f supabase/tests/rls.test.sql`. It ends with `ALL RLS TESTS PASSED`.
See [docs/TESTING.md](docs/TESTING.md) for what was tested and what still needs checking.
