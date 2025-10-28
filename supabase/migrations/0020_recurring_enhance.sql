-- Recurring subscriptions enhancements
-- Columns: currency, notes, paused, end_date, last_posted, day_of_month, weekday, autopost
-- Keep legacy columns; backfill and add constraints safely

alter table if exists public.subscriptions
  add column if not exists currency text,
  add column if not exists notes text,
  add column if not exists paused boolean not null default false,
  add column if not exists end_date date,
  add column if not exists last_posted date,
  add column if not exists day_of_month int check (day_of_month between 1 and 28),
  add column if not exists weekday int check (weekday between 0 and 6);

-- Backfill currency from account if present, else from profile, else USD
update public.subscriptions s
set currency = coalesce(
  (select a.currency from public.accounts a where a.id = s.account_id),
  (select p.currency from public.profiles p where p.id = s.user_id),
  'USD'
)
where s.currency is null;

-- Enforce 3-letter uppercase currency format
alter table if exists public.subscriptions
  add constraint if not exists subscriptions_currency_format
  check (currency ~ '^[A-Z]{3}$');

-- Ensure auto_post remains present (added in earlier migrations); no-op here.

-- Unique idempotency for autoposting
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'uniq_transactions_subscription_date'
  ) then
    create unique index uniq_transactions_subscription_date on public.transactions(subscription_id, date) where subscription_id is not null;
  end if;
end
$$;
