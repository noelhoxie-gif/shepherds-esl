-- Run this in the Supabase SQL Editor after creating the project.
-- Dashboard → SQL → New query → paste → Run.

-- Volunteer logins. Passwords live (hashed) in Supabase Auth → Users;
-- this table maps a short username to that Auth user's email.
-- No policies are granted, so only the server key can read it.
create table if not exists public.volunteer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{2,40}$'),
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.volunteer_profiles enable row level security;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  video_path text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "volunteers_can_read_published_announcements" on public.announcements;
create policy "volunteers_can_read_published_announcements"
  on public.announcements
  for select
  to authenticated
  using (published = true);

insert into public.announcements (title, body)
values
  (
    'Welcome, volunteers',
    'Thank you for serving with ESL. Please arrive by 9:15 AM on Fridays and enter through the West Entrance. Green signs will point you to the Family Center, second floor.'
  ),
  (
    'Childcare reminder',
    'Childcare spaces are limited. If you are serving in childcare this week, check in at the Family Center so students can get to class on time.'
  );

-- Private storage for a couple of small volunteer videos (under 50 MB each on the free plan).
insert into storage.buckets (id, name, public)
values ('volunteer-media', 'volunteer-media', false)
on conflict (id) do nothing;

drop policy if exists "volunteers_can_read_media" on storage.objects;
create policy "volunteers_can_read_media"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'volunteer-media');

-- Class, building, room, and volunteer assignments shown in the portal calendar.
-- Coordinators can add and edit these rows in the Supabase Table Editor.
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  starts_at time,
  class_name text not null,
  building text,
  room text,
  volunteer_assignment text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists class_sessions_session_date_idx
  on public.class_sessions (session_date);

alter table public.class_sessions enable row level security;

drop policy if exists "volunteers_can_read_class_sessions" on public.class_sessions;
create policy "volunteers_can_read_class_sessions"
  on public.class_sessions
  for select
  to authenticated
  using (true);

-- The display_order constraint limits the volunteer directory to 10 positions.
create table if not exists public.bible_studies (
  id uuid primary key default gen_random_uuid(),
  display_order smallint not null unique check (display_order between 1 and 10),
  name text not null,
  meeting_time text,
  location text,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bible_studies enable row level security;

drop policy if exists "volunteers_can_read_bible_studies" on public.bible_studies;
create policy "volunteers_can_read_bible_studies"
  on public.bible_studies
  for select
  to authenticated
  using (active = true);

-- Signed-in volunteers can see every request so they know who is covering.
create table if not exists public.week_off_requests (
  id uuid primary key default gen_random_uuid(),
  volunteer_name text,
  volunteer_email text not null,
  week_of date not null,
  assignment text,
  note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volunteer_email, week_of)
);

alter table public.week_off_requests add column if not exists volunteer_name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'week_off_requests'
      and column_name = 'user_id'
  ) then
    alter table public.week_off_requests alter column user_id drop not null;
    alter table public.week_off_requests drop constraint if exists week_off_requests_user_id_week_of_key;
    alter table public.week_off_requests drop constraint if exists week_off_requests_user_id_fkey;
  end if;
end $$;

create unique index if not exists week_off_requests_email_week_key
  on public.week_off_requests (volunteer_email, week_of);

create index if not exists week_off_requests_week_of_idx
  on public.week_off_requests (week_of);

alter table public.week_off_requests enable row level security;

drop policy if exists "volunteers_can_read_own_week_off_requests" on public.week_off_requests;
drop policy if exists "volunteers_can_submit_week_off_requests" on public.week_off_requests;
drop policy if exists "volunteers_can_update_own_week_off_requests" on public.week_off_requests;
drop policy if exists "anyone_can_read_week_off_requests" on public.week_off_requests;
create policy "anyone_can_read_week_off_requests"
  on public.week_off_requests
  for select
  to authenticated
  using (true);

drop policy if exists "anyone_can_submit_week_off_requests" on public.week_off_requests;
create policy "anyone_can_submit_week_off_requests"
  on public.week_off_requests
  for insert
  to authenticated
  with check (true);

drop policy if exists "anyone_can_update_week_off_requests" on public.week_off_requests;
create policy "anyone_can_update_week_off_requests"
  on public.week_off_requests
  for update
  to authenticated
  using (true)
  with check (true);

-- Lesson plans and other class materials.
create table if not exists public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  display_order integer not null default 1,
  title text not null,
  description text,
  url text,
  file_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.curriculum_items enable row level security;

drop policy if exists "volunteers_can_read_curriculum_items" on public.curriculum_items;
create policy "volunteers_can_read_curriculum_items"
  on public.curriculum_items
  for select
  to authenticated
  using (active = true);

-- One teacher training video and one tutor training video.
-- Add a Vimeo ID or a volunteer-media file path in the Table Editor.
create table if not exists public.training_videos (
  kind text primary key check (kind in ('teacher', 'tutor')),
  title text not null,
  description text,
  vimeo_id text,
  video_path text,
  updated_at timestamptz not null default now()
);

alter table public.training_videos enable row level security;

drop policy if exists "volunteers_can_read_training_videos" on public.training_videos;
create policy "volunteers_can_read_training_videos"
  on public.training_videos
  for select
  to authenticated
  using (true);

insert into public.training_videos (kind, title, description)
values
  ('teacher', 'Teacher Training Video', 'Watch this video before you lead a class.'),
  ('tutor', 'Tutor Training Video', 'Watch this video before you tutor students.')
on conflict (kind) do nothing;

create table if not exists public.teacher_tips (
  id uuid primary key default gen_random_uuid(),
  display_order integer not null default 1,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.teacher_tips enable row level security;

drop policy if exists "volunteers_can_read_teacher_tips" on public.teacher_tips;
create policy "volunteers_can_read_teacher_tips"
  on public.teacher_tips
  for select
  to authenticated
  using (active = true);
