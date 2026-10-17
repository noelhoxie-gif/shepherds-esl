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
