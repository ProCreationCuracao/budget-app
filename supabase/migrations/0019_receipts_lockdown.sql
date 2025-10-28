-- Lock down receipts bucket: private reads, owner-only access
-- 1) Make receipts bucket private
update storage.buckets set public = false where id = 'receipts';

-- 2) Remove public read policy if present
drop policy if exists "receipts_public_read" on storage.objects;

-- 3) Owner-only read policy
create policy if not exists "receipts_read_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid());
