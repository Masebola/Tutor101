# Connecting Tutor 101 to Supabase

## 1. Create the project
Go to supabase.com, create a new project, and wait for it to finish provisioning.

## 2. Run the schema
Open the SQL editor in your Supabase dashboard, paste in the entire contents
of `supabase/schema.sql`, and run it. This creates every table, the
auto-profile trigger, all the Row Level Security policies, and the Storage
buckets and policies, in one go.

**Whenever this file changes** (I'll say so when it does), re-run the whole
thing again the same way — paste the entire file in and run it, not just the
new part. It's safe to do this as often as you like: types and tables are
only created if they don't already exist, and policies are dropped and
recreated by name rather than by dropping their table. **None of your data —
registered accounts, profiles, modules, sessions, anything — gets touched.**
An earlier version of this file dropped and recreated every table on each
run, which silently wiped every profile row while leaving the matching
Authentication login behind (looking like the account "disappeared" even
though it hadn't) — that's fixed now, this version never drops a table.

## 3. Turn on email confirmation
In Authentication → Settings, make sure "Confirm email" is switched on — the
registration flow depends on it (that's the "check your email" step students
and tutors see after signing up).

Also add wherever you're hosting the site (e.g. `https://yourdomain.com/login.html`,
or `http://localhost:5500/login.html` for local testing) to Authentication →
URL Configuration → Redirect URLs. Without this, Supabase rejects the
confirmation link's redirect and the email link won't work.

## 4. Get your project keys
In Settings → API, copy:
- Project URL
- anon public key

## 5. Paste them into the site
Open `js/supabaseClient.js` and replace `SUPABASE_URL` and `SUPABASE_ANON_KEY`
with the values from step 4.

## 6. Storage buckets
`schema.sql` now creates both buckets for you (`resources` as Private,
`avatars` as Public) along with their access policies — nothing to do here
manually.

## 7. Create your first administrator
There's deliberately no "sign up as admin" option — that matches the outline's
requirement that admin accounts aren't self-registered. To get one:
1. Register a normal account through the site (student or tutor tab, doesn't matter).
2. Verify the email.
3. In the Supabase dashboard, go to Table Editor → `profiles`, find that row,
   and change `role` to `admin` (clear `tutor_status` if it was set).
4. Log in again — you'll land on the admin screen.

## What's wired up
- `register.html` / `login.html` — real Supabase Auth, with role read from
  `profiles` and used to redirect to the right dashboard.
- `dashboard.html`, `tutor.html`, `admin.html` — all read and write real
  rows: sessions, resources (via Storage), announcements, support requests,
  tutor/module approvals, and subscriptions.
- `modules.html` — browsing modules and subscribing, with a simulated
  payment step that creates a real `subscriptions` row.
- `admin.html` → Manage modules — create new modules, edit an existing
  one's name/department/price/description, and activate/deactivate it.
  The RLS already allowed this (`admins manage modules` covers all of it);
  this was just the missing UI.
- Tutor profile pictures — uploaded from the tutor's own "My profile"
  panel (there's no session available at registration time to authorize a
  Storage upload, so this had to live on a page a tutor visits after
  logging in). Students see it automatically once it's set, on their
  module dashboard's Tutor profile panel.

## What isn't built yet
- **Deleting a module outright** — intentionally not built. A module has
  sessions, resources, subscriptions and more hanging off it (all set to
  cascade-delete), so a stray click on a hard "Delete" button could wipe
  real student data. Deactivating (already built) removes it from
  "Available modules" without touching anything that depends on it.
- **Viewing which tutor teaches a module from the module's own row** —
  right now that relationship is visible from the tutor/application side
  (Tutor applications, Module applications), not from Manage Modules.
- **Admin resource moderation** (outline section 22 mentions removing
  inappropriate uploads) — no UI for an admin to browse or remove a
  tutor's uploaded resources yet.
- **A student "my profile" panel** — there's currently no page for a
  student to set their own profile picture or edit their details after
  registering; tutors have this, students don't yet.
- **Tutor supporting documents** — the registration outline mentions
  uploading supporting documents alongside a tutor application, but for
  the same session-timing reason as the profile picture, there's nowhere
  for that upload (or an admin view of it) to live yet. The academic
  background textarea is the only supporting info captured for now.
- **Reviews/ratings** (outline section 21) — the `reviews` table and its RLS
  exist, but there's no UI for a student to leave one yet.
- **Notifications** — the `notifications` table exists, but nothing writes
  to it yet (e.g. a row created when a tutor posts an announcement or moves
  a session). Right now a student's Notifications panel will just be empty.

## Troubleshooting
If sign-up fails with something like "Database error saving new user" after
re-running the current schema, the generic error on screen won't say why —
but Supabase's dashboard will. Check Logs → Postgres Logs (and Logs → Auth
Logs) right after a failed attempt; the actual Postgres error (e.g. which
constraint or column it choked on) shows up there even though the app only
ever sees the generic message.

One specific case worth knowing about: if that log shows something like
`type "user_role" does not exist` even though the schema clearly created
it, it's a Supabase-specific quirk — the signup trigger runs under an
internal role (`supabase_auth_admin`) whose `search_path` deliberately
excludes `public` for security reasons. `security definer` changes who the
function runs *as*, not what schemas it can see unqualified, so without an
explicit `set search_path = public` on the function (and fully qualifying
enum casts as `public.user_role` rather than just `user_role`), the type
lookup fails. `schema.sql`'s functions already do both of these now.
