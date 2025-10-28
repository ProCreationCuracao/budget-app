-- Reconcile subscriptions schema to match client expectations
-- Ensure enum type exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_interval' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.subscription_interval AS ENUM ('day','week','month','year');
  END IF;
END
$$;

-- Add missing columns if they do not exist
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS interval public.subscription_interval,
  ADD COLUMN IF NOT EXISTS every integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_charge_date date,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Backfill interval from legacy frequency column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'frequency'
  ) THEN
    UPDATE public.subscriptions
    SET interval = CASE (frequency::text)
      WHEN 'weekly' THEN 'week'::public.subscription_interval
      WHEN 'monthly' THEN 'month'::public.subscription_interval
      WHEN 'yearly' THEN 'year'::public.subscription_interval
      WHEN 'quarterly' THEN 'month'::public.subscription_interval
      ELSE 'month'::public.subscription_interval
    END
    WHERE interval IS NULL;
  END IF;
END
$$;

-- Backfill next_charge_date from legacy next_due if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'next_due'
  ) THEN
    UPDATE public.subscriptions
    SET next_charge_date = next_due
    WHERE next_charge_date IS NULL;
  END IF;
END
$$;
