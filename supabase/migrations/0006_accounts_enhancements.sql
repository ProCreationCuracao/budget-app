-- Accounts enhancements: add wallet type, icon/color/hidden/order_index
alter type public.account_type add value if not exists 'wallet';

alter table if exists public.accounts
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists hidden boolean not null default false,
  add column if not exists order_index integer not null default 0;
