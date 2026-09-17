-- ============================================================================
-- SQL Migration: Update Students Table & Import Annex Form 2 Students
-- ============================================================================
-- Purpose:
-- 1. Adds all 15 requested fields to the `students` table in Supabase.
-- 2. Preserves existing data and ensures backwards compatibility.
-- 3. Identifies students in `school_students` that are part of Annex Form 2.
-- 4. Upserts them into `students` with full field mapping (zero duplicates).
-- 5. Adds automatic two-way column synchronization trigger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Update Students Table Schema (Add Missing Columns & Constraints)
-- ----------------------------------------------------------------------------

-- Ensure uid generates a valid UUID automatically if omitted
ALTER TABLE public.students 
    ALTER COLUMN uid SET DEFAULT gen_random_uuid();

-- Add requested 15 fields if not already present
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS student_no text,
    ADD COLUMN IF NOT EXISTS full_name text,
    ADD COLUMN IF NOT EXISTS program_name text,
    ADD COLUMN IF NOT EXISTS year_level text,
    ADD COLUMN IF NOT EXISTS date_of_birth text,
    ADD COLUMN IF NOT EXISTS age integer,
    ADD COLUMN IF NOT EXISTS gender text,
    ADD COLUMN IF NOT EXISTS civil_status text DEFAULT 'Single',
    ADD COLUMN IF NOT EXISTS religion text,
    ADD COLUMN IF NOT EXISTS mobile_number text,
    ADD COLUMN IF NOT EXISTS email_address text,
    ADD COLUMN IF NOT EXISTS father_full_name text,
    ADD COLUMN IF NOT EXISTS father_occupation text,
    ADD COLUMN IF NOT EXISTS mother_full_name text,
    ADD COLUMN IF NOT EXISTS mother_occupation text;

-- Ensure unique constraint on student_no to prevent duplicates and enable UPSERT
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_student_no_key'
    ) THEN 
        ALTER TABLE public.students ADD CONSTRAINT students_student_no_key UNIQUE (student_no);
    END IF; 
END $$;

-- Also create indexes for faster search
CREATE INDEX IF NOT EXISTS idx_students_student_no ON public.students (student_no);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students (full_name);

-- ----------------------------------------------------------------------------
-- STEP 2: Safe Backfill for Any Existing Student Records
-- ----------------------------------------------------------------------------
-- Synchronizes legacy camelCase and new snake_case fields for existing records
UPDATE public.students SET
    student_no       = COALESCE(student_no, "studentId"),
    full_name        = COALESCE(full_name, "fullName"),
    program_name     = COALESCE(program_name, course),
    year_level       = COALESCE(year_level, year),
    date_of_birth    = COALESCE(date_of_birth, birthdate),
    email_address    = COALESCE(email_address, email),
    mobile_number    = COALESCE(mobile_number, "contactNumber"),
    "studentId"      = COALESCE("studentId", student_no),
    "fullName"       = COALESCE("fullName", full_name),
    course           = COALESCE(course, program_name),
    year             = COALESCE(year, year_level),
    birthdate        = COALESCE(birthdate, date_of_birth),
    email            = COALESCE(email, email_address),
    "contactNumber"  = COALESCE("contactNumber", mobile_number);

-- ----------------------------------------------------------------------------
-- STEP 3: Automatic Synchronization Trigger (Backwards Compatibility)
-- ----------------------------------------------------------------------------
-- Keeps camelCase and snake_case columns in sync during future inserts/updates
CREATE OR REPLACE FUNCTION public.sync_students_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync snake_case to camelCase
    NEW."studentId"     := COALESCE(NEW."studentId", NEW.student_no);
    NEW.student_no      := COALESCE(NEW.student_no, NEW."studentId");
    NEW."fullName"      := COALESCE(NEW."fullName", NEW.full_name);
    NEW.full_name       := COALESCE(NEW.full_name, NEW."fullName");
    NEW.course          := COALESCE(NEW.course, NEW.program_name);
    NEW.program_name    := COALESCE(NEW.program_name, NEW.course);
    NEW.year            := COALESCE(NEW.year, NEW.year_level);
    NEW.year_level      := COALESCE(NEW.year_level, NEW.year);
    NEW.birthdate       := COALESCE(NEW.birthdate, NEW.date_of_birth);
    NEW.date_of_birth   := COALESCE(NEW.date_of_birth, NEW.birthdate);
    NEW.email           := COALESCE(NEW.email, NEW.email_address);
    NEW.email_address   := COALESCE(NEW.email_address, NEW.email);
    NEW."contactNumber" := COALESCE(NEW."contactNumber", NEW.mobile_number);
    NEW.mobile_number   := COALESCE(NEW.mobile_number, NEW."contactNumber");
    NEW."updatedAt"     := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_students_fields
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_students_fields();

