-- Multi-currency support: account/transaction currency, fx rates, and conversion helper

-- 1) Accounts.currency
alter table if exists public.accounts
  add column if not exists currency text;

-- Backfill from user's profile currency (fallback USD)
update public.accounts a
set currency = coalesce((select p.currency from public.profiles p where p.id = a.user_id), 'USD')
where a.currency is null;

-- Enforce 3-letter uppercase format and non-null
alter table if exists public.accounts
  alter column currency set not null;

alter table if exists public.accounts
  add constraint if not exists accounts_currency_format
  check (currency ~ '^[A-Z]{3}$');

-- 2) Transactions.currency
alter table if exists public.transactions
  add column if not exists currency text;

-- Backfill from account's currency
update public.transactions t
set currency = (select a.currency from public.accounts a where a.id = t.account_id)
where t.currency is null;

-- Enforce
alter table if exists public.transactions
  alter column currency set not null;

alter table if exists public.transactions
  add constraint if not exists transactions_currency_format
  check (currency ~ '^[A-Z]{3}$');

-- 3) FX rates table (per-user)
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  from_currency text not null check (from_currency ~ '^[A-Z]{3}$'),
  to_currency text not null check (to_currency ~ '^[A-Z]{3}$'),
  rate numeric(18,8) not null check (rate > 0),
  created_at timestamptz default now(),
  unique(user_id, date, from_currency, to_currency)
);

alter table public.fx_rates enable row level security;
create policy fx_rates_all_own on public.fx_rates for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Conversion helper function: returns NULL if no rate and different currencies
create or replace function public.fx_convert(
  p_user_id uuid,
  p_on_date date,
  p_from text,
  p_to text,
  p_amount numeric
) returns numeric
language plpgsql
stable
as $$
begin
  if p_from = p_to then
    return p_amount;
  end if;
  -- try latest rate on/before date
  return (
    select p_amount * r.rate
    from public.fx_rates r
    where r.user_id = p_user_id
      and r.from_currency = p_from
      and r.to_currency = p_to
      and r.date <= p_on_date
    order by r.date desc
    limit 1
  );
end;
$$;
