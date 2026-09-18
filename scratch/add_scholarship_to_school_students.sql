-- ============================================================================
-- SQL SCRIPT: Add scholarship_name to school_students table and sync from students
-- ============================================================================

-- 1. Add scholarship_name column to school_students if it does not already exist
ALTER TABLE public.school_students 
    ADD COLUMN IF NOT EXISTS scholarship_name text DEFAULT 'TES';

-- 2. Populate scholarship_name in school_students matching students table
UPDATE public.school_students ss
SET scholarship_name = COALESCE(s.scholarship_name, 'TES')
FROM public.students s
WHERE TRIM(ss.student_no) = TRIM(s.student_no)
   OR LOWER(TRIM(ss.full_name)) = LOWER(TRIM(s.full_name));

-- 3. Also update any NULL values to 'TES' default
UPDATE public.school_students
SET scholarship_name = 'TES'
WHERE scholarship_name IS NULL OR TRIM(scholarship_name) = '';
