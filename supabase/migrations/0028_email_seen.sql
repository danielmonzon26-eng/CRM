-- Which received emails each person has looked at in the CRM, so the Communication tab
-- can show a count of new replies that clears as they're read. This is separate from
-- Outlook's own read flag: reading in Outlook doesn't clear it, and opening an email
-- here doesn't mark it read in Outlook. Safe to re-run.

create table if not exists public.email_seen (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email_id uuid not null references public.emails (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, email_id)
);

create index if not exists email_seen_email_idx on public.email_seen (email_id);

alter table public.email_seen enable row level security;

drop policy if exists "own email_seen read" on public.email_seen;
create policy "own email_seen read" on public.email_seen
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own email_seen insert" on public.email_seen;
create policy "own email_seen insert" on public.email_seen
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own email_seen delete" on public.email_seen;
create policy "own email_seen delete" on public.email_seen
  for delete to authenticated using (user_id = auth.uid());

revoke all on table public.email_seen from anon;
grant select, insert, delete on table public.email_seen to authenticated;

-- The received emails that count as "new" for the signed-in person: the last 30 days,
-- in their own mailbox if they've connected one (otherwise every connected mailbox,
-- so someone without Outlook still sees the team's replies), and not yet opened here.
create or replace function public.unseen_reply_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select e.id
  from public.emails e
  where e.direction = 'inbound'
    and e.sent_at > now() - interval '30 days'
    and (
      not exists (select 1 from public.mail_accounts a where a.user_id = auth.uid())
      or e.account_id in (select a.id from public.mail_accounts a where a.user_id = auth.uid())
    )
    and not exists (select 1 from public.email_seen s where s.email_id = e.id and s.user_id = auth.uid());
$$;

create or replace function public.unseen_reply_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.unseen_reply_ids();
$$;

-- "Mark all as seen": clears the count in one step.
create or replace function public.mark_all_emails_seen()
returns integer
language sql
volatile
security invoker
set search_path = public
as $$
  with added as (
    insert into public.email_seen (user_id, email_id)
    select auth.uid(), u.id from public.unseen_reply_ids() as u(id)
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from added;
$$;

revoke all on function public.unseen_reply_ids() from public, anon;
revoke all on function public.unseen_reply_count() from public, anon;
revoke all on function public.mark_all_emails_seen() from public, anon;
grant execute on function public.unseen_reply_ids() to authenticated;
grant execute on function public.unseen_reply_count() to authenticated;
grant execute on function public.mark_all_emails_seen() to authenticated;
