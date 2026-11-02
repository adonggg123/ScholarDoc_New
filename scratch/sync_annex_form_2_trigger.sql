-- ==============================================================================
-- SQL Script: Real-Time Auto-Sync from student_grantees to annex_form_2
-- ==============================================================================
-- This trigger automatically synchronizes student profile updates into
-- annex_form_2 (and school_students) whenever a row in student_grantees is updated.

CREATE OR REPLACE FUNCTION public.sync_student_to_annex_form_2()
RETURNS TRIGGER AS $$
DECLARE
    target_no TEXT;
    clean_sa TEXT;
    clean_yr TEXT;
    clean_gender TEXT;
    new_email TEXT;
    new_phone TEXT;
    new_birthdate TEXT;
    new_program TEXT;
BEGIN
    target_no := COALESCE(NEW.student_no, NEW."studentId");
    IF target_no IS NULL OR target_no = '' OR target_no = 'N/A' THEN
        RETURN NEW;
    END IF;

    -- Extract email
    new_email := COALESCE(NEW.email_address, NEW.email);
    
    -- Extract phone
    new_phone := COALESCE(NEW.mobile_number, NEW."contactNumber");

    -- Extract birthdate
    new_birthdate := COALESCE(NEW.date_of_birth, NEW.birthdate);

    -- Extract degree program / course
    new_program := COALESCE(NEW.program_name, NEW.course);

    -- Clean SA number (only update if valid)
    clean_sa := COALESCE(NEW.sa_number, NEW."saNumber");

    -- Clean Year Level (e.g. "3rd Year - Baccalaureate" -> "3")
    clean_yr := substring(COALESCE(NEW.year_level, NEW.year, '') from '\d+');
    IF clean_yr IS NULL OR clean_yr = '' THEN
        clean_yr := COALESCE(NEW.year_level, NEW.year);
    END IF;

    -- Clean Gender to 'M' or 'F'
    IF lower(COALESCE(NEW.gender, '')) LIKE 'm%' THEN
        clean_gender := 'M';
    ELSIF lower(COALESCE(NEW.gender, '')) LIKE 'f%' THEN
        clean_gender := 'F';
    ELSE
        clean_gender := NULL;
    END IF;

    -- Update annex_form_2
    UPDATE public.annex_form_2
    SET
        email_address = COALESCE(new_email, email_address),
        phone_number = COALESCE(new_phone, phone_number),
        birthdate = COALESCE(new_birthdate, birthdate),
        degree_program = COALESCE(new_program, degree_program),
        year_level = COALESCE(clean_yr, year_level),
        sex_at_birth = COALESCE(clean_gender, sex_at_birth),
        tes_application_number = CASE 
            WHEN clean_sa IS NOT NULL AND clean_sa != '' AND upper(clean_sa) != 'N/A' AND clean_sa != 'null' 
            THEN clean_sa 
            ELSE tes_application_number 
        END,
        updated_at = NOW()
    WHERE student_number = target_no;

    -- Also keep school_students in sync
    UPDATE public.school_students
    SET
        email_address = COALESCE(new_email, email_address),
        mobile_number = COALESCE(new_phone, mobile_number),
        date_of_birth = COALESCE(new_birthdate, date_of_birth),
        program_name = COALESCE(new_program, program_name),
        year_level = COALESCE(clean_yr, year_level),
        gender = COALESCE(clean_gender, gender),
        updated_at = NOW()
    WHERE student_no = target_no;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_to_annex_form_2 ON public.student_grantees;
CREATE TRIGGER trg_sync_student_to_annex_form_2
    AFTER UPDATE OR INSERT ON public.student_grantees
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_to_annex_form_2();

-- Immediate one-time sync of all current student_grantees into annex_form_2
UPDATE public.annex_form_2 a
SET
    email_address = COALESCE(s.email_address, s.email, a.email_address),
    phone_number = COALESCE(s.mobile_number, s."contactNumber", a.phone_number),
    birthdate = COALESCE(s.date_of_birth, s.birthdate, a.birthdate),
    degree_program = COALESCE(s.program_name, s.course, a.degree_program),
    tes_application_number = CASE 
        WHEN COALESCE(s.sa_number, s."saNumber") IS NOT NULL 
             AND COALESCE(s.sa_number, s."saNumber") != '' 
             AND upper(COALESCE(s.sa_number, s."saNumber")) != 'N/A' 
        THEN COALESCE(s.sa_number, s."saNumber") 
        ELSE a.tes_application_number 
    END,
    updated_at = NOW()
FROM public.student_grantees s
WHERE a.student_number = COALESCE(s.student_no, s."studentId");

