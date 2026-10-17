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
- Core values: `core-values.html`
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

Anyone who can open the login page can create an account.

If signup fails with a row-level security error on `volunteer_profiles`,
run the updated `supabase/schema.sql` in the SQL Editor. That adds a
`register_volunteer_profile` function the server uses to save usernames.

The new `sb_secret_` keys are not JWTs, so Auth's admin user API rejects
them with "This endpoint requires a valid Bearer token." The login page
creates accounts through `/auth/v1/signup` in that case. In Supabase:

1. **Authentication → Providers → Email**: turn on.
2. **Allow new users to sign up**: turn on.
3. **Confirm email**: turn off so volunteers can sign in right away.

If you still have the long JWT `service_role` key (`eyJ...`), you can add
it in Vercel as `SUPABASE_SERVICE_ROLE_KEY`. Then the site can create
users with the admin API and auto-confirm them. Keep `SUPABASE_SECRET_KEY`
for the rest of the volunteer data.

You can also add a volunteer by hand:

1. Open **Authentication → Users → Add user → Create new user**. Enter the
   volunteer's email and a password, and check **Auto Confirm User**.
2. Copy the new user's **UID**, then run this in the SQL Editor:

   ```sql
   insert into public.volunteer_profiles (user_id, username, email, display_name)
   values ('PASTE-UID-HERE', 'maria', 'maria@example.com', 'Maria Lopez');
   ```

Volunteers can reset a password from the login page (**Forgot password?**).
Reset emails come from Supabase, not from this website. For them to arrive:

1. **Authentication → Providers → Email** must be on.
2. **Authentication → Email Templates → Reset Password** must be enabled.
3. **Authentication → URL Configuration**: set **Site URL** to the live
   website, and add both of these to **Redirect URLs**:
   - `https://your-site.vercel.app/login.html`
   - `https://your-site.vercel.app/**`
4. Optional: in Vercel, set `SITE_URL` to that same website so the reset
   link matches the allowed list.
5. Optional: add `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` in
   Vercel. Password reset is a public Auth action; the secret key can
   block the email.
6. Check spam. The built-in sender is often `noreply@mail.app.supabase.io`.
   For reliable delivery, add a custom SMTP provider in
   **Project Settings → Authentication**.

You can also set a new password in **Authentication → Users**. Deleting
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
