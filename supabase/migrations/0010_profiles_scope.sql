-- Overview scope (Personal/Household/Business)
alter table if exists public.profiles
  add column if not exists scope text;

-- Backfill null to 'Personal'
update public.profiles set scope = 'Personal' where scope is null;

-- Optional: CHECK-like constraint via trigger is overkill; keep shape free-form for now.
