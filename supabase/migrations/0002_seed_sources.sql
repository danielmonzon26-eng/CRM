-- Seed the sources registry with the primary data source used from Step 3
-- onward. Safe to re-run.
insert into public.sources (key, name, kind, config)
values (
  'calgary_business_licenses',
  'Calgary Business Licences (Open Data)',
  'open_data_api',
  jsonb_build_object(
    'dataset_url', 'https://data.calgary.ca/resource/vdjc-pybd.json',
    'docs_url', 'https://data.calgary.ca/Business-and-Economic-Activity/Calgary-Business-Licenses/vdjc-pybd'
  )
)
on conflict (key) do nothing;
