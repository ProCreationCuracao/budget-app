-- Enable required extensions
create extension if not exists pgcrypto;

-- Budgets
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

alter table public.budgets enable row level security;
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select using (auth.uid() = user_id);
drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert with check (auth.uid() = user_id);
drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete using (auth.uid() = user_id);

-- Subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_interval' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.subscription_interval AS ENUM ('day','week','month','year');
  END IF;
END
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  interval public.subscription_interval not null default 'month',
  every integer not null default 1 check (every >= 1),
  next_charge_date date not null,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamp with time zone not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
  on public.subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "subscriptions_delete_own" on public.subscriptions;
create policy "subscriptions_delete_own"
  on public.subscriptions for delete using (auth.uid() = user_id);

-- Goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date date,
  created_at timestamp with time zone not null default now()
);

alter table public.goals enable row level security;
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own"
  on public.goals for select using (auth.uid() = user_id);
drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own"
  on public.goals for insert with check (auth.uid() = user_id);
drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own"
  on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own"
  on public.goals for delete using (auth.uid() = user_id);

-- Goal Contributions
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  created_at timestamp with time zone not null default now()
);

alter table public.goal_contributions enable row level security;
drop policy if exists "goal_contribs_select_own" on public.goal_contributions;
create policy "goal_contribs_select_own"
  on public.goal_contributions for select using (auth.uid() = user_id);
drop policy if exists "goal_contribs_insert_own" on public.goal_contributions;
create policy "goal_contribs_insert_own"
  on public.goal_contributions for insert with check (auth.uid() = user_id);
drop policy if exists "goal_contribs_update_own" on public.goal_contributions;
create policy "goal_contribs_update_own"
  on public.goal_contributions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goal_contribs_delete_own" on public.goal_contributions;
create policy "goal_contribs_delete_own"
  on public.goal_contributions for delete using (auth.uid() = user_id);
