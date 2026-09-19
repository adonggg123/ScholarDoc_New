-- ============================================================================
-- SQL SCRIPT: Add year_became_scholar, payouts_received & ensure scholarship_name
-- ============================================================================
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql

-- 1. Add missing columns to public.students table
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS scholarship_name TEXT DEFAULT 'TES',
    ADD COLUMN IF NOT EXISTS scholarship_id TEXT,
    ADD COLUMN IF NOT EXISTS year_became_scholar TEXT DEFAULT '2023',
    ADD COLUMN IF NOT EXISTS payouts_received TEXT DEFAULT '0',
    ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'A',
    ADD COLUMN IF NOT EXISTS sa_number TEXT,
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 2. Synchronize existing student records with valid defaults
UPDATE public.students
SET 
    scholarship_name = COALESCE(scholarship_name, 'TES'),
    year_became_scholar = COALESCE(year_became_scholar, '2023'),
    payouts_received = COALESCE(payouts_received, '0')
WHERE 
    scholarship_name IS NULL 
    OR year_became_scholar IS NULL 
    OR payouts_received IS NULL;

-- 3. Verification query
SELECT 
    student_no,
    full_name,
    program_name,
    scholarship_name,
    year_became_scholar,
    payouts_received
FROM public.students
ORDER BY student_no;
