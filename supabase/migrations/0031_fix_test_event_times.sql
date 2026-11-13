-- 0030 entered the TEST events' times as "America/Edmonton". Alberta moved to permanent
-- UTC-6 this month, and the app reads and writes event times as UTC-6, but a database
-- with older time zone data still treats America/Edmonton winter times as UTC-7, which
-- would store them an hour late. This rewrites each TEST event's times as the same wall-
-- clock time in UTC-6; where the database already agrees, nothing changes. Runs once
-- (marker), so an event's time edited in the app afterwards is left alone.

do $$
begin
  if exists (select 1 from public.migration_markers where key = '0031_fix_test_event_times') then
    return;
  end if;

  update public.events
  set starts_at = (starts_at at time zone 'America/Edmonton') at time zone 'Etc/GMT+6',
      ends_at = (ends_at at time zone 'America/Edmonton') at time zone 'Etc/GMT+6',
      registration_closes_at = (registration_closes_at at time zone 'America/Edmonton') at time zone 'Etc/GMT+6'
  where title like 'TEST – %'
    and slug ~ '^test-(founders-breakfast|apex-forum-workshop|funding-101-webinar|investor-pitch-night|year-end-mixer)-[0-9a-f]{6}$';

  insert into public.migration_markers (key) values ('0031_fix_test_event_times');
end;
$$;
