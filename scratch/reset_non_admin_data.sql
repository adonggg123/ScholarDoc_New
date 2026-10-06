-- ============================================================================
-- SQL SCRIPT: Reset System Data for Specified Tables (Keep Admin Users Intact)
-- ============================================================================
-- This script clears data from the exact tables shown in your screenshot.
-- All table structures, columns, admin accounts, and settings remain untouched.

BEGIN;

-- 1. Truncate data from the exact tables listed in your screenshot:
TRUNCATE TABLE public.annex_form_2 RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.annex_form_3 RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.announcements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.grantee_email_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.new_grantees_masterlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.reports RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.scholarships RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.school_students RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.sms_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.student_grantees RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.user_fcm_tokens RESTART IDENTITY CASCADE;

-- Optional: Truncate additional masterlists/students table if present
TRUNCATE TABLE public.students RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.scholar_masterlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.non_qualified_masterlist RESTART IDENTITY CASCADE;

-- 2. Delete non-admin auth accounts from Supabase Auth
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM public.admins)
  AND email NOT IN (SELECT email FROM public.admins WHERE email IS NOT NULL);

COMMIT;
