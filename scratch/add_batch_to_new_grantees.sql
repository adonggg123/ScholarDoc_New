-- ==============================================================================
-- SQL Migration Script: Add 'batch' column to new_grantees_masterlist
-- ScholarDoc: New Grantees Masterlist Batch Support
-- ==============================================================================
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. In the left sidebar, click on "SQL Editor".
-- 3. Click "New query", paste the SQL commands below, and click "Run".
-- ==============================================================================

-- 1. Add batch column if it does not already exist
ALTER TABLE public.new_grantees_masterlist 
ADD COLUMN IF NOT EXISTS batch TEXT DEFAULT 'Batch 1.1';

-- 2. Populate any existing rows with default 'Batch 1.1' if batch is NULL
UPDATE public.new_grantees_masterlist 
SET batch = 'Batch 1.1' 
WHERE batch IS NULL;

-- 3. Create index on batch for faster filtering and sorting
CREATE INDEX IF NOT EXISTS idx_new_grantees_batch ON public.new_grantees_masterlist(batch);

-- 4. Verify updated table schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'new_grantees_masterlist';
