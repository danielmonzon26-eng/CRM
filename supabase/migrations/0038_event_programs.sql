-- The Program dropdown on events, as a list the team can add to and remove from.
-- Events keep their program as text, so removing a program from the list doesn't change
-- events already using it. Filled once with the original four and any program already on
-- an event. Safe to re-run.

create table if not exists public.event_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists event_programs_name_idx on public.event_programs (lower(btrim(name)));

alter table public.event_programs enable row level security;
drop policy if exists "team manage event programs" on public.event_programs;
create policy "team manage event programs" on public.event_programs
  for all to authenticated using (true) with check (true);
revoke all on public.event_programs from anon;
grant select, insert, update, delete on public.event_programs to authenticated;

do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0038_event_programs') then
    insert into public.event_programs (name, sort_order)
    select name, ord from (values ('Apex Forum', 1), ('Apex Summit', 2), ('Catapult Event', 3), ('Elevate IP', 4)) as v(name, ord)
    on conflict do nothing;
    insert into public.event_programs (name, sort_order)
    select distinct btrim(e.program), 100 from public.events e
    where e.program is not null and btrim(e.program) <> ''
    on conflict do nothing;
    insert into public.migration_markers (key) values ('0038_event_programs');
  end if;
end;
$$;
