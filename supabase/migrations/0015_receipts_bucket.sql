-- Lock down receipts bucket: private reads, owner-only access
-- 1) Make receipts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 2) Remove public read policy if present
DROP POLICY IF EXISTS "receipts_public_read" ON storage.objects;

-- 3) Owner-only read policy (emulate IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polname = 'receipts_read_own'
      AND p.polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "receipts_read_own"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'receipts' AND owner = auth.uid());
  END IF;
END
$$;
