-- Link transactions to subscriptions for traceability
alter table if exists public.transactions
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists transactions_subscription_id_idx on public.transactions(subscription_id);
