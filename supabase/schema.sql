-- Run this in the Supabase SQL Editor after creating the project.
-- Dashboard → SQL → New query → paste → Run.

-- Volunteer logins. Passwords live (hashed) in Supabase Auth → Users;
-- this table maps a short username to that Auth user's email.
create table if not exists public.volunteer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{2,40}$'),
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.volunteer_profiles enable row level security;

drop policy if exists "volunteers_can_read_own_profile" on public.volunteer_profiles;
create policy "volunteers_can_read_own_profile"
  on public.volunteer_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "volunteers_can_insert_own_profile" on public.volunteer_profiles;
create policy "volunteers_can_insert_own_profile"
  on public.volunteer_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Writes with an sb_secret_ key often do not bypass RLS. This function
-- runs as the table owner so signup can save the username.
create or replace function public.register_volunteer_profile(
  p_user_id uuid,
  p_username text,
  p_email text,
  p_display_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.volunteer_profiles (user_id, username, email, display_name)
  values (
    p_user_id,
    lower(trim(p_username)),
    lower(trim(p_email)),
    nullif(trim(p_display_name), '')
  )
  on conflict (user_id) do update
    set username = excluded.username,
        email = excluded.email,
        display_name = excluded.display_name;
end;
$$;

revoke all on function public.register_volunteer_profile(uuid, text, text, text) from public;
grant execute on function public.register_volunteer_profile(uuid, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.email_for_volunteer_username(p_username text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email
  from public.volunteer_profiles
  where username = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.email_for_volunteer_username(text) from public;
grant execute on function public.email_for_volunteer_username(text)
  to anon, authenticated, service_role;

alter table public.volunteer_profiles add column if not exists is_coordinator boolean not null default false;

-- Mark coordinators in the Table Editor, or set ESL_COORDINATOR_EMAILS in Vercel.
-- update public.volunteer_profiles set is_coordinator = true where lower(email) = 'you@example.com';

create or replace function public.is_esl_coordinator(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_coordinator from public.volunteer_profiles where user_id = p_user_id),
    false
  );
$$;

revoke all on function public.is_esl_coordinator(uuid) from public;
grant execute on function public.is_esl_coordinator(uuid)
  to anon, authenticated, service_role;

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
alter table public.week_off_requests add column if not exists class_level text;

alter table public.class_sessions add column if not exists class_level text;

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

-- Server writes with an sb_secret_ key often do not bypass RLS.
-- These functions run as the table owner so requests actually persist
-- and every volunteer can see them on the calendar.
create or replace function public.submit_week_off_request(
  p_volunteer_name text,
  p_volunteer_email text,
  p_week_of date,
  p_class_level text,
  p_assignment text,
  p_note text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  has_class_level boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'week_off_requests'
      and column_name = 'class_level'
  ) into has_class_level;

  update public.week_off_requests
     set volunteer_name = nullif(trim(p_volunteer_name), ''),
         assignment = case
           when has_class_level then nullif(trim(p_assignment), '')
           else nullif(trim(concat_ws(' · ', nullif(trim(p_class_level), ''), nullif(trim(p_assignment), ''))), '')
         end,
         note = nullif(trim(p_note), ''),
         status = 'submitted',
         updated_at = now()
   where lower(volunteer_email) = lower(trim(p_volunteer_email))
     and week_of = p_week_of
  returning * into rec;

  if rec.id is null then
    if has_class_level then
      insert into public.week_off_requests (
        volunteer_name, volunteer_email, week_of, class_level, assignment, note, status, updated_at
      )
      values (
        nullif(trim(p_volunteer_name), ''),
        lower(trim(p_volunteer_email)),
        p_week_of,
        nullif(trim(p_class_level), ''),
        nullif(trim(p_assignment), ''),
        nullif(trim(p_note), ''),
        'submitted',
        now()
      )
      returning * into rec;
    else
      insert into public.week_off_requests (
        volunteer_name, volunteer_email, week_of, assignment, note, status, updated_at
      )
      values (
        nullif(trim(p_volunteer_name), ''),
        lower(trim(p_volunteer_email)),
        p_week_of,
        nullif(trim(concat_ws(' · ', nullif(trim(p_class_level), ''), nullif(trim(p_assignment), ''))), ''),
        nullif(trim(p_note), ''),
        'submitted',
        now()
      )
      returning * into rec;
    end if;
  elsif has_class_level then
    update public.week_off_requests
       set class_level = nullif(trim(p_class_level), '')
     where id = rec.id
    returning * into rec;
  end if;

  return json_build_object(
    'id', rec.id,
    'week_of', rec.week_of,
    'volunteer_name', rec.volunteer_name,
    'volunteer_email', rec.volunteer_email,
    'class_level', case when has_class_level then rec.class_level else nullif(trim(p_class_level), '') end,
    'assignment', rec.assignment,
    'note', rec.note,
    'status', rec.status
  );
end;
$$;

revoke all on function public.submit_week_off_request(text, text, date, text, text, text) from public;
grant execute on function public.submit_week_off_request(text, text, date, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.list_week_off_requests()
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result json;
  has_class_level boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'week_off_requests'
      and column_name = 'class_level'
  ) into has_class_level;

  if has_class_level then
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
    into result
    from (
      select id, week_of, volunteer_name, volunteer_email, class_level, assignment, note, status, created_at
      from public.week_off_requests
      order by week_of desc
    ) t;
  else
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
    into result
    from (
      select id, week_of, volunteer_name, volunteer_email, assignment, note, status, created_at
      from public.week_off_requests
      order by week_of desc
    ) t;
  end if;

  return result;
end;
$$;

revoke all on function public.list_week_off_requests() from public;
grant execute on function public.list_week_off_requests()
  to anon, authenticated, service_role;

create or replace function public.list_announcements_admin()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from (
    select id, title, body, published, created_at
    from public.announcements
    order by created_at desc
  ) t;
$$;

revoke all on function public.list_announcements_admin() from public;
grant execute on function public.list_announcements_admin()
  to anon, authenticated, service_role;

create or replace function public.save_announcement(
  p_id uuid,
  p_title text,
  p_body text,
  p_published boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.announcements;
begin
  if p_id is not null then
    update public.announcements
       set title = trim(p_title),
           body = trim(p_body),
           published = coalesce(p_published, true)
     where id = p_id
    returning * into rec;
  end if;

  if rec.id is null then
    insert into public.announcements (title, body, published)
    values (trim(p_title), trim(p_body), coalesce(p_published, true))
    returning * into rec;
  end if;

  return json_build_object(
    'id', rec.id,
    'title', rec.title,
    'body', rec.body,
    'published', rec.published,
    'created_at', rec.created_at
  );
end;
$$;

revoke all on function public.save_announcement(uuid, text, text, boolean) from public;
grant execute on function public.save_announcement(uuid, text, text, boolean)
  to anon, authenticated, service_role;

create or replace function public.delete_announcement(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.announcements where id = p_id;
$$;

revoke all on function public.delete_announcement(uuid) from public;
grant execute on function public.delete_announcement(uuid)
  to anon, authenticated, service_role;

create or replace function public.save_class_session(
  p_id uuid,
  p_session_date date,
  p_starts_at text,
  p_class_name text,
  p_class_level text,
  p_building text,
  p_room text,
  p_volunteer_assignment text,
  p_notes text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  has_class_level boolean;
  start_time time;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'class_sessions' and column_name = 'class_level'
  ) into has_class_level;

  begin
    start_time := nullif(trim(p_starts_at), '')::time;
  exception when others then
    start_time := null;
  end;

  if p_id is not null then
    if has_class_level then
      update public.class_sessions
         set session_date = p_session_date,
             starts_at = start_time,
             class_name = trim(p_class_name),
             class_level = nullif(trim(p_class_level), ''),
             building = nullif(trim(p_building), ''),
             room = nullif(trim(p_room), ''),
             volunteer_assignment = nullif(trim(p_volunteer_assignment), ''),
             notes = nullif(trim(p_notes), '')
       where id = p_id
      returning * into rec;
    else
      update public.class_sessions
         set session_date = p_session_date,
             starts_at = start_time,
             class_name = trim(p_class_name),
             building = nullif(trim(p_building), ''),
             room = nullif(trim(p_room), ''),
             volunteer_assignment = nullif(trim(p_volunteer_assignment), ''),
             notes = nullif(trim(p_notes), '')
       where id = p_id
      returning * into rec;
    end if;
  end if;

  if rec.id is null then
    if has_class_level then
      insert into public.class_sessions (
        session_date, starts_at, class_name, class_level, building, room, volunteer_assignment, notes
      )
      values (
        p_session_date,
        start_time,
        trim(p_class_name),
        nullif(trim(p_class_level), ''),
        nullif(trim(p_building), ''),
        nullif(trim(p_room), ''),
        nullif(trim(p_volunteer_assignment), ''),
        nullif(trim(p_notes), '')
      )
      returning * into rec;
    else
      insert into public.class_sessions (
        session_date, starts_at, class_name, building, room, volunteer_assignment, notes
      )
      values (
        p_session_date,
        start_time,
        trim(p_class_name),
        nullif(trim(p_building), ''),
        nullif(trim(p_room), ''),
        nullif(trim(p_volunteer_assignment), ''),
        nullif(trim(p_notes), '')
      )
      returning * into rec;
    end if;
  end if;

  return json_build_object(
    'id', rec.id,
    'session_date', rec.session_date,
    'starts_at', rec.starts_at,
    'class_name', rec.class_name,
    'class_level', case when has_class_level then rec.class_level else nullif(trim(p_class_level), '') end,
    'building', rec.building,
    'room', rec.room,
    'volunteer_assignment', rec.volunteer_assignment,
    'notes', rec.notes
  );
end;
$$;

revoke all on function public.save_class_session(uuid, date, text, text, text, text, text, text, text) from public;
grant execute on function public.save_class_session(uuid, date, text, text, text, text, text, text, text)
  to anon, authenticated, service_role;

create or replace function public.delete_class_session(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.class_sessions where id = p_id;
$$;

revoke all on function public.delete_class_session(uuid) from public;
grant execute on function public.delete_class_session(uuid)
  to anon, authenticated, service_role;

create or replace function public.update_week_off_status(p_id uuid, p_status text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  next_status text;
begin
  next_status := lower(trim(p_status));
  if next_status not in ('submitted', 'reviewed', 'approved') then
    raise exception 'Status must be submitted, reviewed, or approved.';
  end if;

  update public.week_off_requests
     set status = next_status,
         updated_at = now()
   where id = p_id
  returning * into rec;

  if rec.id is null then
    raise exception 'That week-off request was not found.';
  end if;

  return json_build_object(
    'id', rec.id,
    'week_of', rec.week_of,
    'volunteer_name', rec.volunteer_name,
    'volunteer_email', rec.volunteer_email,
    'assignment', rec.assignment,
    'note', rec.note,
    'status', rec.status
  );
end;
$$;

revoke all on function public.update_week_off_status(uuid, text) from public;
grant execute on function public.update_week_off_status(uuid, text)
  to anon, authenticated, service_role;

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
-- Add a Vimeo ID, Google Drive/public URL, or volunteer-media file path.
create table if not exists public.training_videos (
  kind text primary key check (kind in ('teacher', 'tutor')),
  title text not null,
  description text,
  vimeo_id text,
  video_path text,
  video_url text,
  updated_at timestamptz not null default now()
);

alter table public.training_videos add column if not exists video_url text;

alter table public.training_videos enable row level security;

drop policy if exists "volunteers_can_read_training_videos" on public.training_videos;
create policy "volunteers_can_read_training_videos"
  on public.training_videos
  for select
  to authenticated
  using (true);

insert into public.training_videos (kind, title, description, video_url)
values
  (
    'teacher',
    'Teacher Training Video',
    'Watch this video before you lead a class.',
    'https://drive.google.com/file/d/1JA4Xo52Y9CC5haQ_kf0kttdELH5_-nD_/preview'
  ),
  (
    'tutor',
    'Tutor Training Video',
    'Watch this video before you tutor students.',
    'https://drive.google.com/file/d/1_70TF2is1b2cpFk7-xR2MdbiYooUskqk/preview'
  )
on conflict (kind) do nothing;

update public.training_videos
set video_url = 'https://drive.google.com/file/d/1JA4Xo52Y9CC5haQ_kf0kttdELH5_-nD_/preview'
where kind = 'teacher'
  and coalesce(video_url, '') = ''
  and coalesce(vimeo_id, '') = ''
  and coalesce(video_path, '') = '';

update public.training_videos
set video_url = 'https://drive.google.com/file/d/1_70TF2is1b2cpFk7-xR2MdbiYooUskqk/preview'
where kind = 'tutor'
  and coalesce(video_url, '') = ''
  and coalesce(vimeo_id, '') = ''
  and coalesce(video_path, '') = '';

