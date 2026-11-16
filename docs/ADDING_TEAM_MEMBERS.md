# Adding a team member to Catapult CRM

Everyone on the team has the same full admin access. Add and remove people on the
**Admin** page in the sidebar.

## Adding someone

1. Go to **Admin** and click **Add user**.
2. Enter their name and email.
3. Copy the link it gives you, or click **Open in email**, and send it to them.
4. They open the link, set a password, and are signed in.

The link works once and usually expires within an hour (the Supabase "Email OTP
expiration" setting). If it runs out, click **Get link** on their row for a new one.
The same button gets someone back in if they forget their password.

The app doesn't send these emails itself, because Supabase's built-in email only
reaches its own project team and has a low hourly limit.

## Removing someone

Click **Remove** on their row. Their account is blocked rather than deleted, because
leads, deals and history point to it. **Restore** brings them back. A session they
already have open can keep working for up to an hour, until its token expires.

## Accounts marked "No admin access"

Accounts created outside this page, including in the Supabase dashboard, start as
`rep` without admin access. Check you recognize the person, then click
**Give admin access**.

Turn off **Allow new users to sign up** in Supabase under **Authentication → Sign In /
Providers**. While it's on, anyone with the public project key can create an account
and, once signed in, read CRM data. Accounts added on the Admin page work with it off.

## Server key

Adding and removing users needs `SUPABASE_SERVICE_ROLE_KEY`, which is set on Vercel.
Without it, such as on a local copy, the page lists users but can't change accounts.

## Password and invite links (Supabase URL settings)

Reset and invite emails only open the live site if Supabase allows it. In Supabase →
Authentication → URL Configuration:

- **Site URL:** `https://crm-two-delta-91.vercel.app`
- **Redirect URLs:** `https://crm-two-delta-91.vercel.app/**` and `http://localhost:3000/**`

If the live address is missing, Supabase falls back to the Site URL, so links open
`localhost:3000` instead of the live site.

## Deploys

The live site updates when a change lands on `claude/calgary-business-leads-qgm9oy`.
The Vercel project is on the free (Hobby) plan, which caps deploys per day; when it's hit,
merges show "Deployment rate limited" and nothing publishes until the next change after
the limit resets (there's no Create Deployment button on Hobby).
