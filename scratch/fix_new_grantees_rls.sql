-- ==============================================================================
-- Supabase SQL Fix: Enable SELECT, INSERT, UPDATE, DELETE on new_grantees_masterlist
-- ScholarDoc: New Grantees Masterlist Row Level Security Policies
-- ==============================================================================
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp
-- 2. In the left sidebar, click on "SQL Editor".
-- 3. Click "New query", paste the entire code below, and click "Run".
-- ==============================================================================

-- 1. Ensure the table exists
CREATE TABLE IF NOT EXISTS public.new_grantees_masterlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    last_name TEXT,
    first_name TEXT,
    middle_name TEXT DEFAULT '',
    name TEXT NOT NULL,
    course TEXT DEFAULT 'BSIT',
    batch TEXT DEFAULT 'Batch 1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.new_grantees_masterlist ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent naming conflicts
DROP POLICY IF EXISTS "Allow public read access to new_grantees_masterlist" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow public insert access to new_grantees_masterlist" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow public update access to new_grantees_masterlist" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow public delete access to new_grantees_masterlist" ON public.new_grantees_masterlist;

DROP POLICY IF EXISTS "Allow anon read access" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow anon insert access" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow anon update access" ON public.new_grantees_masterlist;
DROP POLICY IF EXISTS "Allow anon delete access" ON public.new_grantees_masterlist;

DROP POLICY IF EXISTS "Allow all access to new_grantees_masterlist" ON public.new_grantees_masterlist;

-- 4. Create explicit CRUD policies for public (anon and authenticated)

-- SELECT Policy
CREATE POLICY "Allow public read access to new_grantees_masterlist"
    ON public.new_grantees_masterlist FOR SELECT
    USING (true);

-- INSERT Policy
CREATE POLICY "Allow public insert access to new_grantees_masterlist"
    ON public.new_grantees_masterlist FOR INSERT
    WITH CHECK (true);

-- UPDATE Policy (allows inline editing in the table)
CREATE POLICY "Allow public update access to new_grantees_masterlist"
    ON public.new_grantees_masterlist FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- DELETE Policy (allows single row deletion and bulk clearing)
CREATE POLICY "Allow public delete access to new_grantees_masterlist"
    ON public.new_grantees_masterlist FOR DELETE
    USING (true);

-- 5. Reload the PostgREST schema cache so policies take effect immediately
NOTIFY pgrst, 'reload schema';
