create table if not exists public.smart_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  priority int not null default 1,
  match jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists smart_rules_user_id_idx on public.smart_rules(user_id);
create index if not exists smart_rules_user_priority_idx on public.smart_rules(user_id, priority asc);

alter table public.smart_rules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'smart_rules'
      and policyname = 'smart_rules_all_own'
  ) then
    create policy smart_rules_all_own on public.smart_rules for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;
