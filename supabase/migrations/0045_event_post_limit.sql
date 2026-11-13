-- Event social posts: at most three per event, one per timing. The automatic requests made
-- when an event is published now leave out a timing that already has a planned post, and
-- stop at three posts. (The app enforces the same limit when posts are planned or moved.)
-- Safe to re-run.

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
    if ((((ev.starts_at at time zone 'Etc/GMT+6')::date - r.days)::timestamp + time '09:00') at time zone 'Etc/GMT+6') > now()
      -- An event has at most three posts, one per timing: skip a timing someone already
      -- planned a post for, and stop once the event has three.
      and not exists (select 1 from public.social_posts p where p.event_id = ev.id and p.event_days_before = r.days)
      and (select count(*) from public.social_posts p where p.event_id = ev.id) < 3
    then
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
