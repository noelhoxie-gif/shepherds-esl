# ESL Ministry Website — The Shepherd's Church

Public site for free ESL classes at The Shepherd's Church, plus
password-protected volunteer pages for calendar, curriculum, training, and
week-off requests. Browser pages never contain a Supabase key.

## Local preview

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Volunteer data loads through `/api/portal` on Vercel. For local data testing,
use `npx vercel dev` after adding keys to `.env`.

## Volunteer pages

Click **Volunteer** on the public site. Volunteers who are not signed in are
sent to `login.html` first. After signing in they can open:

- Announcements: `volunteer.html`
- Class and building calendar: `class-calendar.html`
- Bible study directory: `bible-studies.html`
- Week-off requests: `week-off.html`
- Curriculum: `curriculum.html`
- Teacher training video: `teacher-training.html`
- Tutor training video: `tutor-training.html`
- Teacher tips: `teacher-tips.html`

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In Vercel, add environment variables (server only):
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (the secret / `sb_secret_` key is safe here because it is not put in the website)
4. Redeploy. The volunteer pages call `/api/portal`, which uses those keys automatically.
5. Add content in the Table Editor:
   - `announcements`
   - `class_sessions`
   - `bible_studies`
   - `week_off_requests`
   - `curriculum_items`
   - `training_videos`
   - `teacher_tips`
6. Optional videos: upload files under 50 MB to the `volunteer-media`
   bucket, then put the file path in `video_path` or `file_path`.

Do not put a Supabase key in HTML, `assets/js`, or GitHub.

## Volunteer logins

Passwords are stored by Supabase Auth, which saves only a secure hash. The
`volunteer_profiles` table adds a username for each login.

Volunteers can create an account on `login.html` (name, username, email,
password). The `/api/auth` function creates the Auth user and profile row,
then signs them in. They can sign in later with either the username or the
email.

Anyone who can open the login page can create an account. Keep **Allow new
users to sign up** turned off in **Authentication → Sign In / Providers**.
The website still creates users because it uses the server key, not the
public signup form.

You can also add a volunteer by hand:

1. Open **Authentication → Users → Add user → Create new user**. Enter the
   volunteer's email and a password, and check **Auto Confirm User**.
2. Copy the new user's **UID**, then run this in the SQL Editor:

   ```sql
   insert into public.volunteer_profiles (user_id, username, email, display_name)
   values ('PASTE-UID-HERE', 'maria', 'maria@example.com', 'Maria Lopez');
   ```

To reset a password, open the user in **Authentication → Users**. Deleting
the Auth user also deletes their profile row.

Sign-in stores the session in HttpOnly cookies, so page scripts cannot read
the token, and `/api/portal` returns data only to signed-in volunteers.

## Deploy on Vercel

1. Import this GitHub repository in [vercel.com](https://vercel.com).
2. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
3. Deploy. The build copies the static site into `public/`. The `/api/auth`
   and `/api/portal` functions talk to Supabase on the server.

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
