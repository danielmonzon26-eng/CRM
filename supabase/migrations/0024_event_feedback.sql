-- Post-event feedback. Each registrant gets a personal link (a random token); the public
-- form reads and submits through two narrow functions, so people outside the team never
-- see the table. Answers: satisfaction and likelihood to recommend (1-10), topics they want
-- next, what was most valuable, what to improve, and whether they'd like a follow-up.
-- Safe to re-run.

create table if not exists public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  registration_id uuid references public.event_registrations (id) on delete set null,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  full_name text,
  email text,
  request_sent_at timestamptz,
  send_error text,
  submitted_at timestamptz,
  satisfaction integer check (satisfaction between 1 and 10),
  recommend integer check (recommend between 1 and 10),
  topics text[] not null default '{}',
  most_valuable text check (length(most_valuable) <= 5000),
  improve text check (length(improve) <= 5000),
  follow_up text check (follow_up in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, registration_id)
);

create index if not exists event_feedback_event_id_idx on public.event_feedback (event_id);

drop trigger if exists event_feedback_set_updated_at on public.event_feedback;
create trigger event_feedback_set_updated_at before update on public.event_feedback
  for each row execute function public.set_updated_at();

alter table public.event_feedback enable row level security;
drop policy if exists "authenticated all event_feedback" on public.event_feedback;
create policy "authenticated all event_feedback" on public.event_feedback
  for all to authenticated using (true) with check (true);
revoke all on table public.event_feedback from anon;

-- What the public form shows for a link.
drop function if exists public.get_feedback_form(text);
create function public.get_feedback_form(p_token text)
returns table (event_title text, starts_at timestamptz, first_name text, submitted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.title, e.starts_at, split_part(coalesce(f.full_name, ''), ' ', 1), f.submitted_at is not null
  from public.event_feedback f
  join public.events e on e.id = f.event_id
  where f.token = p_token and length(p_token) between 32 and 128;
$$;

-- Saves one response. Returns 'ok', 'invalid' or 'already'.
drop function if exists public.submit_event_feedback(text, integer, integer, text[], text, text, text);
create function public.submit_event_feedback(
  p_token text,
  p_satisfaction integer,
  p_recommend integer,
  p_topics text[],
  p_most_valuable text,
  p_improve text,
  p_follow_up text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feedback public.event_feedback%rowtype;
  v_lead_id uuid;
begin
  if p_satisfaction is null or p_satisfaction not between 1 and 10
     or p_recommend is null or p_recommend not between 1 and 10
     or (p_follow_up is not null and p_follow_up not in ('yes', 'maybe', 'no'))
     or not coalesce(p_topics, '{}') <@ array[
       'ip', 'capital', 'grants', 'sales_marketing', 'hiring', 'operations', 'ai', 'export', 'exit', 'finance'
     ]::text[] then
    return 'invalid';
  end if;

  select * into v_feedback from public.event_feedback where token = p_token for update;
  if not found then
    return 'invalid';
  end if;
  if v_feedback.submitted_at is not null then
    return 'already';
  end if;

  update public.event_feedback set
    satisfaction = p_satisfaction,
    recommend = p_recommend,
    topics = coalesce(p_topics, '{}'),
    most_valuable = nullif(left(btrim(coalesce(p_most_valuable, '')), 5000), ''),
    improve = nullif(left(btrim(coalesce(p_improve, '')), 5000), ''),
    follow_up = p_follow_up,
    submitted_at = now()
  where id = v_feedback.id;

  -- A follow-up request goes on the lead's timeline, so the team sees it.
  if p_follow_up in ('yes', 'maybe') and v_feedback.registration_id is not null then
    select r.lead_id into v_lead_id from public.event_registrations r where r.id = v_feedback.registration_id;
    if v_lead_id is not null then
      insert into public.activities (lead_id, type, body)
      select v_lead_id, 'note',
        format('%s asked for a follow-up (%s) in their feedback on %s.', coalesce(v_feedback.full_name, 'An attendee'), p_follow_up, e.title)
      from public.events e where e.id = v_feedback.event_id;
    end if;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.get_feedback_form(text) from public;
revoke all on function public.submit_event_feedback(text, integer, integer, text[], text, text, text) from public;
grant execute on function public.get_feedback_form(text) to anon, authenticated;
grant execute on function public.submit_event_feedback(text, integer, integer, text[], text, text, text) to anon, authenticated;
