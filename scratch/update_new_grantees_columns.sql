-- ==============================================================================
-- SQL Migration Script: Remove 'batch' and 'course' columns from new_grantees_masterlist
-- ScholarDoc: New Grantees Masterlist Update
-- ==============================================================================
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. In the left sidebar, click on "SQL Editor".
-- 3. Click "New query", paste the SQL commands below, and click "Run".
-- ==============================================================================

-- Remove course and batch columns
ALTER TABLE public.new_grantees_masterlist 
DROP COLUMN IF EXISTS batch,
DROP COLUMN IF EXISTS course;

-- Verify updated table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'new_grantees_masterlist';
