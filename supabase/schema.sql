-- ============================================================
-- Tutor 101 — Supabase schema, triggers and Row Level Security
--
-- Safe to run from scratch, AND safe to re-run any time this file is
-- updated (e.g. after a fix in a later chat message) — WITHOUT losing
-- existing data. Earlier versions of this file dropped and recreated
-- every table on each run, which also wiped every registered user's
-- `profiles` row (their auth.users login survived, since that's
-- Supabase's own separate table, but their profile — role, name,
-- everything — did not). That was a real bug, not intended behavior.
--
-- This version never drops a table. Types and tables are created only
-- if they don't already exist; functions use CREATE OR REPLACE (which
-- updates behavior without touching data); triggers and RLS policies
-- are dropped and recreated by name (safe — they hold no data of their
-- own). Re-running this file after a future update will pick up
-- whatever changed and leave every existing row exactly as it was.
--
-- One consequence: if a future change needs a new COLUMN on an
-- existing table, this file will need an explicit
-- `alter table ... add column if not exists ...` for it — a bare
-- `create table if not exists` does nothing to a table that's already
-- there, columns included.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Enums (Postgres has no CREATE TYPE IF NOT EXISTS) ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('student', 'tutor', 'admin');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tutor_status') then
    create type tutor_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'module_status') then
    create type module_status as enum ('available', 'unavailable');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type application_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('active', 'expired', 'cancelled');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum ('open', 'in_progress', 'answered', 'closed');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'resource_category') then
    create type resource_category as enum ('notes', 'study_guide', 'past_paper');
  end if;
end $$;

-- ---------- Tables ----------

-- One row per auth.users entry — role lives here, not in the login form.
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           user_role not null default 'student',
  full_name      text not null,
  student_number text,
  email          text,
  avatar_url     text,
  academic_info  text,
  bio            text,
  tutor_status   tutor_status,              -- only meaningful when role = 'tutor'
  average_rating numeric(2,1),
  created_at     timestamptz not null default now()
);

create table if not exists modules (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  name        text not null,
  department  text,
  description text,
  price       numeric(10,2) not null default 100,
  status      module_status not null default 'available',
  created_at  timestamptz not null default now()
);

-- A tutor's application to (and eventual assignment on) a module.
create table if not exists tutor_modules (
  id         uuid primary key default uuid_generate_v4(),
  tutor_id   uuid references profiles(id) on delete cascade,
  module_id  uuid references modules(id) on delete cascade,
  status     application_status not null default 'pending',
  applied_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  student_id   uuid references profiles(id) on delete cascade,
  module_id    uuid references modules(id) on delete cascade,
  status       subscription_status not null default 'active',
  amount       numeric(10,2) not null,
  start_date   date not null default current_date,
  expiry_date  date not null
);

create table if not exists sessions (
  id               uuid primary key default uuid_generate_v4(),
  module_id        uuid references modules(id) on delete cascade,
  tutor_id         uuid references profiles(id) on delete cascade,
  title            text not null,
  description      text,
  start_time       timestamptz not null,
  duration_minutes int not null default 60,
  platform         text,
  meeting_link     text,
  recurring_rule   text,                    -- e.g. 'weekly:tuesday'
  created_at       timestamptz not null default now()
);

create table if not exists resources (
  id            uuid primary key default uuid_generate_v4(),
  module_id     uuid references modules(id) on delete cascade,
  uploaded_by   uuid references profiles(id) on delete set null,
  category      resource_category not null,
  file_name     text not null,
  storage_path  text not null,              -- path inside the Supabase Storage bucket
  uploaded_at   timestamptz not null default now()
);

