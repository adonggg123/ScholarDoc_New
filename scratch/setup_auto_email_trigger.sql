-- ==============================================================================
-- ScholarDoc: Auto-Send Email on New Grantee Insert
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ywavesulvkqwpsejprxp/sql
-- ==============================================================================
-- This creates a PostgreSQL trigger that automatically calls the
-- send-grantee-notification Edge Function whenever a new row is
-- inserted into the student_grantees table.
-- ==============================================================================

-- 1. Enable the pg_net extension (for making HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.auto_notify_new_grantee()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if the student has an email address
  IF (NEW.email_address IS NOT NULL AND NEW.email_address != '') OR 
     (NEW.email IS NOT NULL AND NEW.email != '') THEN
    
    -- Only trigger if email hasn't been sent yet (prevent duplicates)
    IF (NEW.email_sent_at IS NULL) AND 
       (NEW.email_status IS NULL OR NEW.email_status = 'pending') THEN
      
      -- Call the Edge Function asynchronously via pg_net
      PERFORM net.http_post(
        url := 'https://ywavesulvkqwpsejprxp.supabase.co/functions/v1/send-grantee-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('record', row_to_json(NEW))
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing trigger if it exists (safe to re-run)
DROP TRIGGER IF EXISTS on_new_grantee_auto_email ON public.student_grantees;

-- 4. Create the trigger (fires AFTER INSERT on student_grantees)
CREATE TRIGGER on_new_grantee_auto_email
  AFTER INSERT ON public.student_grantees
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_notify_new_grantee();

-- ==============================================================================
-- DONE! Now whenever a new student is added to student_grantees,
-- the system will automatically send them an email notification.
--
-- Flow: Admin adds grantee → Row inserted → Trigger fires → 
--       Edge Function called → Email sent via Resend → Student notified
-- ==============================================================================
