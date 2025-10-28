-- Add auto_post column to subscriptions if missing
alter table if exists public.subscriptions
  add column if not exists auto_post boolean not null default false;

-- Ensure RLS remains intact; table already has policies in prior migrations.
-- No further action needed here.
