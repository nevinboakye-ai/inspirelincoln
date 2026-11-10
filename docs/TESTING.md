# Testing report

Date: 10 November 2026. Branches: `site-v1`, then `site-v2` (redesign and campus map).

Everything below was run against a production build (`next build` + `next start`) connected to a
local Supabase stack (Supabase CLI, Postgres 17, the same migration and seed as production).
Nothing has yet been tested against the live Supabase project or on Vercel; see
[Still to check after deployment](#still-to-check-after-deployment).

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Type check (strict) | `npm run typecheck` | Pass, no errors |
| Lint | `npm run lint` | Pass, 0 errors. 14 warnings from React Compiler advisory rules (effects that read browser-only state after hydration, deliberately) |
| Unit tests | `npm test` | 16/16 pass: campus map distances, walking times and directions links, seed map places never half-pinned; UK time zone conversion (GMT and BST), admin date round-trip, agenda conflict detection, abstract word limits and consent rules, category validation, iCalendar output and escaping, CSV quoting and formula-injection protection |
| Production build | `npm run build` | Pass. Public pages are static with timed revalidation; portal, review and admin are server-rendered per request |
| Row level security | `psql -f supabase/tests/rls.test.sql` | ALL RLS TESTS PASSED, on plain Postgres 16 and on the real Supabase stack (run in a rolled-back transaction) |
| Accessibility (axe-core, WCAG 2.0/2.1/2.2 A and AA rules) | 30 pages including /map and the admin map editor, signed out and signed in as admin, reduced motion | 0 violations after fixes (see below) |
| Mobile layout (iPhone 13 emulation) | 16 pages incl. portal, review, admin, campus map | No horizontal overflow |

The RLS suite covers 29 checks plus several expected-failure cases, including: anonymous visitors can read published content only
and can submit contact enquiries but not read them; delegates see only their own registration,
agenda and abstracts; authors can't change decision fields or edit after submission (only withdraw);
reviewers see only abstracts assigned to them and can't change a submitted review; editors manage
content but can't read personal data; only admins can change roles, check people in, or read
enquiries and the audit log; private abstract and poster files are readable only by their owner and
admins; the contact form is rate-limited per email address.

## End-to-end journeys (Playwright, real browser)

| Journey | Result |
| --- | --- |
| Delegate signs in, opens the abstract form, submits incomplete: errors shown and entered values (including category and consent boxes) are kept | Pass |
| Delegate completes and submits; gets a reference number; submission time recorded | Pass |
| Delegate saves a draft, edits it and saves again | Pass |
| Admin dashboard shows live counts from the database | Pass |
| Admin assigns a reviewer (abstract moves to "Under review") | Pass |
| Admin adds a registration by account email | Pass |
| Admin sets start/end times, status and registration link in Conference settings | Pass |
| Admin creates a session at 09:15 UK time; stored correctly and shown back as 09:15 | Pass |
| Admin form rejects an invalid URL slug with a clear message | Pass |
| Reviewer sees the assigned abstract without author name (blind), scores the rubric, saves a draft, submits; review locks | Pass |
| Reviewer is redirected away from `/admin` | Pass |
| Admin sees the weighted score (80/100), accepts with a presentation type and note, publishes to the showcase; the public showcase updates | Pass |
| Admin downloads the abstracts CSV; a delegate requesting the same URL gets 403 | Pass |
| Confirmed delegate sees a check-in QR code in the portal | Pass |
| Accepted presenter uploads a poster (PDF) to private storage | Pass |
| Check-in desk: valid code checks in, repeat scan shows "already checked in", invalid code rejected | Pass |
| Admin sees the poster, audit log entries and user list | Pass |
| Guest submits the contact form; stored, with a message that email delivery isn't active yet | Pass |
| Campus map: pins render, "Where am I?" shows your position and distance, selecting a place shows its sessions and directions; `?place=` and `?room=` links open a place | Pass (map tiles stubbed, as the test machine cannot reach the tile server) |
| Admin pins a place by clicking the map, saves; a half-entered pin is rejected; "Remove pin" clears it | Pass |
| Update script `supabase/updates/2026-11-10-programme-committee-map.sql` applied twice to a seeded database | Pass, no duplicates |

Earlier in the build the public pages were checked visually at desktop and mobile sizes (home,
programme, conference, about), and the programme's agenda, filters, search and calendar export were
exercised manually in the browser.

## Problems found and fixed during testing

- Forms lost what people had typed (category, checkboxes, admin edits) after a validation error,
  because React 19 resets forms after a server action. Forms now keep their values.
- Abstracts submitted on first save had no submission time. Added a database trigger.
- The "Withdraw" button was offered on drafts and decided abstracts, which the database correctly
  refuses. Now only offered for submitted or under-review abstracts.
- Drafts required university and programme before saving. Now only required to submit.
- Colour contrast: the grey text colour, faint footer labels, success/warning badges, the ⌘K hint
  and workshop accent headings were below 4.5:1. All darkened to pass.
- The workshop details list had invalid definition-list markup for screen readers. Fixed.
- Admin and portal navigation caused sideways scrolling on phones. Fixed.
- A nested `<main>` landmark in the admin area. Fixed.

## Still to check after deployment

These need the real services and can't be verified from the development environment:

1. Apply the migration and seed to the live Supabase project, then re-run
   `supabase/tests/rls.test.sql` against a **branch or copy** of it (the test inserts users).
2. Sign-up confirmation and password-reset emails arrive and their links return to the site
   (depends on the Supabase URL configuration in the README and on SMTP).
3. Contact form emails via Resend, once `RESEND_API_KEY`, `EMAIL_FROM` and `CONTACT_TO_EMAIL` are set.
4. Account deletion from the portal (needs `SUPABASE_SERVICE_ROLE_KEY` in Vercel).
5. Camera QR scanning on the actual check-in device (BarcodeDetector is supported in Chrome and
   Edge on Android and desktop, not in Safari or Firefox; manual entry works everywhere).
6. A manual pass with a screen reader (VoiceOver or NVDA) and keyboard-only navigation of the
   programme and forms. Automated checks catch only part of WCAG.
7. Lighthouse performance on the Vercel deployment.
8. The campus map with real tiles on a phone on campus, and pinning the Ross Lucas Medical Sciences
   Building in Admin, Map places (it has no published coordinates, so it is not pinned yet).
