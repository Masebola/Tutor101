-- ============================================================
-- Tutor 101 — Supabase schema, triggers and Row Level Security
-- Run this once in your Supabase project's SQL editor.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type user_role            as enum ('student', 'tutor', 'admin');
create type tutor_status         as enum ('pending', 'approved', 'rejected', 'suspended');
create type module_status        as enum ('available', 'unavailable');
create type application_status   as enum ('pending', 'approved', 'rejected');
create type subscription_status  as enum ('active', 'expired', 'cancelled');
create type request_status       as enum ('open', 'in_progress', 'answered', 'closed');
create type resource_category    as enum ('notes', 'study_guide', 'past_paper');

-- ---------- Tables ----------

-- One row per auth.users entry — role lives here, not in the login form.
create table profiles (
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

create table modules (
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
create table tutor_modules (
  id         uuid primary key default uuid_generate_v4(),
  tutor_id   uuid references profiles(id) on delete cascade,
  module_id  uuid references modules(id) on delete cascade,
  status     application_status not null default 'pending',
  applied_at timestamptz not null default now(),
  unique (tutor_id, module_id)
);

create table subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  student_id   uuid references profiles(id) on delete cascade,
  module_id    uuid references modules(id) on delete cascade,
  status       subscription_status not null default 'active',
  amount       numeric(10,2) not null,
  start_date   date not null default current_date,
  expiry_date  date not null,
  unique (student_id, module_id)
);

create table sessions (
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

create table resources (
  id            uuid primary key default uuid_generate_v4(),
  module_id     uuid references modules(id) on delete cascade,
  uploaded_by   uuid references profiles(id) on delete set null,
  category      resource_category not null,
  file_name     text not null,
  storage_path  text not null,              -- path inside the Supabase Storage bucket
  uploaded_at   timestamptz not null default now()
);

create table announcements (
  id         uuid primary key default uuid_generate_v4(),
  module_id  uuid references modules(id) on delete cascade,
  posted_by  uuid references profiles(id) on delete set null,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table support_requests (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade,
  module_id  uuid references modules(id) on delete cascade,
  topic      text not null,
  message    text not null,
  response   text,
  status     request_status not null default 'open',
  created_at timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id) on delete cascade,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table reviews (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade,
  tutor_id   uuid references profiles(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  rating     int not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

-- ---------- Seed the three example modules from the outline ----------
insert into modules (code, name, department, description, price) values
  ('COM3217', 'Database Design',      'Computer Science', 'Introduction to database concepts, design and implementation.', 100),
  ('MAT201',  'Mathematics II',       'Mathematics',       'Calculus and linear algebra fundamentals for second-year students.', 100),
  ('CSC302',  'Software Engineering', 'Computer Science', 'Software development lifecycles, design patterns and team practice.', 100);

-- ---------- Auto-create a profile row whenever someone signs up ----------
-- Registration writes role/full_name/student_number/academic_info into
-- auth.users' metadata (see js/auth.js) — this trigger copies it into
-- public.profiles so the rest of the app can just query profiles.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, student_number, email, academic_info, tutor_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student')::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'student_number',
    new.email,
    new.raw_user_meta_data->>'academic_info',
    case when coalesce(new.raw_user_meta_data->>'role', 'student') = 'tutor' then 'pending'::tutor_status else null end
  );
  return new;
end;
$$ language plpgsql security definer;

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
returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$ language sql stable security definer;

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

-- RLS above only restricts which ROW a user can update, not which COLUMNS —
-- without this, any signed-in user could set role='admin' on their own row
-- in a single update call. This trigger silently resets the sensitive
-- columns back to their previous value unless the request comes from an
-- admin, whatever the update statement asked for.
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.tutor_status := old.tutor_status;
    new.average_rating := old.average_rating;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger protect_profile_fields_trigger
  before update on profiles
  for each row execute procedure public.protect_profile_fields();

-- modules: available modules are public; only admins write.
create policy "view available modules" on modules for select using (status = 'available' or public.is_admin());
create policy "admins manage modules"  on modules for all    using (public.is_admin());

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

-- ---------- Storage: the "resources" bucket ----------
-- Create a bucket named "resources" (leave it Private) in Storage → Buckets
-- first, then run this. Real access control lives in the `resources` table
-- above — you can only get a signed URL for a path if you could first read
-- its row, so these just need to let authenticated users touch the bucket.
create policy "authenticated can read resources bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'resources');

create policy "authenticated can upload to resources bucket" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources');

create policy "uploader can delete their own resource files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and owner = auth.uid());