create table if not exists announcements (
  id         uuid primary key default uuid_generate_v4(),
  module_id  uuid references modules(id) on delete cascade,
  posted_by  uuid references profiles(id) on delete set null,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists support_requests (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade,
  module_id  uuid references modules(id) on delete cascade,
  topic      text not null,
  message    text not null,
  response   text,
  status     request_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id) on delete cascade,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade,
  tutor_id   uuid references profiles(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  rating     int not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

-- A plain unique(student_id, module_id) or unique(tutor_id, module_id) would
-- permanently block resubscribing/reapplying after a subscription lapses or
-- an application is rejected. These partial indexes only enforce uniqueness
-- among the "live" rows, so history can pile up and a fresh attempt still
-- works.
create unique index if not exists subscriptions_one_active_per_module
  on subscriptions (student_id, module_id) where status = 'active';

create unique index if not exists tutor_modules_one_live_application
  on tutor_modules (tutor_id, module_id) where status in ('pending', 'approved');

-- ---------- Seed the three example modules from the outline ----------
-- ON CONFLICT DO NOTHING: safe to re-run without erroring or duplicating,
-- and won't touch a module you've since edited or added through the admin
-- screen.
insert into modules (code, name, department, description, price) values
  ('COM3217', 'Database Design',      'Computer Science', 'Introduction to database concepts, design and implementation.', 100),
  ('MAT201',  'Mathematics II',       'Mathematics',       'Calculus and linear algebra fundamentals for second-year students.', 100),
  ('CSC302',  'Software Engineering', 'Computer Science', 'Software development lifecycles, design patterns and team practice.', 100)
on conflict (code) do nothing;

-- ---------- Auto-create a profile row whenever someone signs up ----------
-- Registration writes role/full_name/student_number/academic_info into
-- auth.users' metadata (see js/auth.js) — this trigger copies it into
-- public.profiles so the rest of the app can just query profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, student_number, email, academic_info, tutor_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student')::public.user_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'student_number',
    new.email,
    new.raw_user_meta_data->>'academic_info',
    case when coalesce(new.raw_user_meta_data->>'role', 'student') = 'tutor' then 'pending'::public.tutor_status else null end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Row Level Security ----------
alter table profiles          enable row level security;
alter table modules           enable row level security;
alter table tutor_modules     enable row level security;
alter table subscriptions     enable row level security;
alter table sessions          enable row level security;
alter table resources         enable row level security;
alter table announcements     enable row level security;
alter table support_requests  enable row level security;
alter table notifications     enable row level security;
alter table reviews           enable row level security;

-- Helper used throughout the policies below.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS above only restricts which ROW a user can update, not which COLUMNS —
-- without this, any signed-in user could set role='admin' on their own row
-- in a single update call. This trigger silently resets the sensitive
-- columns back to their previous value unless the request comes from an
-- admin, whatever the update statement asked for.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for direct SQL sessions (e.g. the Table Editor or
  -- the SQL editor), which already bypass RLS entirely and are fully
  -- trusted. Without this check, editing role there as instructed in
  -- SETUP.md would silently get reverted, because is_admin() would see a
  -- null auth.uid() and always evaluate to false. Only enforce the block
  -- for normal authenticated requests coming through the app's API calls.
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.tutor_status := old.tutor_status;
    new.average_rating := old.average_rating;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on profiles;
create trigger protect_profile_fields_trigger
  before update on profiles
  for each row execute procedure public.protect_profile_fields();

-- ---------- Row Level Security policies ----------
-- Policies aren't data, so dropping and recreating them by name (rather
-- than via a table drop) is always safe — this is what lets this whole
-- file be re-run without touching a single row.
drop policy if exists "view own profile" on profiles;
drop policy if exists "admins view all profiles" on profiles;
drop policy if exists "student can view their module's tutor" on profiles;
drop policy if exists "tutor can view their students" on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "admins update any profile" on profiles;
drop policy if exists "view available modules" on modules;
drop policy if exists "admins manage modules" on modules;
drop policy if exists "tutor views own applications" on tutor_modules;
drop policy if exists "subscribed students can view their module's tutor link" on tutor_modules;
drop policy if exists "tutor applies for a module" on tutor_modules;
drop policy if exists "admins decide applications" on tutor_modules;
drop policy if exists "student views own subscriptions" on subscriptions;
drop policy if exists "student subscribes" on subscriptions;
drop policy if exists "admins view all subscriptions" on subscriptions;
drop policy if exists "sessions visible to tutor, admin, subscribed students" on sessions;
drop policy if exists "tutor manages own sessions" on sessions;
drop policy if exists "resources visible to tutor, admin, subscribed students" on resources;
drop policy if exists "tutor manages own resources" on resources;
drop policy if exists "announcements visible to tutor, admin, subscribed students" on announcements;
drop policy if exists "tutor posts announcements" on announcements;
drop policy if exists "student can view own requests" on support_requests;
drop policy if exists "student can submit requests" on support_requests;
drop policy if exists "tutor views requests for their module" on support_requests;
drop policy if exists "tutor answers requests for their module" on support_requests;
drop policy if exists "user manages own notifications" on notifications;
drop policy if exists "student can leave a review for their own session" on reviews;
drop policy if exists "anyone can read reviews" on reviews;

-- profiles: everyone can see their own row; admins see everyone.
create policy "view own profile"        on profiles for select using (auth.uid() = id);
create policy "admins view all profiles" on profiles for select using (public.is_admin());
create policy "student can view their module's tutor" on profiles for select using (
  role = 'tutor' and exists (
    select 1 from tutor_modules tm
    join subscriptions s on s.module_id = tm.module_id
    where tm.tutor_id = profiles.id and tm.status = 'approved'
      and s.student_id = auth.uid() and s.status = 'active'
  )
);
create policy "tutor can view their students" on profiles for select using (
  role = 'student' and exists (
    select 1 from subscriptions s
    join tutor_modules tm on tm.module_id = s.module_id
    where s.student_id = profiles.id and tm.tutor_id = auth.uid() and tm.status = 'approved'
  )
);
create policy "update own profile"       on profiles for update using (auth.uid() = id);
create policy "admins update any profile" on profiles for update using (public.is_admin());

-- modules: available modules are public; only admins write (create, edit,
-- deactivate — this already covers the admin module-management screen).
create policy "view available modules" on modules for select using (status = 'available' or public.is_admin());
create policy "admins manage modules"  on modules for all    using (public.is_admin()) with check (public.is_admin());

-- tutor_modules: a tutor sees/creates their own applications; admins decide them.
create policy "tutor views own applications" on tutor_modules for select using (tutor_id = auth.uid() or public.is_admin());
create policy "subscribed students can view their module's tutor link" on tutor_modules for select using (
  status = 'approved' and exists (
    select 1 from subscriptions s where s.module_id = tutor_modules.module_id and s.student_id = auth.uid() and s.status = 'active'
  )
);
create policy "tutor applies for a module"   on tutor_modules for insert with check (tutor_id = auth.uid());
create policy "admins decide applications"   on tutor_modules for update using (public.is_admin());

-- subscriptions: a student manages their own; admins can view all.
create policy "student views own subscriptions" on subscriptions for select using (student_id = auth.uid());
create policy "student subscribes"              on subscriptions for insert with check (student_id = auth.uid());
create policy "admins view all subscriptions"   on subscriptions for select using (public.is_admin());

-- sessions: visible to the tutor who owns them and students subscribed to that module.
create policy "sessions visible to tutor, admin, subscribed students" on sessions for select using (
  tutor_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from subscriptions s where s.module_id = sessions.module_id and s.student_id = auth.uid() and s.status = 'active')
);
create policy "tutor manages own sessions" on sessions for all using (tutor_id = auth.uid()) with check (
  tutor_id = auth.uid() and exists (
    select 1 from tutor_modules tm where tm.tutor_id = auth.uid() and tm.module_id = sessions.module_id and tm.status = 'approved'
  )
);

