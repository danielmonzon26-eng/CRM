-- Marketing: initiatives (campaigns) and a social media planner. A post goes to one or
-- more channels (a LinkedIn, Facebook or Instagram account), can carry an image, and
-- moves through Requested -> Waiting approval -> Approved. Only admins can approve,
-- enforced here as well as in the app, and changing an approved post's content (by
-- anyone but an admin) sends it back for approval. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Channels: the accounts posts go out on. Admins add more (a program's own page).
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('linkedin', 'facebook', 'instagram')),
  name text not null check (btrim(name) <> ''),
  handle text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, name)
);

drop trigger if exists marketing_channels_set_updated_at on public.marketing_channels;
create trigger marketing_channels_set_updated_at before update on public.marketing_channels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Initiatives: a campaign or push, with dates, an owner and an optional event.
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_initiatives (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  objective text,
  owner_id uuid references auth.users (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  starts_on date,
  ends_on date,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_initiatives_dates check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index if not exists marketing_initiatives_starts_idx on public.marketing_initiatives (starts_on);
create index if not exists marketing_initiatives_event_idx on public.marketing_initiatives (event_id);

drop trigger if exists marketing_initiatives_set_updated_at on public.marketing_initiatives;
create trigger marketing_initiatives_set_updated_at before update on public.marketing_initiatives
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Social posts.
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid references public.marketing_initiatives (id) on delete set null,
  title text not null check (btrim(title) <> ''),
  caption text not null default '',
  scheduled_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'waiting_approval', 'approved')),
  image_path text,
  image_name text,
  review_note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_scheduled_idx on public.social_posts (scheduled_at);
create index if not exists social_posts_status_idx on public.social_posts (status);
create index if not exists social_posts_initiative_idx on public.social_posts (initiative_id);

create table if not exists public.social_post_channels (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  channel_id uuid not null references public.marketing_channels (id) on delete cascade,
  primary key (post_id, channel_id)
);
create index if not exists social_post_channels_channel_idx on public.social_post_channels (channel_id);

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at before update on public.social_posts
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Approval rules. auth.uid() is null for server jobs and migrations, which are trusted.
create or replace function public.social_posts_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := auth.uid() is null or public.is_admin();
begin
  -- Editing an approved post's content needs approving again, unless an admin made the edit.
  if tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'approved' and not v_admin
     and (new.title is distinct from old.title or new.caption is distinct from old.caption
          or new.image_path is distinct from old.image_path) then
    new.status := 'waiting_approval';
  end if;

  if new.status = 'approved' then
    if tg_op = 'INSERT' or old.status <> 'approved' then
      if not v_admin then
        raise exception 'Only an admin can approve posts.' using errcode = '42501';
      end if;
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;

  if new.status = 'waiting_approval' and (tg_op = 'INSERT' or old.status <> 'waiting_approval') then
    new.submitted_at := now();
    new.review_note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists social_posts_approval on public.social_posts;
create trigger social_posts_approval before insert or update on public.social_posts
  for each row execute function public.social_posts_approval();

-- ---------------------------------------------------------------------------
-- Access: the whole team plans and drafts; admins manage channels; only the person
-- who created a post or initiative, or an admin, can delete it.
-- ---------------------------------------------------------------------------
alter table public.marketing_channels enable row level security;
alter table public.marketing_initiatives enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_channels enable row level security;

drop policy if exists "team read channels" on public.marketing_channels;
create policy "team read channels" on public.marketing_channels for select to authenticated using (true);
drop policy if exists "admins manage channels" on public.marketing_channels;
create policy "admins manage channels" on public.marketing_channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "team read initiatives" on public.marketing_initiatives;
create policy "team read initiatives" on public.marketing_initiatives for select to authenticated using (true);
drop policy if exists "team add initiatives" on public.marketing_initiatives;
create policy "team add initiatives" on public.marketing_initiatives for insert to authenticated with check (true);
drop policy if exists "team edit initiatives" on public.marketing_initiatives;
create policy "team edit initiatives" on public.marketing_initiatives for update to authenticated using (true) with check (true);
drop policy if exists "owner or admin delete initiatives" on public.marketing_initiatives;
create policy "owner or admin delete initiatives" on public.marketing_initiatives for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "team read posts" on public.social_posts;
create policy "team read posts" on public.social_posts for select to authenticated using (true);
drop policy if exists "team add posts" on public.social_posts;
create policy "team add posts" on public.social_posts for insert to authenticated with check (true);
drop policy if exists "team edit posts" on public.social_posts;
create policy "team edit posts" on public.social_posts for update to authenticated using (true) with check (true);
drop policy if exists "owner or admin delete posts" on public.social_posts;
create policy "owner or admin delete posts" on public.social_posts for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "team manage post channels" on public.social_post_channels;
create policy "team manage post channels" on public.social_post_channels for all to authenticated using (true) with check (true);

revoke all on public.marketing_channels, public.marketing_initiatives, public.social_posts, public.social_post_channels from anon;
grant select, insert, update, delete on public.marketing_channels, public.marketing_initiatives, public.social_posts, public.social_post_channels to authenticated;

-- ---------------------------------------------------------------------------
-- Post images, in a private bucket the team can reach (shown through short-lived links).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-images', 'marketing-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated manage marketing images" on storage.objects;
create policy "authenticated manage marketing images" on storage.objects
  for all to authenticated
  using (bucket_id = 'marketing-images')
  with check (bucket_id = 'marketing-images');

-- ---------------------------------------------------------------------------
-- Starting channels, added once (so renaming or removing them sticks).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0032_marketing_channels') then
    insert into public.marketing_channels (platform, name, sort_order) values
      ('linkedin', 'Catapult on LinkedIn', 1),
      ('facebook', 'Catapult on Facebook', 2),
      ('instagram', 'Catapult on Instagram', 3)
    on conflict (platform, name) do nothing;
    insert into public.migration_markers (key) values ('0032_marketing_channels');
  end if;
end;
$$;
