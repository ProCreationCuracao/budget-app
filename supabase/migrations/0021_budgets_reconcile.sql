-- Reconcile budgets table schema to app expectations
-- This migration is idempotent and safe to run multiple times.
-- Goals:
-- - Ensure columns: amount numeric(12,2), category_id uuid -> categories(id)
-- - Backfill amount from legacy total_amount if present
-- - Keep legacy columns for compatibility; do not drop anything

-- Ensure amount column exists
alter table if exists public.budgets
  add column if not exists amount numeric(12,2);

-- Ensure category_id column exists and FK
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'budgets' and column_name = 'category_id'
  ) then
    alter table public.budgets add column category_id uuid;
  end if;
  -- add FK constraint if missing
  if not exists (
    select 1 from information_schema.table_constraints c
    join information_schema.key_column_usage k on c.constraint_name = k.constraint_name and c.table_name = k.table_name and c.table_schema = k.table_schema
    where c.table_schema = 'public'
      and c.table_name = 'budgets'
      and c.constraint_type = 'FOREIGN KEY'
      and k.column_name = 'category_id'
  ) then
    alter table public.budgets
      add constraint budgets_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end$$;

-- Backfill amount from legacy total_amount if that column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'total_amount'
  ) THEN
    UPDATE public.budgets
      SET amount = COALESCE(amount, total_amount::numeric)
      WHERE amount IS NULL;
  END IF;
END$$;

-- Optional: ensure non-negative amounts (matches current app expectations)
alter table if exists public.budgets
  add constraint if not exists budgets_amount_nonneg check (amount is null or amount >= 0);

-- Index to help common queries by created_at already exists in some setups; skip if absent
-- Scope column is added in 0011_scope_columns.sql; no changes here

-- End of 0021_budgets_reconcile.sql
