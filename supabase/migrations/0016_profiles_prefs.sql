-- Add extended preferences to profiles
alter table public.profiles
  add column if not exists accent text default 'purple',
  add column if not exists reduced_motion boolean default false,
  add column if not exists animation_density int default 100,
  add column if not exists default_account uuid references public.accounts(id) on delete set null,
  add column if not exists notif_prefs jsonb default '{}'::jsonb;
