# ESL Ministry Website — The Shepherd's Church

Public site for free ESL classes at The Shepherd's Church, plus open
volunteer pages for calendar, curriculum, training, and week-off requests.
There is no login.

## Local preview

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Volunteer pages need the public Supabase keys to load calendar and form data:

```bash
cp .env.example .env
# paste Project URL and anon key into .env
npm run build
```

## Volunteer pages

These pages are public. The Home tab includes a Volunteer Pages link.

- Public site: `index.html`
- Announcements: `volunteer.html` (also `/volunteer` on Vercel)
- Class and building calendar: `class-calendar.html`
- Bible study directory: `bible-studies.html`
- Week-off requests: `week-off.html`
- Curriculum: `curriculum.html`
- Teacher training video: `teacher-training.html`
- Tutor training video: `tutor-training.html`
- Teacher tips: `teacher-tips.html`

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key, or the **publishable** key → `SUPABASE_ANON_KEY`
   - Do **not** copy the `service_role` key or a key that starts with `sb_secret_`. Those are secret keys and the browser will show “Forbidden use of secret API key in browser.”
3. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
   This grants public read access so the volunteer pages work without login.
4. Add announcements in **Table Editor → announcements**.
5. Add class, building, room, and assignment details in
   **Table Editor → class_sessions**.
6. Add up to 10 Bible studies and their contacts in
   **Table Editor → bible_studies**. Use `display_order` values 1–10.
7. Review volunteer requests in **Table Editor → week_off_requests**.
8. Add curriculum titles, links, or file paths in
   **Table Editor → curriculum_items**.
9. Add teacher and tutor training videos in
   **Table Editor → training_videos**. Use a Vimeo ID or a
   `volunteer-media` file path.
10. Add teacher tips in **Table Editor → teacher_tips**.
11. Optional videos: upload files under 50 MB to the `volunteer-media`
    bucket, then put the file path (for example `training/welcome.mp4`)
    in the announcement `video_path` column.

Never put the `service_role` key in this website. Use the anon/public key.

## Deploy on Vercel

1. Import this GitHub repository in [vercel.com](https://vercel.com).
2. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon/public or publishable key only)
3. Deploy. The build script writes `assets/js/env.js` from those values and copies the site into `public/` for Vercel.
4. If volunteer pages show “Forbidden use of secret API key in browser,” the
   Vercel value is the secret key. Replace it with the anon/public key and redeploy.

The class information on `index.html` works without Supabase. Volunteer
pages show a setup message until the keys and SQL are in place.

## Editing public content

All public text lives in `index.html`. Each tab is a `<section>`. Copy the
template at the bottom of the file to add another tab. The menu updates
automatically.

## Brand colors

| Name | Hex |
| --- | --- |
| Navy (header) | `#0d1b51` |
| Blue (buttons) | `#1e4278` |
| Red (sub-menu, buttons) | `#822812` |
| Gold (hover, accents) | `#c6a429` |
