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

The login page has three experiences, switched with tabs or
`login.html?experience=password|google|apple`:

- **Email:** church-created volunteer accounts (no public sign-up form)
- **Google:** OAuth through Google Cloud
- **Apple:** OAuth through an Apple Developer account

Any signed-in user can currently read announcements. Before turning on
Google or Apple, either keep **Authentication → Providers → Email →
Confirm email / disable sign-ups** strict, or add an allow-list so random
Google/Apple accounts cannot open volunteer pages.

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
6. Add class, building, room, and assignment details in
   **Table Editor → class_sessions**.
7. Add up to 10 Bible studies and their contacts in
   **Table Editor → bible_studies**. Use `display_order` values 1–10.
8. Review volunteer requests in **Table Editor → week_off_requests**.
9. Optional videos: upload files under 50 MB to the `volunteer-media`
   bucket, then put the file path (for example `training/welcome.mp4`)
   in the announcement `video_path` column.

Never put the `service_role` key in this website. The anon key is safe
in the browser because Row Level Security protects the portal data.

## Google and Apple login

The website already calls `signInWithOAuth`. The providers stay off until
you enable them in Supabase. Your callback URL is:

`https://nplkmngfvfmweiulinxl.supabase.co/auth/v1/callback`

In **Authentication → URL Configuration**, set:

- Site URL to the Vercel domain
- Redirect URLs to include the Vercel domain, `/volunteer.html`, `/login.html`, and local `http://localhost:8000/**`

### Google

1. Create a Google Cloud project and open [Google Auth Platform](https://console.cloud.google.com/auth/overview).
2. Configure branding, then add scopes: `openid`, `userinfo.email`, `userinfo.profile`.
3. Create an OAuth **Web application** client.
4. Authorized JavaScript origins: your Vercel URL and `http://localhost:8000`.
5. Authorized redirect URI: the Supabase callback URL above.
6. Paste the Client ID and Client Secret into **Supabase → Authentication → Providers → Google** and enable it.

### Apple

Apple web login needs a paid [Apple Developer](https://developer.apple.com) account.

1. Create an App ID with **Sign in with Apple**.
2. Create a **Services ID** (this is the client ID for the website).
3. Set the return URL to the same Supabase callback URL.
4. Create a Sign in with Apple key (`.p8`) and generate the secret in the Supabase Apple provider screen.
5. Enable **Apple** in **Authentication → Providers**.
6. Rotate that secret at least every 6 months, or Apple login will stop working.

Official guides: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).

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
