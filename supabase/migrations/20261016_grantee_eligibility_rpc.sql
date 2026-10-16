-- ==============================================================================
-- Migration: Validate Student Grantee Eligibility
-- Ensures students can only log in and authenticate if they are listed in
-- the official student_grantees table.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_student_grantee_eligibility(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean text := trim(p_identifier);
    v_clean_no text := regexp_replace(v_clean, '[\s\-]', '', 'g');
    v_grantee record;
BEGIN
    IF v_clean IS NULL OR v_clean = '' THEN
        RETURN jsonb_build_object(
            'is_eligible', false,
            'message', 'Student identifier is required.'
        );
    END IF;

    SELECT id, uid, student_no, full_name, program_name
    INTO v_grantee
    FROM public.student_grantees
    WHERE student_no = v_clean
       OR student_no = v_clean_no
       OR "studentId" = v_clean
       OR "studentId" = v_clean_no
       OR email = v_clean
       OR email_address = v_clean
       OR (CASE WHEN v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN uid = v_clean::uuid ELSE false END)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'is_eligible', true,
            'student_no', v_grantee.student_no,
            'full_name', v_grantee.full_name,
            'message', 'Student is registered as an eligible grantee.'
        );
    ELSE
        RETURN jsonb_build_object(
            'is_eligible', false,
            'message', 'Access denied. Student ID "' || v_clean || '" is not registered as an eligible grantee in the scholarship database.'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_student_grantee_eligibility(text) TO anon, authenticated, service_role;