-- resources: same visibility shape as sessions.
create policy "resources visible to tutor, admin, subscribed students" on resources for select using (
  uploaded_by = auth.uid()
  or public.is_admin()
  or exists (select 1 from subscriptions s where s.module_id = resources.module_id and s.student_id = auth.uid() and s.status = 'active')
);
create policy "tutor manages own resources" on resources for all using (uploaded_by = auth.uid()) with check (
  uploaded_by = auth.uid() and exists (
    select 1 from tutor_modules tm where tm.tutor_id = auth.uid() and tm.module_id = resources.module_id and tm.status = 'approved'
  )
);

-- announcements: same visibility shape again; only the posting tutor can insert.
create policy "announcements visible to tutor, admin, subscribed students" on announcements for select using (
  posted_by = auth.uid()
  or public.is_admin()
  or exists (select 1 from subscriptions s where s.module_id = announcements.module_id and s.student_id = auth.uid() and s.status = 'active')
);
create policy "tutor posts announcements" on announcements for insert with check (
  posted_by = auth.uid() and exists (
    select 1 from tutor_modules tm where tm.tutor_id = auth.uid() and tm.module_id = announcements.module_id and tm.status = 'approved'
  )
);

-- support_requests: the student owns theirs (read/create only); the module's approved tutor (or an admin) resolves them.
create policy "student can view own requests"  on support_requests for select using (student_id = auth.uid());
create policy "student can submit requests"    on support_requests for insert with check (student_id = auth.uid());
create policy "tutor views requests for their module" on support_requests for select using (
  exists (select 1 from tutor_modules tm where tm.module_id = support_requests.module_id and tm.tutor_id = auth.uid() and tm.status = 'approved')
  or public.is_admin()
);
create policy "tutor answers requests for their module" on support_requests for update using (
  exists (select 1 from tutor_modules tm where tm.module_id = support_requests.module_id and tm.tutor_id = auth.uid() and tm.status = 'approved')
);

