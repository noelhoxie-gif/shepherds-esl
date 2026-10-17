-- Run this in the Supabase SQL Editor after creating the project.
-- Dashboard → SQL → New query → paste → Run.

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

-- Volunteers can submit a request and review or update only their own requests.
-- Coordinators can review all requests from the Supabase Table Editor.
create table if not exists public.week_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  volunteer_email text not null,
  week_of date not null,
  assignment text,
  note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_of)
);

create index if not exists week_off_requests_week_of_idx
  on public.week_off_requests (week_of);

alter table public.week_off_requests enable row level security;

drop policy if exists "volunteers_can_read_own_week_off_requests" on public.week_off_requests;
create policy "volunteers_can_read_own_week_off_requests"
  on public.week_off_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "volunteers_can_submit_week_off_requests" on public.week_off_requests;
create policy "volunteers_can_submit_week_off_requests"
  on public.week_off_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "volunteers_can_update_own_week_off_requests" on public.week_off_requests;
create policy "volunteers_can_update_own_week_off_requests"
  on public.week_off_requests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
