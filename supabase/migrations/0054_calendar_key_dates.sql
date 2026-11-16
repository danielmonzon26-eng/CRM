-- Key dates: anything the team wants on the calendar that isn't an event, task or marketing
-- item (a board meeting, a grant deadline). A title, a day, an optional person and notes.
-- Safe to re-run.

create table if not exists public.calendar_key_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  on_date date not null,
  notes text,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_key_dates_on_date_idx on public.calendar_key_dates (on_date);

drop trigger if exists calendar_key_dates_set_updated_at on public.calendar_key_dates;
create trigger calendar_key_dates_set_updated_at before update on public.calendar_key_dates
  for each row execute function public.set_updated_at();

alter table public.calendar_key_dates enable row level security;
drop policy if exists "team manage key dates" on public.calendar_key_dates;
create policy "team manage key dates" on public.calendar_key_dates for all to authenticated using (true) with check (true);
revoke all on public.calendar_key_dates from anon;
grant select, insert, update, delete on public.calendar_key_dates to authenticated;
