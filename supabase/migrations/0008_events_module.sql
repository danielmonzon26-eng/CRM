-- Events: in-person/online/hybrid events, public registration, post-event documents and
-- videos. Registrants become CRM leads and contacts.
--
-- The public registration page runs as `anon`, so it never reads or writes these tables
-- directly. Its only access is the two SECURITY DEFINER functions below, which expose just
-- the public fields of a published event and just the registration flow.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_type text,
  description text,
  image_url text,
  format text not null default 'in_person' check (format in ('in_person', 'online', 'hybrid')),
  venue_name text,
  venue_address text,
  online_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  ticket_type text not null default 'free' check (ticket_type in ('free', 'paid')),
  ticket_price numeric check (ticket_price is null or ticket_price >= 0),
  currency text not null default 'CAD',
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  attendance_mode text not null check (attendance_mode in ('in_person', 'online')),
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  checked_in_at timestamptz,
  ticket_code uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email)
);

create table if not exists public.event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('document', 'video')),
  title text not null,
  storage_path text,
  url text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint event_resources_has_target check (
    (kind = 'document' and storage_path is not null) or (kind = 'video' and url is not null)
  )
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists event_registrations_event_id_idx on public.event_registrations (event_id);
create index if not exists event_registrations_lead_id_idx on public.event_registrations (lead_id);
create index if not exists event_resources_event_id_idx on public.event_resources (event_id);
create index if not exists contacts_lower_email_idx on public.contacts (lower(email));

drop trigger if exists set_updated_at on public.events;
create trigger set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.event_registrations;
create trigger set_updated_at before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_resources enable row level security;

drop policy if exists "authenticated all events" on public.events;
create policy "authenticated all events" on public.events
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all event_registrations" on public.event_registrations;
create policy "authenticated all event_registrations" on public.event_registrations
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all event_resources" on public.event_resources;
create policy "authenticated all event_resources" on public.event_resources
  for all to authenticated using (true) with check (true);

-- Registrations appear on the lead timeline.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in (
    'status_change', 'enrichment_run', 'email_sent', 'call_logged', 'sync_matched',
    'task_completed', 'note', 'deal_created', 'deal_stage_change', 'event_registration'
  ));

-- Private bucket for post-event documents, team access only.
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-documents', 'event-documents', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "authenticated manage event documents" on storage.objects;
create policy "authenticated manage event documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'event-documents')
  with check (bucket_id = 'event-documents');

