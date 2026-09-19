-- ============================================================================
-- SQL Migration: Add Missing Document, SA Verification & ID Validation Columns
-- Run this script in the Supabase SQL Editor (supabase.com)
-- ============================================================================

-- 1. Add all document, SA number, and verification columns to public.students
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS "saNumber" TEXT,
    ADD COLUMN IF NOT EXISTS sa_number TEXT,
    ADD COLUMN IF NOT EXISTS "submissionPdfUrl" TEXT,
    ADD COLUMN IF NOT EXISTS submission_pdf_url TEXT,
    ADD COLUMN IF NOT EXISTS "submissionPdfName" TEXT,
    ADD COLUMN IF NOT EXISTS submission_pdf_name TEXT,
    ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "idFrontUrl" TEXT,
    ADD COLUMN IF NOT EXISTS id_front_url TEXT,
    ADD COLUMN IF NOT EXISTS "idBackUrl" TEXT,
    ADD COLUMN IF NOT EXISTS id_back_url TEXT,
    ADD COLUMN IF NOT EXISTS "atmCardUrl" TEXT,
    ADD COLUMN IF NOT EXISTS atm_card_url TEXT,
    ADD COLUMN IF NOT EXISTS "atmCardFileName" TEXT,
    ADD COLUMN IF NOT EXISTS "pdfVerified" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "academicYear" TEXT,
    ADD COLUMN IF NOT EXISTS academic_year TEXT,
    ADD COLUMN IF NOT EXISTS semester TEXT,
    ADD COLUMN IF NOT EXISTS "stickerValidated" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS sticker_validated BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "requiresResubmission" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT,
    ADD COLUMN IF NOT EXISTS admin_remarks TEXT,
    ADD COLUMN IF NOT EXISTS "familyDetails" JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "idValidationStatus" TEXT DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS id_validation_status TEXT DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS "saVerificationStatus" TEXT DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS sa_verification_status TEXT DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT,
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 2. Create automatic two-way synchronization trigger for snake_case and camelCase
CREATE OR REPLACE FUNCTION public.sync_student_doc_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW."saNumber"              := COALESCE(NEW."saNumber", NEW.sa_number);
    NEW.sa_number               := COALESCE(NEW.sa_number, NEW."saNumber");
    NEW."submissionPdfUrl"      := COALESCE(NEW."submissionPdfUrl", NEW.submission_pdf_url);
    NEW.submission_pdf_url      := COALESCE(NEW.submission_pdf_url, NEW."submissionPdfUrl");
    NEW."submissionPdfName"     := COALESCE(NEW."submissionPdfName", NEW.submission_pdf_name);
    NEW.submission_pdf_name     := COALESCE(NEW.submission_pdf_name, NEW."submissionPdfName");
    NEW."idFrontUrl"            := COALESCE(NEW."idFrontUrl", NEW.id_front_url);
    NEW.id_front_url            := COALESCE(NEW.id_front_url, NEW."idFrontUrl");
    NEW."idBackUrl"             := COALESCE(NEW."idBackUrl", NEW.id_back_url);
    NEW.id_back_url             := COALESCE(NEW.id_back_url, NEW."idBackUrl");
    NEW."atmCardUrl"            := COALESCE(NEW."atmCardUrl", NEW.atm_card_url);
    NEW.atm_card_url            := COALESCE(NEW.atm_card_url, NEW."atmCardUrl");
    NEW."academicYear"          := COALESCE(NEW."academicYear", NEW.academic_year);
    NEW.academic_year           := COALESCE(NEW.academic_year, NEW."academicYear");
    NEW."stickerValidated"      := COALESCE(NEW."stickerValidated", NEW.sticker_validated);
    NEW.sticker_validated       := COALESCE(NEW.sticker_validated, NEW."stickerValidated");
    NEW."adminRemarks"          := COALESCE(NEW."adminRemarks", NEW.admin_remarks);
    NEW.admin_remarks           := COALESCE(NEW.admin_remarks, NEW."adminRemarks");
    NEW."submittedAt"           := COALESCE(NEW."submittedAt", NEW.submitted_at);
    NEW.submitted_at            := COALESCE(NEW.submitted_at, NEW."submittedAt");
    NEW."idValidationStatus"    := COALESCE(NEW."idValidationStatus", NEW.id_validation_status);
    NEW.id_validation_status    := COALESCE(NEW.id_validation_status, NEW."idValidationStatus");
    NEW."saVerificationStatus"  := COALESCE(NEW."saVerificationStatus", NEW.sa_verification_status);
    NEW.sa_verification_status  := COALESCE(NEW.sa_verification_status, NEW."saVerificationStatus");
    NEW."profilePictureUrl"     := COALESCE(NEW."profilePictureUrl", NEW.profile_picture_url);
    NEW.profile_picture_url     := COALESCE(NEW.profile_picture_url, NEW."profilePictureUrl");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_doc_fields ON public.students;
CREATE TRIGGER trg_sync_student_doc_fields
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_doc_fields();

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
