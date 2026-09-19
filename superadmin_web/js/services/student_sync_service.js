// js/services/student_sync_service.js

/**
 * StudentSyncService
 * Automatically identifies and selects students from School Student Records (`school_students`)
 * who are included in the Grantee Master List (`annex_form_2` and `new_grantees_masterlist`).
 * 
 * Provides unified, synchronized student data across:
 * - Student Records view
 * - Student Master List Records (Reports view)
 * - Super Admin Dashboard stats and charts
 */

export class StudentSyncService {
    /**
     * Clean string: lowercase and remove all non-alphanumeric characters.
     */
    static clean(str) {
        return (str || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Extract normalized word tokens from a name.
     */
    static nameTokens(str) {
        return (str || '')
            .toString()
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 1);
    }

    /**
     * Intelligent matching between a School Student and a Grantee record.
     */
    static isMatch(student, grantee) {
        if (!student || !grantee) return false;

        // 1. Match by Student Number / ID
        const sNo = this.clean(student.student_no || student.studentId || student.id_number);
        const gNo = this.clean(grantee.student_number || grantee.student_no || grantee.studentId || grantee.student_id);
        if (sNo && gNo && sNo === gNo) {
            return true;
        }

        // 2. Exact or Substring Clean String Match
        const sFullName = student.full_name || student.fullName || `${student.first_name || ''} ${student.last_name || ''}`;
        const gFullName = grantee.name || grantee.fullName || `${grantee.last_name || ''} ${grantee.given_name || grantee.first_name || ''}`;
        
        const sClean = this.clean(sFullName);
        const gClean = this.clean(gFullName);

        if (sClean && gClean) {
            if (sClean === gClean || sClean.includes(gClean) || gClean.includes(sClean)) {
                return true;
            }
        }

        // 3. Last Name + First Name Token Intersection
        const sTokens = this.nameTokens(sFullName);
        const gLast = (grantee.last_name || '').toString().toLowerCase().trim();
        const gFirst = (grantee.given_name || grantee.first_name || '').toString().toLowerCase().trim();

        if (gLast && gFirst && sTokens.length >= 2) {
            const hasLast = sTokens.some(t => t.includes(gLast) || gLast.includes(t));
            const hasFirst = sTokens.some(t => t.includes(gFirst) || gFirst.includes(t));
            if (hasLast && hasFirst) {
                return true;
            }
        }

        // 4. Reverse Name Match (e.g. "Jariol, Jude" vs "Jude Jariol")
        const gTokens = this.nameTokens(gFullName);
        if (sTokens.length >= 2 && gTokens.length >= 2) {
            const sharedTokens = sTokens.filter(t => gTokens.includes(t));
            if (sharedTokens.length >= 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * Maps and standardizes student fields for cross-view compatibility.
     */
    static normalizeStudentRecord(ss, f2Match = null, gmMatch = null, existing = {}) {
        const studentNo = ss.student_no || ss.studentId || existing.student_no || existing.studentId || 'N/A';
        const fullName = ss.full_name || ss.fullName || existing.full_name || existing.fullName || 'Unknown Student';
        const program = ss.program_name || ss.course || existing.program_name || existing.course || 'BSIT';
        const yearLevel = ss.year_level || ss.year || f2Match?.year_level || existing.year_level || '1';
        const birthdate = ss.date_of_birth || ss.birthdate || f2Match?.birthdate || existing.date_of_birth || 'N/A';
        const gender = ss.gender || (f2Match?.sex_at_birth === 'F' ? 'Female' : 'Male') || existing.gender || 'Female';
        
        const saNumber = f2Match?.tes_application_number && f2Match.tes_application_number !== 'N/A'
            ? f2Match.tes_application_number
            : (existing.sa_number || existing.saNumber || existing.familyDetails?.saNumber || 'N/A');

        const scholarshipName = ss.scholarship_name || existing.scholarship_name || existing.scholarshipProgram || 'CHED TES';
        const status = f2Match ? 'Verified' : (existing.status || 'Approved');
        const batch = f2Match?.tes_batch || gmMatch?.batch || existing.batch || 'Batch 1';

        const fatherName = ss.father_full_name || existing.father_full_name || existing.familyDetails?.fatherName || 'N/A';
        const fatherEdu = ss.father_occupation || existing.father_occupation || existing.familyDetails?.fatherEduStatus || 'N/A';
        const motherName = ss.mother_full_name || existing.mother_full_name || existing.familyDetails?.motherName || 'N/A';
        const motherEdu = ss.mother_occupation || existing.mother_occupation || existing.familyDetails?.motherEduStatus || 'N/A';
        const religion = ss.religion || existing.religion || existing.familyDetails?.religion || 'Roman Catholic';

        return {
            id: ss.id || existing.id || existing.uid || undefined,
            uid: existing.uid || ss.id || undefined,
            
            // Identification
            student_no: studentNo,
            studentId: studentNo,
            full_name: fullName,
            fullName: fullName,

            // Academic
            program_name: program,
            course: program,
            year_level: yearLevel,
            year: yearLevel,
            section: existing.section || '1',
            batch: batch,

            // Scholarship & Verification
            scholarship_name: scholarshipName,
            scholarshipName: scholarshipName,
            scholarshipProgram: scholarshipName,
            scholarYearLevel: ss.year_level || yearLevel || '1',
            payouts_received: existing.payouts_received || existing.payoutsReceived || 1,
            payoutsReceived: existing.payoutsReceived || existing.payouts_received || 1,
            status: status,
            role: 'student',
            sa_number: saNumber,
            saNumber: saNumber,
            academic_year: f2Match?.academic_year || existing.academic_year || '2024-2025',
            academicYear: f2Match?.academic_year || existing.academic_year || '2024-2025',
            semester: f2Match?.semester || existing.semester || '1st Semester',
            total_amount: f2Match?.total_amount || 10000.00,

            // Demographics
            date_of_birth: birthdate,
            birthdate: birthdate,
            age: ss.age || existing.age || 20,
            gender: gender,
            civil_status: ss.civil_status || existing.civil_status || 'Single',
            religion: religion,
            mobile_number: ss.mobile_number || ss.contactNumber || existing.mobile_number || 'N/A',
            contactNumber: ss.mobile_number || ss.contactNumber || existing.mobile_number || 'N/A',
            email_address: ss.email_address || ss.email || existing.email_address || 'N/A',
            email: ss.email_address || ss.email || existing.email_address || 'N/A',

            // Family
            father_full_name: fatherName,
            father_occupation: fatherEdu,
            mother_full_name: motherName,
            mother_occupation: motherEdu,
            familyDetails: {
                fatherName: fatherName,
                fatherEduStatus: fatherEdu,
                motherName: motherName,
                motherEduStatus: motherEdu,
                yearlyIncome: existing.familyDetails?.yearlyIncome || '₱120,000',
                religion: religion,
                tribe: existing.familyDetails?.tribe || 'N/A',
                saNumber: saNumber
            },

            // Profile Picture
            profilePictureUrl: existing.profilePictureUrl || existing.profileImageUrl || existing.photoUrl || null,
            created_at: ss.created_at || existing.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Loads School Students and identifies matching Grantees from Annex Form 2 and Grantee Masterlist.
     * Upserts matched records to `public.students` in Supabase to keep the database in sync.
     * Returns the complete array of matching students.
     */
    static async loadAndSyncStudents() {
        const supabase = window.supabaseClient;
        if (!supabase) {
            console.warn('StudentSyncService: Supabase client unavailable.');
            return [];
        }

        try {
            // Fetch school_students, annex_form_2, new_grantees_masterlist, and existing students concurrently
            const [
                { data: schoolStudents, error: ssErr },
                { data: form2Records, error: f2Err },
                { data: granteeRecords, error: gmErr },
                { data: existingStudents, error: stErr }
            ] = await Promise.all([
                supabase.from('school_students').select('*'),
                supabase.from('annex_form_2').select('*'),
                supabase.from('new_grantees_masterlist').select('*'),
                supabase.from('students').select('*')
            ]);

            if (ssErr) console.warn('StudentSyncService: school_students query error:', ssErr);
            if (f2Err) console.warn('StudentSyncService: annex_form_2 query error:', f2Err);
            if (gmErr) console.warn('StudentSyncService: new_grantees_masterlist query error:', gmErr);

            const allSchoolStudents = schoolStudents || [];
            const allForm2 = form2Records || [];
            const allGrantees = granteeRecords || [];
            const currentStudents = existingStudents || [];

            // Index existing students by student number for fast lookup
            const existingMap = new Map();
            currentStudents.forEach(s => {
                const key = this.clean(s.student_no || s.studentId);
                if (key) existingMap.set(key, s);
            });

            // Match school students with Form 2 or Grantee Masterlist
            const matchedList = [];
            const toUpsertInDb = [];

            allSchoolStudents.forEach(ss => {
                const f2Match = allForm2.find(f => this.isMatch(ss, f));
                const gmMatch = allGrantees.find(g => this.isMatch(ss, g));

                // A student is included if they appear in Annex Form 2 OR the Grantee Master List
                if (f2Match || gmMatch) {
                    const cleanNo = this.clean(ss.student_no);
                    const existing = cleanNo ? existingMap.get(cleanNo) || {} : {};
                    const normalized = this.normalizeStudentRecord(ss, f2Match, gmMatch, existing);
                    matchedList.push(normalized);

                    // Prepare DB upsert payload (only valid table columns)
                    toUpsertInDb.push({
                        student_no: normalized.student_no,
                        full_name: normalized.full_name,
                        program_name: normalized.program_name,
                        year_level: normalized.year_level,
                        date_of_birth: normalized.date_of_birth,
                        age: normalized.age,
                        gender: normalized.gender,
                        civil_status: normalized.civil_status,
                        religion: normalized.religion,
                        mobile_number: normalized.mobile_number,
                        email_address: normalized.email_address,
                        father_full_name: normalized.father_full_name,
                        father_occupation: normalized.father_occupation,
                        mother_full_name: normalized.mother_full_name,
                        mother_occupation: normalized.mother_occupation,
                        status: normalized.status,
                        scholarship_name: normalized.scholarship_name,
                        role: 'student',
                        sa_number: normalized.sa_number,
                        academic_year: normalized.academic_year,
                        semester: normalized.semester,
                        familyDetails: normalized.familyDetails
                    });
                }
            });

            // Also preserve any manually registered students in `students` table that weren't in school_students
            currentStudents.forEach(cs => {
                const cleanNo = this.clean(cs.student_no || cs.studentId);
                const alreadyIncluded = matchedList.some(m => this.clean(m.student_no) === cleanNo);
                if (!alreadyIncluded && cleanNo) {
                    matchedList.push(this.normalizeStudentRecord(cs, null, null, cs));
                }
            });

            // Asynchronously sync to Supabase `students` table in background (upsert on student_no)
            if (toUpsertInDb.length > 0) {
                supabase
                    .from('students')
                    .upsert(toUpsertInDb, { onConflict: 'student_no' })
                    .then(({ error: upsertErr }) => {
                        if (upsertErr) {
                            console.warn('StudentSyncService: Background upsert to students table:', upsertErr);
                        } else {
                            console.log(`StudentSyncService: Successfully synced ${toUpsertInDb.length} matched students to database.`);
                        }
                    })
                    .catch(err => console.warn('StudentSyncService: Upsert error:', err));
            }

            return matchedList;

        } catch (err) {
            console.error('StudentSyncService: Unexpected error while syncing students:', err);
            // Fallback to whatever is in students table
            try {
                const { data } = await supabase.from('students').select('*');
                return data || [];
            } catch (fallbackErr) {
                return [];
            }
        }
    }
}
