-- Add scope to core entities and backfill to 'Personal'
alter table if exists public.accounts add column if not exists scope text;
alter table if exists public.categories add column if not exists scope text;
alter table if exists public.transactions add column if not exists scope text;
alter table if exists public.budgets add column if not exists scope text;
alter table if exists public.subscriptions add column if not exists scope text;

update public.accounts set scope = 'Personal' where scope is null;
update public.categories set scope = 'Personal' where scope is null;
update public.transactions set scope = 'Personal' where scope is null;
update public.budgets set scope = 'Personal' where scope is null;
update public.subscriptions set scope = 'Personal' where scope is null;

create index if not exists accounts_scope_idx on public.accounts(scope);
create index if not exists categories_scope_idx on public.categories(scope);
create index if not exists transactions_scope_idx on public.transactions(scope);
create index if not exists budgets_scope_idx on public.budgets(scope);
create index if not exists subscriptions_scope_idx on public.subscriptions(scope);
