-- Payment framework for paid events (Stripe Checkout). Each registration records whether
-- it needs payment, the amount due, and the Stripe session and payment that settled it.
-- Registering for a paid event holds the spot as "unpaid"; the Stripe webhook (or a team
-- member) marks it paid. Until Stripe keys are set, paid registrations stay unpaid and the
-- team follows up as before. Also gives the five TEST events their photos, once.
-- Safe to re-run.

alter table public.event_registrations
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists amount_due numeric check (amount_due is null or amount_due >= 0),
  add column if not exists amount_paid numeric check (amount_paid is null or amount_paid >= 0),
  add column if not exists currency text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

alter table public.event_registrations drop constraint if exists event_registrations_payment_status_check;
alter table public.event_registrations add constraint event_registrations_payment_status_check
  check (payment_status in ('not_required', 'unpaid', 'paid', 'refunded'));

create unique index if not exists event_registrations_checkout_session_idx
  on public.event_registrations (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index if not exists event_registrations_payment_intent_idx
  on public.event_registrations (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Existing registrations for paid events were waiting on the team to collect payment.
do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0031_event_payments_backfill') then
    update public.event_registrations r
    set payment_status = 'unpaid', amount_due = e.ticket_price, currency = e.currency
    from public.events e
    where r.event_id = e.id and e.ticket_type = 'paid' and coalesce(e.ticket_price, 0) > 0
      and r.status = 'registered' and r.payment_status = 'not_required';
    insert into public.migration_markers (key) values ('0031_event_payments_backfill');
  end if;
end $$;

-- Photos for the TEST events from 0030 (the files live in public/events/test).
do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0031_test_event_images') then
    update public.events e set image_url = v.url
    from (values
      ('TEST – Founders Breakfast', '/events/test/founders-breakfast.jpg'),
      ('TEST – Apex Forum Workshop', '/events/test/apex-forum-workshop.jpg'),
      ('TEST – Funding 101 Webinar', '/events/test/funding-101-webinar.jpg'),
      ('TEST – Investor Pitch Night', '/events/test/investor-pitch-night.jpg'),
      ('TEST – Year-End Mixer', '/events/test/year-end-mixer.jpg')
    ) as v(title, url)
    where e.title = v.title and e.image_url is null;
    insert into public.migration_markers (key) values ('0031_test_event_images');
  end if;
end $$;

-- As in 0009, plus payment: paid registrations start "unpaid" with the ticket price due,
-- and an unpaid registrant who comes back gets "payment_pending" so they can finish paying.
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
  v_paid boolean;
  v_payment text;
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

  v_paid := v_event.ticket_type = 'paid' and coalesce(v_event.ticket_price, 0) > 0;

  select * into v_existing from public.event_registrations
  where event_id = v_event.id and email = v_email;
  -- Someone who registered for a paid event but left checkout can come back and pay.
  if found and v_existing.status = 'registered' and v_existing.payment_status = 'unpaid' and v_paid then
    return jsonb_build_object(
      'status', 'payment_pending',
      'ticket_code', v_existing.ticket_code,
      'amount_due', v_existing.amount_due,
      'currency', v_existing.currency
    );
  end if;
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

  -- Waitlisted people pay only once they're moved into a spot.
  v_payment := case when v_paid and v_status = 'registered' then 'unpaid' else 'not_required' end;

  insert into public.event_registrations
    (event_id, lead_id, contact_id, full_name, email, phone, company_name, attendance_mode, status,
     payment_status, amount_due, currency)
  values (v_event.id, v_lead_id, v_contact_id, v_name, v_email, v_phone, v_company, v_mode, v_status,
     v_payment, case when v_paid then v_event.ticket_price end, v_event.currency)
  on conflict (event_id, email) do update set
    status = excluded.status,
    lead_id = excluded.lead_id,
    contact_id = excluded.contact_id,
    full_name = excluded.full_name,
    phone = excluded.phone,
    company_name = excluded.company_name,
    attendance_mode = excluded.attendance_mode,
    payment_status = excluded.payment_status,
    amount_due = excluded.amount_due,
    currency = excluded.currency,
    stripe_checkout_session_id = null
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
    'confirmation_message', v_event.confirmation_message,
    'payment_required', v_payment = 'unpaid',
    'amount_due', case when v_payment = 'unpaid' then v_event.ticket_price end,
    'currency', v_event.currency
  );
end;
$$;

revoke all on function public.register_for_event(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_for_event(text, text, text, text, text, text) to anon, authenticated;
