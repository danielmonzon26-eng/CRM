-- Notes for the Activity Centre: typed (note, call, meeting, email), pinnable and
-- editable, attached to a lead and its company. The activity log stays as the record of
-- what happened automatically. Safe to re-run.

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  kind text not null default 'note' check (kind in ('note', 'call', 'meeting', 'email')),
  body text not null check (length(btrim(body)) > 0 and length(body) <= 20000),
  -- When the call or meeting happened; defaults to when the note was written.
  occurred_at timestamptz not null default now(),
  pinned boolean not null default false,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_id_idx on public.lead_notes (lead_id, occurred_at desc);
create index if not exists lead_notes_company_id_idx on public.lead_notes (company_id);

drop trigger if exists lead_notes_set_updated_at on public.lead_notes;
create trigger lead_notes_set_updated_at before update on public.lead_notes
  for each row execute function public.set_updated_at();

alter table public.lead_notes enable row level security;
drop policy if exists "authenticated all lead_notes" on public.lead_notes;
create policy "authenticated all lead_notes" on public.lead_notes
  for all to authenticated using (true) with check (true);
revoke all on table public.lead_notes from anon;
