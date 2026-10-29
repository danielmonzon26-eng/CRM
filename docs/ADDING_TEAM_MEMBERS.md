# Adding a team member to Catapult CRM

The CRM has no public sign-up page by design — new accounts are created by an
admin via the Supabase dashboard. Once the account exists, the app handles
the rest automatically.

## Steps

1. Open the Supabase dashboard for this project → **Authentication → Users**.
2. Click **Add user**.
3. Enter their email address. Choose one:
   - **Auto-generate password** and share it with them directly (fastest for
     an internal team), or
   - **Send invite email** so they set their own password via a link.
4. Click **Create user**.

That's it on the Supabase side. A database trigger (`on_auth_user_created`,
in `supabase/migrations/0003_auth_profiles.sql`) automatically creates their
CRM profile the moment the `auth.users` row exists — they don't need to do
anything else to "finish" setup.

## Setting their role

Every new profile defaults to **`rep`** (can manage their own leads, deals,
contacts, and tasks). To promote someone to **`admin`** (can manage every
record and change other people's roles):

1. Sign in to the CRM as an existing admin.
2. Go to **Team** in the sidebar (admin-only link).
3. Find their name and change the role dropdown to **Admin**.

## Signing in

They sign in at `/login` with the email + password you (or they) set in
step 3 above. If they ever forget it, "Forgot password?" on the login page
sends them a reset link — no admin involvement needed.

## If you want self-service sign-up instead

Right now, every account has to be created by an admin this way. If you'd
rather let people request their own accounts (e.g. a "Sign up" page, maybe
gated by an invite code or a specific email domain), that's a small,
separate feature — ask and it can be built.
