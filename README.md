# ESL Ministry Website — The Shepherd's Church

Public site for free ESL classes at The Shepherd's Church, plus a
Supabase-backed volunteer portal.

## Local preview

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Volunteer login needs Supabase keys:

```bash
cp .env.example .env
# paste Project URL and anon key into .env
npm run build
```

## Volunteer portal

- Public site: `index.html`
- Login: `login.html` (also `/login` on Vercel)
- Announcements: `volunteer.html` (also `/volunteer` on Vercel)
- Class and building calendar: `class-calendar.html`
- Bible study directory: `bible-studies.html`
- Week-off requests: `week-off.html`
- Curriculum: `curriculum.html`
- Teacher training video: `teacher-training.html`
- Tutor training video: `tutor-training.html`
- Teacher tips: `teacher-tips.html`

Volunteers sign in with email and password only. There is no Google or
Apple login, and passwords are never stored in a website table.

## Volunteer emails and passwords

Store each volunteer account in **Supabase → Authentication → Users →
Add user**:

1. Enter the volunteer’s email and a password.
2. Leave **Auto Confirm User** on (or turn off **Confirm email** under
   Authentication settings) so church-created accounts can sign in right away.
3. Keep public sign-up off so only accounts you create can open the portal.

Supabase stores the email and a hashed password. You can reset a password
from the same Users screen. Do not put passwords in `schema.sql` or the
Table Editor.

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key, or the **publishable** key → `SUPABASE_ANON_KEY`
   - Do **not** copy the `service_role` key or a key that starts with `sb_secret_`. Those are secret keys and the browser will show “Forbidden use of secret API key in browser.”
3. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
4. Open **Authentication → Users → Add user** and create volunteer accounts.
   Turn off **Confirm email** under Authentication settings if you will
   create accounts by hand and do not want a confirmation email.
5. Add announcements in **Table Editor → announcements**.
6. Add class, building, room, and assignment details in
   **Table Editor → class_sessions**.
7. Add up to 10 Bible studies and their contacts in
   **Table Editor → bible_studies**. Use `display_order` values 1–10.
8. Review volunteer requests in **Table Editor → week_off_requests**.
9. Add curriculum titles, links, or file paths in
   **Table Editor → curriculum_items**.
10. Add teacher and tutor training videos in
    **Table Editor → training_videos**. Use a Vimeo ID or a
    `volunteer-media` file path.
11. Add teacher tips in **Table Editor → teacher_tips**.
12. Optional videos: upload files under 50 MB to the `volunteer-media`
    bucket, then put the file path (for example `training/welcome.mp4`)
    in the announcement `video_path` column.

Never put the `service_role` key in this website. The anon key is safe
in the browser because Row Level Security protects the portal data.

## Deploy on Vercel

1. Import this GitHub repository in [vercel.com](https://vercel.com).
2. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon/public or publishable key only)
3. Deploy. The build script writes `assets/js/env.js` from those values and copies the site into `public/` for Vercel.
4. If login shows “Forbidden use of secret API key in browser,” the Vercel
   value is the secret key. Replace it with the anon/public key and redeploy.

The public pages work without Supabase. The login page will show a setup
message until the keys and SQL are in place.

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
