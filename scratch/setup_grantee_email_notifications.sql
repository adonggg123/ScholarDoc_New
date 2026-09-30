-- ==============================================================================
-- ScholarDoc Migration: Setup Grantee Email Notifications & Tracking
-- Run this script in your Supabase Dashboard:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql
-- ==============================================================================

-- 1. Add notification status & timestamp columns to student_grantees
ALTER TABLE public.student_grantees
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "emailStatus" TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS email_sent_to TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "emailSentTo" TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_error TEXT DEFAULT NULL;

-- 2. Create dedicated audit log table for grantee email notifications
CREATE TABLE IF NOT EXISTS public.grantee_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT,
    grantee_uid TEXT,
    recipient_email TEXT NOT NULL,
    scholarship_name TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and add policies for security
ALTER TABLE public.grantee_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated and service role full access to email logs"
    ON public.grantee_email_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Automatic synchronization trigger for snake_case and camelCase fields
CREATE OR REPLACE FUNCTION public.sync_grantee_email_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW."emailSentAt"  := COALESCE(NEW."emailSentAt", NEW.email_sent_at);
    NEW.email_sent_at  := COALESCE(NEW.email_sent_at, NEW."emailSentAt");
    NEW."emailStatus"  := COALESCE(NEW."emailStatus", NEW.email_status);
    NEW.email_status   := COALESCE(NEW.email_status, NEW."emailStatus");
    NEW."emailSentTo"  := COALESCE(NEW."emailSentTo", NEW.email_sent_to);
    NEW.email_sent_to  := COALESCE(NEW.email_sent_to, NEW."emailSentTo");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_grantee_email_fields ON public.student_grantees;
CREATE TRIGGER trg_sync_grantee_email_fields
BEFORE INSERT OR UPDATE ON public.student_grantees
FOR EACH ROW
EXECUTE FUNCTION public.sync_grantee_email_fields();

-- ==============================================================================
-- 4. (OPTIONAL) AUTOMATIC DATABASE WEBHOOK VIA PG_NET
-- If you want Supabase to automatically fire the Edge Function directly from PostgreSQL
-- whenever a new row is inserted into student_grantees:
--
-- 1. Enable the pg_net extension in Supabase Dashboard (Database -> Extensions -> pg_net)
-- 2. Replace YOUR_PROJECT_REF and YOUR_ANON_KEY below and uncomment:
--
-- CREATE OR REPLACE FUNCTION public.trigger_send_grantee_email()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.email_address IS NOT NULL AND NEW.email_sent_at IS NULL THEN
--         PERFORM net.http_post(
--             url := 'https://ywavesulvkqwpsejprxp.supabase.co/functions/v1/send-grantee-notification',
--             headers := jsonb_build_object(
--                 'Content-Type', 'application/json',
--                 'Authorization', 'Bearer YOUR_ANON_KEY'
--             ),
--             body := jsonb_build_object(
--                 'record', row_to_json(NEW)
--             )
--         );
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS trg_auto_email_grantee ON public.student_grantees;
-- CREATE TRIGGER trg_auto_email_grantee
-- AFTER INSERT ON public.student_grantees
-- FOR EACH ROW
-- EXECUTE FUNCTION public.trigger_send_grantee_email();
-- ==============================================================================
