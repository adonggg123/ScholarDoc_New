-- SQL Schema Setup for Non-Qualified Students Masterlist
-- Run this in your Supabase SQL Editor if the table is not created automatically.

CREATE TABLE IF NOT EXISTS public.non_qualified_masterlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT DEFAULT '',
    name TEXT NOT NULL,
    batch TEXT DEFAULT 'Batch 1',
    reason TEXT DEFAULT 'Non-Qualified',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.non_qualified_masterlist ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated access to select and insert (matching scholar_masterlist policies)
CREATE POLICY "Allow public read access to non_qualified_masterlist"
    ON public.non_qualified_masterlist FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to non_qualified_masterlist"
    ON public.non_qualified_masterlist FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to non_qualified_masterlist"
    ON public.non_qualified_masterlist FOR DELETE
    USING (true);
