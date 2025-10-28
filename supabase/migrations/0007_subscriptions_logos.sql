-- Subscriptions: logos and merchant metadata
alter table if exists public.subscriptions
  add column if not exists logo_url text,
  add column if not exists merchant text,
  add column if not exists autodetect_logo boolean not null default true;