-- ----------------------------------------------------------------------------
-- STEP 4: Identify Annex Form 2 Students & Upsert into Students Table
-- ----------------------------------------------------------------------------
-- Matches school_students against annex_form_2 via student number or name
INSERT INTO public.students (
    uid,
    student_no,
    "studentId",
    full_name,
    "fullName",
    program_name,
    course,
    year_level,
    year,
    date_of_birth,
    birthdate,
    age,
    gender,
    civil_status,
    religion,
    mobile_number,
    "contactNumber",
    email_address,
    email,
    father_full_name,
    father_occupation,
    mother_full_name,
    mother_occupation,
    status,
    role,
    "scholarshipName",
    "updatedAt"
)
SELECT 
    COALESCE(s.uid, gen_random_uuid()) AS uid,
    ss.student_no,
    ss.student_no AS "studentId",
    ss.full_name,
    ss.full_name AS "fullName",
    ss.program_name,
    ss.program_name AS course,
    ss.year_level,
    ss.year_level AS year,
    ss.date_of_birth,
    ss.date_of_birth AS birthdate,
    ss.age,
    ss.gender,
    COALESCE(ss.civil_status, 'Single') AS civil_status,
    ss.religion,
    ss.mobile_number,
    ss.mobile_number AS "contactNumber",
    ss.email_address,
    ss.email_address AS email,
    ss.father_full_name,
    ss.father_occupation,
    ss.mother_full_name,
    ss.mother_occupation,
    'Enrolled' AS status,
    'student' AS role,
    'CHED TES' AS "scholarshipName",
    NOW() AS "updatedAt"
FROM public.school_students ss
INNER JOIN public.annex_form_2 f2 
    ON (
        TRIM(ss.student_no) = TRIM(f2.student_number)
        OR (
            LOWER(ss.full_name) LIKE '%' || LOWER(TRIM(f2.last_name)) || '%' 
            AND LOWER(ss.full_name) LIKE '%' || LOWER(TRIM(f2.given_name)) || '%'
        )
    )
LEFT JOIN public.students s 
    ON (s.student_no = ss.student_no OR s."studentId" = ss.student_no)
ON CONFLICT (student_no) DO UPDATE SET
    full_name         = EXCLUDED.full_name,
    "fullName"        = EXCLUDED."fullName",
    program_name      = EXCLUDED.program_name,
    course            = EXCLUDED.course,
    year_level        = EXCLUDED.year_level,
    year              = EXCLUDED.year,
    date_of_birth     = EXCLUDED.date_of_birth,
    birthdate         = EXCLUDED.birthdate,
    age               = EXCLUDED.age,
    gender            = EXCLUDED.gender,
    civil_status      = EXCLUDED.civil_status,
    religion          = EXCLUDED.religion,
    mobile_number     = EXCLUDED.mobile_number,
    "contactNumber"   = EXCLUDED."contactNumber",
    email_address     = EXCLUDED.email_address,
    email             = EXCLUDED.email,
    father_full_name  = EXCLUDED.father_full_name,
    father_occupation = EXCLUDED.father_occupation,
    mother_full_name  = EXCLUDED.mother_full_name,
    mother_occupation = EXCLUDED.mother_occupation,
    status            = 'Enrolled',
    "scholarshipName" = 'CHED TES',
    "updatedAt"       = NOW();

-- ----------------------------------------------------------------------------
-- STEP 5: Verification Query
-- ----------------------------------------------------------------------------
-- Run this query to inspect the synchronized student records
SELECT 
    s.student_no,
    s.full_name,
    s.program_name,
    s.year_level,
    s.date_of_birth,
    s.age,
    s.gender,
    s.civil_status,
    s.religion,
    s.mobile_number,
    s.email_address,
    s.father_full_name,
    s.father_occupation,
    s.mother_full_name,
    s.mother_occupation,
    s.status,
    s."updatedAt"
FROM public.students s
INNER JOIN public.annex_form_2 f2 
    ON TRIM(s.student_no) = TRIM(f2.student_number);
