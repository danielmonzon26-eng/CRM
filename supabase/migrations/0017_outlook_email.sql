-- Outlook email and calendar. Each team member can connect their own Microsoft 365
-- mailbox. Only messages and meetings that involve a known contact's email address are
-- stored, so the rest of a mailbox never reaches the CRM. Safe to re-run.

-- ---------------------------------------------------------------------------
-- mail_accounts: one connected mailbox per user. refresh_token holds an
-- application-encrypted (AES-256-GCM) Microsoft refresh token and is never readable
-- by signed-in users: they get every other column, and all writes go through the
-- server's service-role client.
-- ---------------------------------------------------------------------------
create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  refresh_token text not null,
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect')),
  inbox_sync_link text,
  sent_sync_link text,
  last_synced_at timestamptz,
  sync_started_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists mail_accounts_set_updated_at on public.mail_accounts;
create trigger mail_accounts_set_updated_at before update on public.mail_accounts
  for each row execute function public.set_updated_at();

alter table public.mail_accounts enable row level security;

drop policy if exists "authenticated read mail_accounts" on public.mail_accounts;
create policy "authenticated read mail_accounts" on public.mail_accounts
  for select to authenticated using (true);

revoke all on table public.mail_accounts from anon, authenticated;
grant select (id, user_id, email, display_name, status, last_synced_at, last_error, created_at)
  on public.mail_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- emails: messages to or from a known contact. `participants` holds every lowercased
-- address on the message except the mailbox owner's, so a record page finds its
-- emails with an array overlap against its contacts' addresses.
-- ---------------------------------------------------------------------------
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mail_accounts (id) on delete cascade,
  graph_id text not null,
  conversation_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  participants text[] not null default '{}',
  subject text,
  preview text,
  body text,
  sent_at timestamptz not null,
  is_read boolean not null default true,
  has_attachments boolean not null default false,
  web_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, graph_id)
);

create index if not exists emails_participants_idx on public.emails using gin (participants);
create index if not exists emails_sent_at_idx on public.emails (sent_at desc);
create index if not exists emails_conversation_idx on public.emails (account_id, conversation_id);

drop trigger if exists emails_set_updated_at on public.emails;
create trigger emails_set_updated_at before update on public.emails
  for each row execute function public.set_updated_at();

alter table public.emails enable row level security;

drop policy if exists "authenticated read emails" on public.emails;
create policy "authenticated read emails" on public.emails
  for select to authenticated using (true);

revoke all on table public.emails from anon;
revoke insert, update, delete on table public.emails from authenticated;

-- ---------------------------------------------------------------------------
-- meetings: Outlook calendar events with at least one known contact attending.
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mail_accounts (id) on delete cascade,
  graph_id text not null,
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  location text,
  online_url text,
  organizer_email text,
  participants text[] not null default '{}',
  web_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, graph_id)
);

create index if not exists meetings_participants_idx on public.meetings using gin (participants);
create index if not exists meetings_starts_at_idx on public.meetings (starts_at);

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

drop policy if exists "authenticated read meetings" on public.meetings;
create policy "authenticated read meetings" on public.meetings
  for select to authenticated using (true);

revoke all on table public.meetings from anon;
revoke insert, update, delete on table public.meetings from authenticated;

-- Case-insensitive contact lookups for matching mail to contacts.
create index if not exists contacts_email_lower_idx on public.contacts (lower(email));
