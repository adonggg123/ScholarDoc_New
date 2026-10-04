-- ==============================================================================
-- ScholarDoc Migration: Setup Semaphore SMS Notifications & Tracking
-- Run this script in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql
-- ==============================================================================

-- 1. Add SMS tracking columns to student_grantees
ALTER TABLE public.student_grantees
    ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "smsSentAt" TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sms_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "smsStatus" TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS sms_sent_to TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "smsSentTo" TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sms_error TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sms_message_id TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS "smsMessageId" TEXT DEFAULT NULL;

-- 2. Create dedicated audit log table for SMS notifications
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT,
    grantee_uid TEXT,
    recipient_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    event_type TEXT DEFAULT 'general', -- 'grantee_confirmed', 'announcement', 'application_approved', 'application_rejected', 'sa_revision', 'id_revision', 'custom'
    status TEXT DEFAULT 'queued',      -- 'queued', 'sent', 'delivered', 'failed', 'skipped'
    semaphore_message_id TEXT,
    network TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and add policies for security
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and service role full access to sms logs" ON public.sms_logs;
CREATE POLICY "Allow authenticated and service role full access to sms logs"
    ON public.sms_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Automatic synchronization trigger for snake_case and camelCase SMS fields on student_grantees
CREATE OR REPLACE FUNCTION public.sync_grantee_sms_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW."smsSentAt"    := COALESCE(NEW."smsSentAt", NEW.sms_sent_at);
    NEW.sms_sent_at    := COALESCE(NEW.sms_sent_at, NEW."smsSentAt");
    NEW."smsStatus"    := COALESCE(NEW."smsStatus", NEW.sms_status);
    NEW.sms_status     := COALESCE(NEW.sms_status, NEW."smsStatus");
    NEW."smsSentTo"    := COALESCE(NEW."smsSentTo", NEW.sms_sent_to);
    NEW.sms_sent_to    := COALESCE(NEW.sms_sent_to, NEW."smsSentTo");
    NEW."smsMessageId" := COALESCE(NEW."smsMessageId", NEW.sms_message_id);
    NEW.sms_message_id := COALESCE(NEW.sms_message_id, NEW."smsMessageId");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_grantee_sms_fields ON public.student_grantees;
CREATE TRIGGER trg_sync_grantee_sms_fields
BEFORE INSERT OR UPDATE ON public.student_grantees
FOR EACH ROW
EXECUTE FUNCTION public.sync_grantee_sms_fields();

-- 4. Add SMS tracking column to announcements
ALTER TABLE public.announcements
    ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ DEFAULT NULL;

