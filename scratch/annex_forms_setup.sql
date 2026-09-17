-- ==============================================================================
-- Supabase SQL Schema for Annex 5 - Form 2 and Form 3
-- ScholarDoc: Digital Scholarship Verification & Billing Management System
-- ==============================================================================

-- ==============================================================================
-- 1. TABLE: annex_form_2 (Enrolled / Qualified Grantees for Billing)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.annex_form_2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    control_number TEXT,                                        -- 5-digit Sequence / Control No. (e.g. '00001')
    student_number TEXT,                                        -- Student ID / No. (e.g. '46023')
    tes_application_number TEXT DEFAULT 'N/A',                  -- TES Award / SA Number
    last_name TEXT NOT NULL,                                    -- Student's Last Name
    given_name TEXT NOT NULL,                                   -- Student's Given Name
    middle_initial TEXT DEFAULT '',                             -- Middle Initial
    sex_at_birth TEXT DEFAULT 'M',                              -- Sex at Birth ('M' or 'F')
    birthdate TEXT,                                             -- Birthdate (YYYY-MM-DD or MM/DD/YYYY)
    degree_program TEXT,                                        -- Degree Program / Course (e.g. 'BSIT')
    year_level TEXT DEFAULT '1',                                -- Year Level (1, 2, 3, 4)
    email_address TEXT,                                         -- Email Address
    phone_number TEXT,                                          -- Mobile / Contact Number
    tes_batch TEXT DEFAULT '1',                                 -- TES Batch (1, 2, 3, etc.)
    tes_amount NUMERIC(12, 2) DEFAULT 10000.00,                 -- TES Amount (₱10,000.00)
    pwd_amount NUMERIC(12, 2) DEFAULT 0.00,                     -- TES-3A Person with Disability (₱0.00)
    total_amount NUMERIC(12, 2) DEFAULT 10000.00,               -- Total Amount (TES + PWD)
    academic_year TEXT DEFAULT '2024-2025',                     -- Academic Year
    semester TEXT DEFAULT '1st Semester',                       -- Semester
    hei_name TEXT DEFAULT 'USTP Oroquieta',                     -- Higher Education Institution
    hei_campus TEXT DEFAULT 'Oroquieta Campus',                 -- Campus
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. TABLE: annex_form_3 (Not Included / Special Status Grantees)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.annex_form_3 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    control_number TEXT,                                        -- 5-digit Sequence / Control No. (e.g. '00001')
    student_number TEXT,                                        -- Student ID / No. (e.g. '46023')
    tes_application_number TEXT DEFAULT 'N/A',                  -- TES Award / SA Number
    last_name TEXT NOT NULL,                                    -- Student's Last Name
    given_name TEXT NOT NULL,                                   -- Student's Given Name
    middle_initial TEXT DEFAULT '',                             -- Middle Initial
    sex_at_birth TEXT DEFAULT 'M',                              -- Sex at Birth ('M' or 'F')
    birthdate TEXT,                                             -- Birthdate (YYYY-MM-DD or MM/DD/YYYY)
    degree_program TEXT,                                        -- Degree Program / Course (e.g. 'BSIT')
    year_level TEXT DEFAULT '1',                                -- Year Level (1, 2, 3, 4)
    status TEXT NOT NULL DEFAULT 'Not enrolled',                -- Status: Not enrolled, Dropped, Waived, On Leave of Absence (LOA), Transferee, Graduated
    remarks TEXT DEFAULT '',                                    -- Specific remarks / reason
    academic_year TEXT DEFAULT '2024-2025',                     -- Academic Year
    semester TEXT DEFAULT '1st Semester',                       -- Semester
    hei_name TEXT DEFAULT 'USTP Oroquieta',                     -- Higher Education Institution
    hei_campus TEXT DEFAULT 'Oroquieta Campus',                 -- Campus
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. INDEXES FOR FAST QUERYING AND DEDUPLICATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_annex_form_2_student_no ON public.annex_form_2(student_number);
CREATE INDEX IF NOT EXISTS idx_annex_form_2_batch ON public.annex_form_2(tes_batch);
CREATE INDEX IF NOT EXISTS idx_annex_form_2_ay_sem ON public.annex_form_2(academic_year, semester);

CREATE INDEX IF NOT EXISTS idx_annex_form_3_student_no ON public.annex_form_3(student_number);
CREATE INDEX IF NOT EXISTS idx_annex_form_3_status ON public.annex_form_3(status);
CREATE INDEX IF NOT EXISTS idx_annex_form_3_ay_sem ON public.annex_form_3(academic_year, semester);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.annex_form_2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annex_form_3 ENABLE ROW LEVEL SECURITY;

-- Policies for annex_form_2
DROP POLICY IF EXISTS "Allow public read access to annex_form_2" ON public.annex_form_2;
CREATE POLICY "Allow public read access to annex_form_2"
    ON public.annex_form_2 FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert access to annex_form_2" ON public.annex_form_2;
CREATE POLICY "Allow public insert access to annex_form_2"
    ON public.annex_form_2 FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to annex_form_2" ON public.annex_form_2;
CREATE POLICY "Allow public update access to annex_form_2"
    ON public.annex_form_2 FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Allow public delete access to annex_form_2" ON public.annex_form_2;
CREATE POLICY "Allow public delete access to annex_form_2"
    ON public.annex_form_2 FOR DELETE
    USING (true);

-- Policies for annex_form_3
DROP POLICY IF EXISTS "Allow public read access to annex_form_3" ON public.annex_form_3;
CREATE POLICY "Allow public read access to annex_form_3"
    ON public.annex_form_3 FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert access to annex_form_3" ON public.annex_form_3;
CREATE POLICY "Allow public insert access to annex_form_3"
    ON public.annex_form_3 FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to annex_form_3" ON public.annex_form_3;
CREATE POLICY "Allow public update access to annex_form_3"
    ON public.annex_form_3 FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Allow public delete access to annex_form_3" ON public.annex_form_3;
CREATE POLICY "Allow public delete access to annex_form_3"
    ON public.annex_form_3 FOR DELETE
    USING (true);

-- ==============================================================================
-- 5. AUTOMATIC updated_at TRIGGER (OPTIONAL / RECOMMENDED)
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_annex_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_annex_form_2 ON public.annex_form_2;
CREATE TRIGGER trigger_update_annex_form_2
    BEFORE UPDATE ON public.annex_form_2
    FOR EACH ROW
    EXECUTE FUNCTION update_annex_timestamp();

DROP TRIGGER IF EXISTS trigger_update_annex_form_3 ON public.annex_form_3;
CREATE TRIGGER trigger_update_annex_form_3
    BEFORE UPDATE ON public.annex_form_3
    FOR EACH ROW
    EXECUTE FUNCTION update_annex_timestamp();
