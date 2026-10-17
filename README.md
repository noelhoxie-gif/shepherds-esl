# ESL Ministry Website — The Shepherd's Church

Public site for free ESL classes at The Shepherd's Church, plus a
Supabase-backed volunteer login for private announcements.

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

Volunteers sign in with the **email and password** created for them in
Supabase. There is no public sign-up form.

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
3. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
4. Open **Authentication → Users → Add user** and create volunteer accounts.
   Turn off **Confirm email** under Authentication settings if you will
   create accounts by hand and do not want a confirmation email.
5. Add announcements in **Table Editor → announcements**.
6. Optional videos: upload files under 50 MB to the `volunteer-media`
   bucket, then put the file path (for example `training/welcome.mp4`)
   in the announcement `video_path` column.

Never put the `service_role` key in this website. The anon key is safe
in the browser because Row Level Security only lets signed-in volunteers
read announcements.

## Deploy on Vercel

1. Import this GitHub repository in [vercel.com](https://vercel.com).
2. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Deploy. The build script writes `assets/js/env.js` from those values and copies the site into `public/` for Vercel.

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
