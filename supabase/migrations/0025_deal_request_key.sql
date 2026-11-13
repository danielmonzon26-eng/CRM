-- A key the browser sends with "Create proposal". If the same request arrives twice (a
-- double click, or a retry on a slow connection), the second finds the first proposal
-- instead of creating another. Safe to re-run.

alter table public.deals add column if not exists request_key text;
create unique index if not exists deals_request_key_idx on public.deals (request_key) where request_key is not null;