-- Public fields of one event. Excludes online_url, which only goes to online registrants.
-- Dropped first because 0009 changes the return type and every migration is re-applied.
drop function if exists public.get_public_event(text);
create function public.get_public_event(p_slug text)
returns table (
  title text,
  event_type text,
  description text,
  image_url text,
  format text,
  venue_name text,
  venue_address text,
  starts_at timestamptz,
  ends_at timestamptz,
  ticket_type text,
  ticket_price numeric,
  currency text,
  status text,
  spots_remaining integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.title, e.event_type, e.description, e.image_url, e.format, e.venue_name, e.venue_address,
    e.starts_at, e.ends_at, e.ticket_type, e.ticket_price, e.currency, e.status,
    case when e.capacity is null then null else greatest(
      e.capacity - (
        select count(*)::integer from public.event_registrations r
        where r.event_id = e.id and r.status = 'registered'
      ),
      0
    ) end
  from public.events e
  where e.slug = p_slug and e.status in ('published', 'cancelled');
$$;

-- Registers one person and links them to the CRM: reuses the contact with this email if
-- there is one, otherwise adds a contact under the matching company's lead, creating the
-- company and lead when needed. Existing CRM fields are never overwritten. A repeat
-- registration reveals nothing, so this can't be used to retrieve someone else's ticket.
create or replace function public.register_for_event(
  p_slug text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_company text default null,
  p_attendance_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_name text := left(trim(coalesce(p_full_name, '')), 200);
  v_email text := left(lower(trim(coalesce(p_email, ''))), 320);
  v_phone text := nullif(left(trim(coalesce(p_phone, '')), 40), '');
  v_company text := nullif(left(trim(coalesce(p_company, '')), 200), '');
  v_mode text;
  v_taken integer;
  v_existing public.event_registrations%rowtype;
  v_company_id uuid;
  v_company_name text;
  v_lead_id uuid;
  v_contact_id uuid;
  v_ticket uuid;
begin
  if v_name = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Locking the event row keeps two simultaneous registrations from overselling capacity.
  select * into v_event from public.events where slug = p_slug for update;
  if not found or v_event.status = 'draft' then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_event.status <> 'published' or coalesce(v_event.ends_at, v_event.starts_at) < now() then
    return jsonb_build_object('status', 'closed');
  end if;

  if v_event.format = 'hybrid' then
    if p_attendance_mode not in ('in_person', 'online') or p_attendance_mode is null then
      return jsonb_build_object('status', 'invalid');
    end if;
    v_mode := p_attendance_mode;
  else
    v_mode := v_event.format;
  end if;

  select * into v_existing from public.event_registrations
  where event_id = v_event.id and email = v_email;
  if found and v_existing.status = 'registered' then
    return jsonb_build_object('status', 'already_registered');
  end if;

  if v_event.capacity is not null then
    select count(*) into v_taken from public.event_registrations
    where event_id = v_event.id and status = 'registered';
    if v_taken >= v_event.capacity then
      return jsonb_build_object('status', 'sold_out');
    end if;
  end if;

  select c.id, c.lead_id into v_contact_id, v_lead_id from public.contacts c
  where lower(c.email) = v_email
  order by c.is_primary desc, c.created_at
  limit 1;

  if v_contact_id is null then
    if v_company is not null then
      select co.id into v_company_id from public.companies co
      where co.normalized_name = lower(regexp_replace(v_company, '\s+', ' ', 'g'))
      order by co.created_at
      limit 1;
    end if;

    if v_company_id is null then
      v_company_name := coalesce(v_company, v_name || ' (no organization listed)');
      insert into public.companies (name, normalized_name)
      values (v_company_name, lower(regexp_replace(v_company_name, '\s+', ' ', 'g')))
      returning id into v_company_id;
    end if;

    insert into public.leads (company_id) values (v_company_id)
    on conflict (company_id) do nothing;
    select l.id into v_lead_id from public.leads l where l.company_id = v_company_id;

    insert into public.contacts (lead_id, full_name, email, phone, source, is_primary)
    values (
      v_lead_id, v_name, v_email, v_phone, 'event_registration',
      not exists (select 1 from public.contacts c where c.lead_id = v_lead_id and c.is_primary)
    )
    returning id into v_contact_id;
  end if;

  insert into public.event_registrations
    (event_id, lead_id, contact_id, full_name, email, phone, company_name, attendance_mode)
  values (v_event.id, v_lead_id, v_contact_id, v_name, v_email, v_phone, v_company, v_mode)
  on conflict (event_id, email) do update set
    status = 'registered',
    lead_id = excluded.lead_id,
    contact_id = excluded.contact_id,
    full_name = excluded.full_name,
    phone = excluded.phone,
    company_name = excluded.company_name,
    attendance_mode = excluded.attendance_mode
  returning ticket_code into v_ticket;

  insert into public.activities (lead_id, type, body, metadata)
  values (
    v_lead_id, 'event_registration',
    v_name || ' registered for "' || v_event.title || '"',
    jsonb_build_object('event_id', v_event.id)
  );

  return jsonb_build_object(
    'status', 'registered',
    'ticket_code', v_ticket,
    'online_url', case when v_mode = 'online' then v_event.online_url end
  );
end;
$$;

revoke all on function public.get_public_event(text) from public;
revoke all on function public.register_for_event(text, text, text, text, text, text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;
grant execute on function public.register_for_event(text, text, text, text, text, text) to anon, authenticated;

-- Sample event from catapultready.com. The site doesn't state a year or a price; 2026 is
-- inferred from its banner's upload date and free is a placeholder.
insert into public.events (
  slug, title, event_type, description, image_url, format, venue_name, venue_address,
  starts_at, ends_at, ticket_type, status
)
values (
  'cross-border-ready-ip-ai-and-growing-beyond-canada',
  'Cross-Border Ready — IP, AI, and Growing Beyond Canada',
  'Apex Forum',
  'For founders and small to mid-sized businesses expanding into the U.S. or Mexico, adopting AI, or preparing for capital or an exit, and who want to protect their IP, data, and ownership along the way.',
  'https://www.catapultready.com/wp-content/uploads/2026/09/WhatsApp-Image-2026-09-17-at-11.32.42-1-1024x512.jpeg',
  'in_person',
  'Calgary Public Library Central - Patricia Whelan Performance Hall',
  '800 3 St SE, Calgary',
  timestamptz '2026-10-09 10:00 America/Edmonton',
  timestamptz '2026-10-09 13:00 America/Edmonton',
  'free',
  'published'
)
on conflict (slug) do nothing;
