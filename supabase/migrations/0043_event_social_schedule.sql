-- Social posts planned from an event's page, timed relative to the event: 4 weeks,
-- 2 weeks, 1 week or 1 day before (or a set date, stored as usual). A relative post keeps
-- its time of day and moves with the event if the event's date changes. Safe to re-run.

alter table public.social_posts
  add column if not exists event_days_before integer
  check (event_days_before is null or event_days_before in (1, 7, 14, 28));

create index if not exists social_posts_event_days_idx on public.social_posts (event_id, event_days_before) where event_days_before is not null;

create or replace function public.events_move_planned_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    update public.social_posts p
    set scheduled_at = (
      (((new.starts_at at time zone 'Etc/GMT+6')::date - p.event_days_before)::timestamp
        + coalesce((p.scheduled_at at time zone 'Etc/GMT+6')::time, time '09:00'))
      at time zone 'Etc/GMT+6'
    )
    where p.event_id = new.id and p.event_days_before is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists events_move_planned_posts on public.events;
create trigger events_move_planned_posts after update of starts_at on public.events
  for each row execute function public.events_move_planned_posts();
