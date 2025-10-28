-- Backfill and constrain profiles.currency to a sane format
-- 1) Normalize to uppercase and trim
update public.profiles
set currency = upper(trim(currency))
where currency is not null and (currency <> upper(currency) or currency <> trim(currency));

-- 2) Replace clearly invalid formats (null or not 3 uppercase letters) with USD
update public.profiles
set currency = 'USD'
where currency is null or currency !~ '^[A-Z]{3}$';

-- 3) Add a CHECK constraint to enforce 3-letter uppercase code shape going forward
alter table if exists public.profiles
  add constraint if not exists profiles_currency_format
  check (currency is null or currency ~ '^[A-Z]{3}$');
