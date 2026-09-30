-- ==============================================================================
-- ScholarDoc Push Notifications Database Setup
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql
-- ==============================================================================

-- 1. Create table for storing student device FCM tokens
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- references student's Supabase auth UID or student_grantees.uid
    student_id TEXT,       -- student number e.g. '2023306745'
    fcm_token TEXT NOT NULL UNIQUE,
    device_type TEXT DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for speedy queries when finding tokens for students
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON public.user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_token ON public.user_fcm_tokens(fcm_token);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public and authenticated access to select, insert, update, delete tokens
DROP POLICY IF EXISTS "Allow public read access to user_fcm_tokens" ON public.user_fcm_tokens;
CREATE POLICY "Allow public read access to user_fcm_tokens"
    ON public.user_fcm_tokens FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public insert and upsert access to user_fcm_tokens" ON public.user_fcm_tokens;
CREATE POLICY "Allow public insert and upsert access to user_fcm_tokens"
    ON public.user_fcm_tokens FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to user_fcm_tokens" ON public.user_fcm_tokens;
CREATE POLICY "Allow public update access to user_fcm_tokens"
    ON public.user_fcm_tokens FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Allow public delete access to user_fcm_tokens" ON public.user_fcm_tokens;
CREATE POLICY "Allow public delete access to user_fcm_tokens"
    ON public.user_fcm_tokens FOR DELETE
    USING (true);


-- 2. Add push tracking columns to announcements table to guarantee deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'push_sent'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN push_sent BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'push_sent_at'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN push_sent_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- 3. Add announcementId column to notifications table for deep-linking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'announcementId'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN "announcementId" TEXT;
    END IF;
END $$;


-- 4. Stored Procedure: Fan-out Announcement to In-App Student Notifications
-- Automatically populates notification history for all registered students
CREATE OR REPLACE FUNCTION public.broadcast_announcement_to_notifications(
    p_announcement_id TEXT,
    p_title TEXT,
    p_content TEXT,
    p_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted_count INTEGER := 0;
    v_msg_preview TEXT;
    v_type TEXT;
BEGIN
    -- Format preview message
    v_msg_preview := substring(regexp_replace(p_content, '\[Deadline:\s*[^\]]+\]', '', 'gi') from 1 for 140);
    IF length(p_content) > 140 THEN
        v_msg_preview := v_msg_preview || '...';
    END IF;

    v_type := CASE WHEN p_type = 'Deadline' THEN 'warning' ELSE 'info' END;

    -- Insert notification history row for each student
    INSERT INTO public.notifications (
        "studentId",
        title,
        message,
        type,
        "isRead",
        timestamp,
        "announcementId"
    )
    SELECT DISTINCT
        sg.uid,
        p_title,
        v_msg_preview,
        v_type,
        false,
        timezone('utc'::text, now()),
        p_announcement_id
    FROM public.student_grantees sg
    WHERE sg.uid IS NOT NULL AND sg.uid <> '';

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    -- Update announcement push sent status
    UPDATE public.announcements
    SET push_sent = true, push_sent_at = timezone('utc'::text, now())
    WHERE id::text = p_announcement_id;

    RETURN v_inserted_count;
END;
$$;
