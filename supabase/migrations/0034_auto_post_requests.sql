-- Every published event gets three post requests in Marketing, scheduled 2 weeks, 1 week
-- and 1 day before it starts (9:00 a.m. Calgary time), each with a starter caption. This
-- lives in the database so it happens however an event is published.
--   * Published (or created published): the requests are added, skipping any date
--     that has already passed.
--   * The start time changes: its requests move with it.
--   * Cancelled, archived or deleted: requests nobody has worked on yet (still Requested)
--     are removed; posts someone has written or approved stay, unlinked.
-- Deleting one request keeps it deleted; it only comes back if the event is unpublished
-- and published again. Safe to re-run.

alter table public.social_posts
  add column if not exists event_id uuid references public.events (id) on delete set null,
  add column if not exists auto_days_before integer check (auto_days_before is null or auto_days_before in (1, 7, 14));

create unique index if not exists social_posts_event_auto_idx
  on public.social_posts (event_id, auto_days_before) where event_id is not null and auto_days_before is not null;
create index if not exists social_posts_event_idx on public.social_posts (event_id);

-- When the event happens, in words, e.g. "Thursday, December 3 at 7:30 a.m." (UTC-6).
create or replace function public.event_when_words(p_starts_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(to_char(p_starts_at at time zone 'Etc/GMT+6', 'FMDay, FMMonth FMDD "at" FMHH12:MI a.m.'));
$$;

create or replace function public.event_where_words(p_format text, p_venue text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_format = 'online' then 'online'
    when p_format = 'hybrid' then coalesce('at ' || nullif(btrim(p_venue), '') || ' and online', 'in person and online')
    else coalesce('at ' || nullif(btrim(p_venue), ''), 'in person')
  end;
$$;

-- Adds whichever of the three requests an event doesn't have yet.
create or replace function public.create_event_post_requests(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev record;
  v_when text;
  v_where text;
  v_added integer := 0;
  r record;
begin
  select id, title, starts_at, format, venue_name, status, archived_at into ev from public.events where id = p_event_id;
  if ev.id is null or ev.status <> 'published' or ev.archived_at is not null then
    return 0;
  end if;
  v_when := public.event_when_words(ev.starts_at);
  v_where := public.event_where_words(ev.format, ev.venue_name);

  for r in
    select * from (values
      (14, ev.title || ': 2 weeks to go',
       ev.title || ' is two weeks away! ' || v_when || ', ' || v_where || '. Spots are limited, so register now.'),
      (7, ev.title || ': 1 week to go',
       'One week until ' || ev.title || '! ' || v_when || ', ' || v_where || '. Have you registered yet?'),
      (1, ev.title || ': tomorrow',
       ev.title || ' is tomorrow! ' || v_when || ', ' || v_where || '. Last chance to register.')
    ) as t(days, title, caption)
  loop
    -- 9:00 a.m. Calgary time, that many days before the event's Calgary date.
    if ((((ev.starts_at at time zone 'Etc/GMT+6')::date - r.days)::timestamp + time '09:00') at time zone 'Etc/GMT+6') > now() then
      insert into public.social_posts (title, caption, scheduled_at, status, event_id, auto_days_before)
      values (
        left(r.title, 200), r.caption,
        (((ev.starts_at at time zone 'Etc/GMT+6')::date - r.days)::timestamp + time '09:00') at time zone 'Etc/GMT+6',
        'requested', ev.id, r.days
      )
      on conflict (event_id, auto_days_before) where event_id is not null and auto_days_before is not null do nothing;
      if found then v_added := v_added + 1; end if;
    end if;
  end loop;
  return v_added;
end;
$$;
revoke all on function public.create_event_post_requests(uuid) from public, anon, authenticated;

-- Removes an event's requests that nobody has moved on yet (still Requested).
create or replace function public.remove_event_post_requests(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.social_posts
  where event_id = p_event_id and auto_days_before is not null and status = 'requested';
$$;
revoke all on function public.remove_event_post_requests(uuid) from public, anon, authenticated;

create or replace function public.events_post_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean;
  v_was_live boolean;
begin
  if tg_op = 'DELETE' then
    perform public.remove_event_post_requests(old.id);
    return old;
  end if;

  v_live := new.status = 'published' and new.archived_at is null;
  v_was_live := tg_op = 'UPDATE' and old.status = 'published' and old.archived_at is null;

  if v_live and not v_was_live then
    perform public.create_event_post_requests(new.id);
  elsif v_was_live and not v_live then
    perform public.remove_event_post_requests(new.id);
  elsif v_live and new.starts_at is distinct from old.starts_at then
    -- Move the event's dated requests with it (any status: changing a date never needs approval).
    update public.social_posts p
    set scheduled_at = (((new.starts_at at time zone 'Etc/GMT+6')::date - p.auto_days_before)::timestamp + time '09:00') at time zone 'Etc/GMT+6'
    where p.event_id = new.id and p.auto_days_before is not null;
  end if;

  if v_live and new.title is distinct from old.title and tg_op = 'UPDATE' then
    -- Untouched requests follow a renamed event.
    update public.social_posts p
    set title = left(replace(p.title, old.title, new.title), 200), caption = replace(p.caption, old.title, new.title)
    where p.event_id = new.id and p.auto_days_before is not null and p.status = 'requested';
  end if;
  return new;
end;
$$;

drop trigger if exists events_post_requests on public.events;
create trigger events_post_requests after insert or update of status, archived_at, starts_at, title on public.events
  for each row execute function public.events_post_requests();
drop trigger if exists events_post_requests_delete on public.events;
create trigger events_post_requests_delete before delete on public.events
  for each row execute function public.events_post_requests();

-- Events already published get their requests once.
do $$
declare
  ev record;
begin
  if not exists (select 1 from public.migration_markers where key = '0034_auto_post_requests_backfill') then
    for ev in select id from public.events where status = 'published' and archived_at is null and starts_at > now() loop
      perform public.create_event_post_requests(ev.id);
    end loop;
    insert into public.migration_markers (key) values ('0034_auto_post_requests_backfill');
  end if;
end;
$$;
