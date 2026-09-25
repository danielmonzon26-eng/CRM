-- Step: real "brick and mortar" signal from Calgary's own data.
--
-- Live field verification (see lib/sources/calgary.ts) found `homeoccind` -- a
-- Home Occupation Indicator (Y/N) -- on every Calgary Business Licence record. That's
-- a far more reliable brick-and-mortar signal than guessing from license-type keywords,
-- so it replaces the old "Brick and Mortar Retail" keyword-matched vertical in scoring.
alter table public.licenses
  add column if not exists is_home_based boolean;
