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
    status TEXT DEFAULT 'sent',
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
