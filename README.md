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

**Public site:** home, about, Conference 2026 (with FAQs, venue and calendar
download), interactive programme (timeline, cards and personal agenda with
conflict detection, filters, search, .ics export), speakers, workshops,
Research & Abstracts hub and showcase, opportunities, gallery with lightbox,
archive by year, contact form, conference-day page, privacy, cookies,
accessibility and terms pages, ⌘K search with a guided conference assistant,
sitemap, robots, Open Graph images and verified-only structured data.

**Delegate portal (`/portal`):** registration status and a check-in QR code
(contains a reference only), saved agenda synced across devices,
announcements, abstract submission with live word counts and drafts, presenter
portal with decisions and secure poster upload, profile and account deletion.

**Reviewer dashboard (`/review`):** blind review of assigned abstracts against a
configurable weighted rubric, with drafts and locked submission.

**Admin dashboard (`/admin`):** live statistics; conference settings (status,
times, registration link, event-day and post-event modes, poster deadline and
requirements, abstract call configuration); managers for sessions, speakers,
workshops, rooms, announcements, FAQs, opportunities, gallery, resources,
institutions, committee, history timeline and editions; abstract management
(assign reviewers, compare scores, decisions, showcase publishing, CSV export);
review criteria; posters; registrations (with CSV export); QR check-in desk;
users and roles; contact enquiries; audit log.

**Roles:** `delegate` (portal), `reviewer` (+ assigned reviews), `editor`
(+ public content and settings), `admin` (everything, including personal data).
Every rule is enforced twice: in server code and by Postgres row level security.

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
   2. `supabase/seed.sql` (the 2026 edition, provisional programme, six workshops, FAQs and review criteria)

   Or, with the Supabase CLI: `supabase link` then `supabase db push` and run the seed file.
   The seed is generated from `src/content/seed.ts` with `npx -y tsx scripts/generate-seed.ts`.
2. **Authentication → URL Configuration:** set *Site URL* to `https://inspirelincoln.uk` and add
   `https://inspirelincoln.uk/auth/callback` (and your Vercel preview URL pattern, e.g.
   `https://*-<team>.vercel.app/auth/callback`) to *Redirect URLs*. Email confirmation and
   password reset links depend on this.
3. **Authentication → Emails:** Supabase's built-in email sender is rate-limited and meant for testing.
   Before opening sign-ups to delegates, add custom SMTP (Resend works well) under *SMTP Settings*.
4. **Make yourself an admin.** Sign up on the site, then run in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   After that, manage everyone else's roles from **Admin → Users & roles**.

## Deploy to Vercel and point the domain

1. In Vercel, **Add New → Project**, import `nevinboakye-ai/inspirelincoln`. The framework is
   detected automatically; no build settings need changing.
2. Add the environment variables from `.env.example` (at minimum `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Mark
   `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` as sensitive.
3. Deploy, check the preview, then under **Settings → Domains** add `inspirelincoln.uk` and
   `www.inspirelincoln.uk`.
4. At Spaceship (DNS for the domain), replace the GitHub Pages records with the ones Vercel shows.
   Typically: remove the four `185.199.108–111.153` A records and add an A record for `@` pointing to
   Vercel's IP, and change the `www` CNAME to Vercel's target. Use the exact values on the Vercel
   Domains page, as Vercel may give project-specific ones.
5. Once the domain shows as valid in Vercel, turn off GitHub Pages for the repository
   (**Settings → Pages**). The `CNAME` file in the repo is only used by GitHub Pages and can then be deleted.

## External services and credentials

| Service | What for | Required? | Where the credential goes |
| --- | --- | --- | --- |
| Supabase | Database, sign-in, file storage | Yes, for anything beyond static pages | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel |
| Supabase service role key | Lets delegates delete their own account | Recommended | `SUPABASE_SERVICE_ROLE_KEY` in Vercel only (server-side) |
| Vercel | Hosting | Yes | — |
| Spaceship | DNS for inspirelincoln.uk | Yes | DNS records only |
| Resend | Contact form email notifications; recommended SMTP for auth emails | Optional | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` in Vercel; SMTP in Supabase |
| External registration platform | Ticketing, if used | Optional | Paste the link in Admin → Conference settings |

The sending domain for `EMAIL_FROM` must be verified in Resend (add the DNS records Resend gives you at Spaceship).

Never commit secrets or paste the service role key anywhere public.

## Running the conference from the admin dashboard

- **Before registration opens:** in *Conference settings*, set the status to "Registration opening soon".
  When it opens, add the registration link and set "Registration open". The header button,
  homepage and Conference page update straight away.
- **Abstracts:** tick "Accept new abstract submissions" and adjust word limits, categories and
  eligibility. Add reviewers under *Users & roles*, check *Review criteria*, then assign reviewers
  from each abstract. Record decisions there; authors see them in their portal. Accepted authors
  who consented can be published to the showcase.
- **Programme:** set start/end times in settings to enable the precise countdown and calendar
  files. Add times, rooms and speakers to sessions as they are confirmed; untimed sessions are
  labelled provisional.
- **Registrations:** delegates create an account; add them under *Registrations* by their account email.
  Confirmed delegates get a QR code.
- **On the day:** turn on *Event-day mode*, open *Check-in* on a phone or laptop at the desk and scan
  QR codes (camera scanning works in Chrome/Edge on Android; manual code entry works everywhere).
- **Afterwards:** set status to "Conference concluded" and turn on *Post-conference mode*. Add
  gallery images and archive highlights. For the next year, create a new edition and switch to it.
- **Retention:** delete contact enquiries once resolved (the privacy page says within 12 months).

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