-- notifications: strictly private to the recipient.
create policy "user manages own notifications" on notifications for all using (user_id = auth.uid());

-- reviews: a student can leave one only for a session tied to a module they were subscribed to; anyone can read ratings.
create policy "student can leave a review for their own session" on reviews for insert with check (
  student_id = auth.uid() and exists (
    select 1 from sessions se
    join subscriptions su on su.module_id = se.module_id
    where se.id = session_id and se.tutor_id = reviews.tutor_id
      and su.student_id = auth.uid() and su.status = 'active'
  )
);
create policy "anyone can read reviews" on reviews for select using (true);

-- ---------- Storage buckets ----------
-- Creates both buckets here so there's no separate manual step in the
-- Storage UI. ON CONFLICT DO NOTHING: safe to re-run, and never touches
-- files already uploaded to them.
insert into storage.buckets (id, name, public) values ('resources', 'resources', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- storage.objects is Supabase's own table, shared across the project —
-- drop only the policies this file adds to it, never the table itself.
drop policy if exists "authenticated can read resources bucket" on storage.objects;
drop policy if exists "authenticated can upload to resources bucket" on storage.objects;
drop policy if exists "uploader can delete their own resource files" on storage.objects;
drop policy if exists "authenticated can upload their own avatar" on storage.objects;
drop policy if exists "authenticated can replace their own avatar" on storage.objects;
drop policy if exists "authenticated can delete their own avatar" on storage.objects;

-- ---------- Storage: the "resources" bucket ----------
-- Real access control lives in the `resources` table above — you can only
-- get a signed URL for a path if you could first read its row, so these
-- just need to let authenticated users touch the bucket.
create policy "authenticated can read resources bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'resources');

create policy "authenticated can upload to resources bucket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources');

create policy "uploader can delete their own resource files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and owner = auth.uid());

-- ---------- Storage: the "avatars" bucket ----------
-- Public (unlike "resources") — profile pictures are meant to be freely
-- visible wherever a profile is shown, so there's no read policy needed
-- here; a public bucket serves files directly. These only cover writes,
-- and only let someone touch their own folder (named after their user id).
create policy "authenticated can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "authenticated can replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "authenticated can delete their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
