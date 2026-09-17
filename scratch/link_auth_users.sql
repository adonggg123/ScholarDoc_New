-- ============================================================================
-- SQL SCRIPT: Link Students Table with Supabase Auth Users & Add App Columns
-- ============================================================================

-- 1. Link each student's `uid` to their actual Supabase Auth account ID
UPDATE public.students s
SET uid = u.id
FROM auth.users u
WHERE u.email = s.student_no || '@scholardoc.com'
   OR u.email = s.email_address;

-- 2. Add backwards-compatible camelCase columns required by the Flutter app
ALTER TABLE public.students 
    ADD COLUMN IF NOT EXISTS "studentId" TEXT,
    ADD COLUMN IF NOT EXISTS "fullName" TEXT,
    ADD COLUMN IF NOT EXISTS "course" TEXT,
    ADD COLUMN IF NOT EXISTS "year" TEXT,
    ADD COLUMN IF NOT EXISTS "birthdate" TEXT,
    ADD COLUMN IF NOT EXISTS "email" TEXT,
    ADD COLUMN IF NOT EXISTS "contactNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- 3. Copy values so mobile app can read them immediately
UPDATE public.students SET
    "studentId"     = student_no,
    "fullName"      = full_name,
    "course"        = program_name,
    "year"          = year_level,
    "birthdate"     = date_of_birth,
    "email"         = email_address,
    "contactNumber" = mobile_number,
    "createdAt"     = created_at,
    "updatedAt"     = updated_at;

-- 4. Automatically keep both column styles in sync on any future insert/update
CREATE OR REPLACE FUNCTION public.sync_students_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW."studentId"     := COALESCE(NEW."studentId", NEW.student_no);
    NEW.student_no      := COALESCE(NEW.student_no, NEW."studentId");
    NEW."fullName"      := COALESCE(NEW."fullName", NEW.full_name);
    NEW.full_name       := COALESCE(NEW.full_name, NEW."fullName");
    NEW.course          := COALESCE(NEW.course, NEW.program_name);
    NEW.program_name    := COALESCE(NEW.program_name, NEW.course);
    NEW.year            := COALESCE(NEW.year, NEW.year_level);
    NEW.year_level      := COALESCE(NEW.year_level, NEW.year);
    NEW.birthdate       := COALESCE(NEW.birthdate, NEW.date_of_birth);
    NEW.date_of_birth   := COALESCE(NEW.date_of_birth, NEW.birthdate);
    NEW.email           := COALESCE(NEW.email, NEW.email_address);
    NEW.email_address   := COALESCE(NEW.email_address, NEW.email);
    NEW."contactNumber" := COALESCE(NEW."contactNumber", NEW.mobile_number);
    NEW.mobile_number   := COALESCE(NEW.mobile_number, NEW."contactNumber");
    NEW."createdAt"     := COALESCE(NEW."createdAt", NEW.created_at, NOW());
    NEW.created_at      := COALESCE(NEW.created_at, NEW."createdAt", NOW());
    NEW."updatedAt"     := NOW();
    NEW.updated_at      := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_students_fields
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_students_fields();
