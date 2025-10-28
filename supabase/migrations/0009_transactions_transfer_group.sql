-- Transactions transfer group to link double-entry transfer pairs
alter table if exists public.transactions
  add column if not exists transfer_group uuid;

create index if not exists transactions_transfer_group_idx on public.transactions(transfer_group);
