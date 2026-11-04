-- Event planning fields for the directory and five-step Create Event flow: program, owner,
-- archiving, agenda, speakers, registration settings, a waitlist, a budget allocation,
-- banner uploads, and reusable templates. All additive, with defaults matching how
-- existing events already behave.

alter table public.events
  add column if not exists program text,
  add column if not exists owner_id uuid references auth.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists agenda jsonb not null default '[]',
  add column if not exists speakers jsonb not null default '[]',
  add column if not exists collect_company boolean not null default true,
  add column if not exists collect_phone boolean not null default true,
  add column if not exists waitlist_enabled boolean not null default false,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists confirmation_message text,
  add column if not exists budget_amount numeric check (budget_amount is null or budget_amount >= 0),
  add column if not exists funding_source text,
  add column if not exists budget_notes text;

-- The sample event's "Apex Forum" is a program, so it moves to the new field.
update public.events
set program = event_type, event_type = null
where slug = 'cross-border-ready-ip-ai-and-growing-beyond-canada' and program is null and event_type = 'Apex Forum';

alter table public.event_registrations drop constraint if exists event_registrations_status_check;
alter table public.event_registrations add constraint event_registrations_status_check
  check (status in ('registered', 'waitlisted', 'cancelled'));

create table if not exists public.event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.event_templates;
create trigger set_updated_at before update on public.event_templates
  for each row execute function public.set_updated_at();

alter table public.event_templates enable row level security;

drop policy if exists "authenticated all event_templates" on public.event_templates;
create policy "authenticated all event_templates" on public.event_templates
  for all to authenticated using (true) with check (true);

-- Banners appear on public landing pages, so this bucket is publicly readable. Only team
-- members can add or change files. Materials stay in the private event-documents bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-banners', 'event-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "authenticated manage event banners" on storage.objects;
create policy "authenticated manage event banners" on storage.objects
  for all to authenticated
  using (bucket_id = 'event-banners')
  with check (bucket_id = 'event-banners');

-- Internal planning fields (owner, budget, online_url) stay out of the public result.
drop function if exists public.get_public_event(text);
create function public.get_public_event(p_slug text)
returns table (
  title text,
  program text,
  event_type text,
  description text,
  image_url text,
  format text,
  venue_name text,
  venue_address text,
  starts_at timestamptz,
  ends_at timestamptz,
  agenda jsonb,
  speakers jsonb,
  collect_company boolean,
  collect_phone boolean,
  waitlist_enabled boolean,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
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
    e.title, e.program, e.event_type, e.description, e.image_url, e.format, e.venue_name,
    e.venue_address, e.starts_at, e.ends_at, e.agenda, e.speakers, e.collect_company,
    e.collect_phone, e.waitlist_enabled, e.registration_opens_at, e.registration_closes_at,
    e.ticket_type, e.ticket_price, e.currency, e.status,
    case when e.capacity is null then null else greatest(
      e.capacity - (
        select count(*)::integer from public.event_registrations r
        where r.event_id = e.id and r.status = 'registered'
      ),
      0
    ) end
  from public.events e
  where e.slug = p_slug and e.status in ('published', 'cancelled') and e.archived_at is null;
$$;

-- As in 0008, plus registration windows, a waitlist, and a custom confirmation message.
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
  v_status text := 'registered';
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
  if not found or v_event.status = 'draft' or v_event.archived_at is not null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_event.status <> 'published'
    or coalesce(v_event.ends_at, v_event.starts_at) < now()
    or v_event.registration_closes_at < now() then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_event.registration_opens_at > now() then
    return jsonb_build_object('status', 'not_open');
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
  if found and v_existing.status in ('registered', 'waitlisted') then
    return jsonb_build_object('status', 'already_registered');
  end if;

  if v_event.capacity is not null then
    select count(*) into v_taken from public.event_registrations
    where event_id = v_event.id and status = 'registered';
    if v_taken >= v_event.capacity then
      if not v_event.waitlist_enabled then
        return jsonb_build_object('status', 'sold_out');
      end if;
      v_status := 'waitlisted';
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
    (event_id, lead_id, contact_id, full_name, email, phone, company_name, attendance_mode, status)
  values (v_event.id, v_lead_id, v_contact_id, v_name, v_email, v_phone, v_company, v_mode, v_status)
  on conflict (event_id, email) do update set
    status = excluded.status,
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
    v_name || case when v_status = 'waitlisted' then ' joined the waitlist for "' else ' registered for "' end
      || v_event.title || '"',
    jsonb_build_object('event_id', v_event.id)
  );

  if v_status = 'waitlisted' then
    return jsonb_build_object('status', 'waitlisted', 'confirmation_message', v_event.confirmation_message);
  end if;

  return jsonb_build_object(
    'status', 'registered',
    'ticket_code', v_ticket,
    'online_url', case when v_mode = 'online' then v_event.online_url end,
    'confirmation_message', v_event.confirmation_message
  );
end;
$$;

revoke all on function public.get_public_event(text) from public;
revoke all on function public.register_for_event(text, text, text, text, text, text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;
grant execute on function public.register_for_event(text, text, text, text, text, text) to anon, authenticated;
