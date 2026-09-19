# Connecting Tutor 101 to Supabase

## 1. Create the project
Go to supabase.com, create a new project, and wait for it to finish provisioning.

## 2. Run the schema
Open the SQL editor in your Supabase dashboard, paste in the contents of
`supabase/schema.sql`, and run it. This creates every table, the auto-profile
trigger, all the Row Level Security policies, and the Storage policies for
the resources bucket, in one go.

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

## 6. Create the Storage bucket
In Storage, create a bucket named exactly `resources` and leave it **Private**
(not public). `schema.sql` already adds the RLS policies that let signed-in
users upload to it and read from it — the real gatekeeping happens at the
database level (you can only get a signed download link for a file if you
could first read its row in the `resources` table), so the bucket itself
doesn't need to be public.

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

## What isn't built yet
- **Reviews/ratings** (outline section 21) — the `reviews` table and its RLS
  exist, but there's no UI for a student to leave one yet.
- **Notifications** — the `notifications` table exists, but nothing writes
  to it yet (e.g. a row created when a tutor posts an announcement or moves
  a session). Right now a student's Notifications panel will just be empty.
