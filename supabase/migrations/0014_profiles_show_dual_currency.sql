-- Profile preference: show or hide original currency alongside converted
alter table if exists public.profiles
  add column if not exists show_dual_currency boolean not null default true;
