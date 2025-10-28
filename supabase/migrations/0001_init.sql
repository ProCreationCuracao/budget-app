create extension if not exists "pgcrypto";

create type public.tx_type as enum ('income','expense');
create type public.account_type as enum ('cash','bank','credit_card');
create type public.budget_period as enum ('monthly','custom');
create type public.frequency_type as enum ('weekly','monthly','quarterly','yearly','custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  currency text default 'USD',
  locale text default 'en-US',
  start_of_month int default 1 check (start_of_month between 1 and 28),
  theme text default 'system',
  created_at timestamptz default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type public.account_type not null,
  starting_balance numeric(12,2) default 0,
  created_at timestamptz default now()
);
create index accounts_user_id_idx on public.accounts(user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type public.tx_type not null,
  icon text,
  color text,
  created_at timestamptz default now(),
  unique(user_id, name, type)
);
create index categories_user_id_idx on public.categories(user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  type public.tx_type not null,
  date date not null,
  amount numeric(12,2) not null,
  notes text,
  tags text[],
  attachment_url text,
  created_at timestamptz default now()
);
create index transactions_user_id_date_idx on public.transactions(user_id, date desc);
create index transactions_account_id_idx on public.transactions(account_id);
create index transactions_category_id_idx on public.transactions(category_id);
create index transactions_tags_gin_idx on public.transactions using gin (tags);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text,
  period public.budget_period not null default 'monthly',
  month int,
  year int,
  total_amount numeric(12,2) not null,
  rollover boolean default false,
  created_at timestamptz default now(),
  check (
    (period = 'monthly' and month between 1 and 12 and year is not null)
    or (period = 'custom' and month is null and year is null)
  )
);
create index budgets_user_id_idx on public.budgets(user_id);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(12,2) not null,
  unique(budget_id, category_id)
);
create index budget_categories_budget_id_idx on public.budget_categories(budget_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  frequency public.frequency_type not null default 'monthly',
  next_due date not null,
  category_id uuid references public.categories(id) on delete set null,
  auto_post boolean default false,
  created_at timestamptz default now()
);
create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_next_due_idx on public.subscriptions(user_id, next_due);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  target_date date,
  current_amount numeric(12,2) not null default 0,
  created_at timestamptz default now()
);
create index goals_user_id_idx on public.goals(user_id);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.subscriptions enable row level security;
alter table public.goals enable row level security;

create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles for delete using (id = auth.uid());

create policy accounts_all_own on public.accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_all_own on public.categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy budgets_all_own on public.budgets for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy budget_categories_select_own on public.budget_categories for select using (
  exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
);
create policy budget_categories_modify_own on public.budget_categories for insert with check (
  exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
);
create policy budget_categories_update_own on public.budget_categories for update using (
  exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
) with check (
  exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  and exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
);
create policy budget_categories_delete_own on public.budget_categories for delete using (
  exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
);

create policy subscriptions_all_own on public.subscriptions for all using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (
    category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  )
);

create policy goals_all_own on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy transactions_select_own on public.transactions for select using (user_id = auth.uid());
create policy transactions_insert_own on public.transactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (
    category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  )
);
create policy transactions_update_own on public.transactions for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (
    category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  )
);
create policy transactions_delete_own on public.transactions for delete using (user_id = auth.uid());

create function public.seed_for_user(uid uuid)
returns void
language plpgsql
as $$
begin
  insert into public.accounts (user_id, name, type, starting_balance)
  values (uid, 'Cash', 'cash', 0)
  on conflict do nothing;

  insert into public.categories (user_id, name, type, icon, color)
  values
    (uid, 'Salary', 'income', 'briefcase', '#16a34a'),
    (uid, 'Bonus', 'income', 'gift', '#22c55e'),
    (uid, 'Groceries', 'expense', 'shopping-basket', '#ef4444'),
    (uid, 'Rent', 'expense', 'home', '#f97316'),
    (uid, 'Utilities', 'expense', 'bolt', '#f59e0b'),
    (uid, 'Transport', 'expense', 'car', '#3b82f6'),
    (uid, 'Dining', 'expense', 'utensils', '#8b5cf6'),
    (uid, 'Entertainment', 'expense', 'film', '#06b6d4'),
    (uid, 'Health', 'expense', 'heart', '#10b981')
  on conflict do nothing;
end;
$$;

-- Create a profile for each new auth user and seed starter data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  perform public.seed_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
