-- Removes the five TEST events from 0030, once, with their budget lines (unless a line
-- has expenses recorded, which keeps it, unlinked). Their registrations, documents,
-- promotions and remaining post requests go with the events. Runs once (marker).

do $$
declare
  v_events uuid[];
begin
  if exists (select 1 from public.migration_markers where key = '0042_remove_test_events') then
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_events from public.events
  where title like 'TEST – %'
    and slug ~ '^test-(founders-breakfast|apex-forum-workshop|funding-101-webinar|investor-pitch-night|year-end-mixer)-[0-9a-f]{6}$';

  delete from public.budget_lines l
  where l.event_id = any (v_events)
    and not exists (select 1 from public.budget_expenses e where e.line_id = l.id);

  delete from public.events where id = any (v_events);

  insert into public.migration_markers (key) values ('0042_remove_test_events');
end;
$$;
