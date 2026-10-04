-- ==============================================================================
-- ScholarDoc Migration: Setup System Settings Table for Notification Preferences
-- Run this script in your Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and grant access to authenticated users and anon client
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read/write access to system settings" ON public.system_settings;
CREATE POLICY "Allow read/write access to system settings"
    ON public.system_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default notification preferences if not exists
INSERT INTO public.system_settings (key, value)
VALUES (
    'notification_preferences',
    '{"email_notifications": true, "sms_alerts": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
