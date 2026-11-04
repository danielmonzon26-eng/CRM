# Onboarding a developer to work on the Catapult CRM codebase

This is for someone who will write code on this project from their own
Claude Code (or regular git) setup — different from
[`ADDING_TEAM_MEMBERS.md`](./ADDING_TEAM_MEMBERS.md), which is about giving
someone a login to *use* the CRM as an end user.

There are up to three separate systems to grant access to, depending on how
much the new developer needs to do. Most contributors only need #1.

## 1. GitHub repo access (required)

Repo: `danielmonzon26-eng/CRM`

1. Go to the repo on GitHub → **Settings → Collaborators and teams**.
2. Click **Add people**, enter their GitHub username or email.
3. Permission level: **Write** is enough to push branches and open PRs.
   Don't grant **Admin** unless they need to change repo settings.
4. They accept the invite from the email GitHub sends them.

### Branch workflow

Active development has been happening directly on
`claude/calgary-business-leads-qgm9oy` and pushed straight to it. With two
people working at once, have the new developer **create their own branch**
off it (or off `main`, whichever you're treating as current) for their
changes, and open a pull request rather than pushing straight to the shared
branch — otherwise concurrent pushes will conflict or silently overwrite
each other's work.

## 2. Vercel access (only if they need to see/manage deployments)

Project: `crm` under the `danielmonzon26-7730` team.

1. Vercel dashboard → the team → **Settings → Members → Invite Member**.
2. Give them **Member** role (not **Owner**) unless they need to manage
   billing or remove other members.

Not needed if they're just writing code and you'll keep handling
deployment/production promotion yourself.

## 3. Supabase access (only if they need direct database/dashboard access)

Project: the `kteeooyybpwnnowkuwra` Supabase project (shows as "Catapult" in
the dashboard).

1. Supabase dashboard → **Project Settings → Team** (or the organization's
   team settings, depending on plan).
2. Invite by email, choosing a role appropriate to what they need (e.g.
   **Developer** to run migrations and view data, not **Owner**).

Not needed for day-to-day coding — only if they'll run migrations or query
the live database directly rather than through the app.

## Local development setup (after GitHub access is granted)

```
git clone https://github.com/danielmonzon26-eng/CRM.git
cd CRM
git checkout claude/calgary-business-leads-qgm9oy   # or their own branch
npm install
```

They'll need a `.env.local` file (gitignored, never commit it) with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Get these two values from Supabase dashboard → **Project Settings → API**
(the "anon" / "publishable" key — not the service-role/secret key) and send
them to the new developer over a secure channel (not committed to the
repo, not pasted in a public place). They do **not** need the service-role
key for local development — the app's authenticated pages work fine
without it.

Then:

```
npm run dev
```

## CRM login (if they'll also use the app day-to-day)

Separate from all of the above — see
[`ADDING_TEAM_MEMBERS.md`](./ADDING_TEAM_MEMBERS.md) to create their actual
sign-in account in the CRM itself.
