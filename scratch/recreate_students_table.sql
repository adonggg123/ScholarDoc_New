-- ============================================================================
-- SQL SCRIPT: Recreate Students Table & Populate Annex Form 2 Students
-- ============================================================================

-- Step 1: Drop old students table and create fresh with all 15 fields
DROP TABLE IF EXISTS public.students CASCADE;

CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid UUID DEFAULT gen_random_uuid(),
    student_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    program_name TEXT,
    year_level TEXT,
    date_of_birth TEXT,
    age INTEGER,
    gender TEXT,
    civil_status TEXT DEFAULT 'Single',
    religion TEXT,
    mobile_number TEXT,
    email_address TEXT,
    father_full_name TEXT,
    father_occupation TEXT,
    mother_full_name TEXT,
    mother_occupation TEXT,
    status TEXT DEFAULT 'Enrolled',
    scholarship_name TEXT DEFAULT 'CHED TES',
    role TEXT DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Enable Row Level Security (RLS) & add open policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to students" 
    ON public.students FOR SELECT 
    USING (true);

CREATE POLICY "Allow public insert to students" 
    ON public.students FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update to students" 
    ON public.students FOR UPDATE 
    USING (true);

CREATE POLICY "Allow public delete to students" 
    ON public.students FOR DELETE 
    USING (true);

-- Step 3: Populate Annex Form 2 students from school_students
INSERT INTO public.students (
    student_no,
    full_name,
    program_name,
    year_level,
    date_of_birth,
    age,
    gender,
    civil_status,
    religion,
    mobile_number,
    email_address,
    father_full_name,
    father_occupation,
    mother_full_name,
    mother_occupation,
    status,
    scholarship_name
)
SELECT 
    ss.student_no,
    ss.full_name,
    ss.program_name,
    ss.year_level,
    ss.date_of_birth,
    ss.age,
    ss.gender,
    COALESCE(ss.civil_status, 'Single'),
    ss.religion,
    ss.mobile_number,
    ss.email_address,
    ss.father_full_name,
    ss.father_occupation,
    ss.mother_full_name,
    ss.mother_occupation,
    'Enrolled',
    'CHED TES'
FROM public.school_students ss
INNER JOIN public.annex_form_2 f2 
    ON TRIM(ss.student_no) = TRIM(f2.student_number)
ON CONFLICT (student_no) DO UPDATE SET
    full_name         = EXCLUDED.full_name,
    program_name      = EXCLUDED.program_name,
    year_level        = EXCLUDED.year_level,
    date_of_birth     = EXCLUDED.date_of_birth,
    age               = EXCLUDED.age,
    gender            = EXCLUDED.gender,
    civil_status      = EXCLUDED.civil_status,
    religion          = EXCLUDED.religion,
    mobile_number     = EXCLUDED.mobile_number,
    email_address     = EXCLUDED.email_address,
    father_full_name  = EXCLUDED.father_full_name,
    father_occupation = EXCLUDED.father_occupation,
    mother_full_name  = EXCLUDED.mother_full_name,
    mother_occupation = EXCLUDED.mother_occupation,
    status            = 'Enrolled',
    updated_at        = now();

-- Step 4: Verification
SELECT 
    student_no,
    full_name,
    program_name,
    year_level,
    date_of_birth,
    age,
    gender,
    civil_status,
    religion,
    mobile_number,
    email_address,
    father_full_name,
    father_occupation,
    mother_full_name,
    mother_occupation,
    status
FROM public.students
ORDER BY student_no;
