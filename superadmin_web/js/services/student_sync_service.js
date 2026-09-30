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
     * Determines whether the student has actually submitted required documents.
     */
    static hasStudentSubmitted(existing = {}, f2Match = null, ss = {}) {
        if (!existing) return false;

        // 1. Explicit submission timestamp
        const submittedAt = existing.submittedAt || existing.submitted_at || existing.documents?.lastSubmittedAt;
        if (submittedAt && String(submittedAt).trim() !== '' && String(submittedAt).trim() !== 'null') {
            return true;
        }

        // 2. Uploaded document files
        const docs = existing.documents || {};
        const hasPdf = !!(existing.submissionPdfUrl || existing.submission_pdf_url || docs.submissionPdfUrl || docs.submission_pdf_url);
        const hasFront = !!(existing.idFrontUrl || existing.id_front_url || docs.idFrontUrl || docs.id_front_url);
        const hasBack = !!(existing.idBackUrl || existing.id_back_url || docs.idBackUrl || docs.id_back_url);
        const hasAtm = !!(existing.atmCardUrl || existing.atm_card_url || docs.atmCardUrl || docs.atm_card_url);

        if (hasPdf || hasFront || hasBack || hasAtm) {
            return true;
        }

        // 3. Meaningful student-provided SA Number (distinct from default 'N/A' placeholder)
        const sa = existing.saNumber || existing.sa_number || docs.saNumber || existing.familyDetails?.saNumber;
        if (sa && String(sa).trim() !== '' && String(sa).trim().toUpperCase() !== 'N/A' && String(sa).trim() !== 'null') {
            // Considered a submission if explicitly edited/saved with an SA number
            if (existing.updated_at && existing.updated_at !== existing.created_at) {
                return true;
            }
        }

        // 4. Explicit status flag
        if (existing.status) {
            const s = String(existing.status).trim().toLowerCase();
            if (s === 'pending' || s === 'submitted' || s === 'under review') {
                return true;
            }
        }

        return false;
    }

    /**
     * Computes dynamic status based on student document submission and Super Admin deadline.
     * Flow:
     * - No documents submitted: 'No Submission Yet'
     * - Documents submitted, waiting for admin: 'Pending' (or 'Late Submission' if past active deadline)
     * - Admin reviewed & validated: 'Approved' / 'Verified' or 'Rejected'
     */
    static computeDynamicStatus(existing = {}, f2Match = null, ss = {}, activeDeadline = null) {
        const hasSubmitted = this.hasStudentSubmitted(existing, f2Match, ss);

        // CASE 1: Student has NOT submitted required documents yet
        if (!hasSubmitted) {
            return 'No Submission Yet';
        }

        // CASE 2: Student HAS submitted documents
        const docs = existing.documents || {};
        const rawSaStatus = (docs.saVerificationStatus || existing.saVerificationStatus || existing.sa_verification_status || '').toLowerCase();
        const rawIdStatus = (docs.idValidationStatus || existing.idValidationStatus || existing.id_validation_status || '').toLowerCase();
        const existingStatus = (existing.status || '').toLowerCase();

        // 2a. Admin explicit Rejection
        if (existingStatus === 'rejected' || rawSaStatus === 'rejected' || rawIdStatus === 'rejected') {
            return 'Rejected';
        }

        // 2b. Admin Validation: both SA and ID validated/approved, or admin explicitly approved
        const isSaApproved = rawSaStatus === 'approved' || rawSaStatus === 'verified';
        const isIdApproved = rawIdStatus === 'approved' || rawIdStatus === 'verified';
        if ((isSaApproved && isIdApproved) || (existingStatus === 'approved' || existingStatus === 'verified')) {
            return 'Approved';
        }

        // 2c. Documents submitted, awaiting Admin review and validation
        // Check if submitted before or after active deadline configured by Super Admin
        const rawSubmittedAt = existing.submittedAt || existing.submitted_at || docs.lastSubmittedAt || existing.updated_at;
        if (activeDeadline && rawSubmittedAt) {
            const subDate = new Date(rawSubmittedAt);
            if (!isNaN(subDate.getTime()) && subDate > activeDeadline) {
                return 'Late Submission';
            }
        }

        return 'Pending';
    }

    /**
     * Maps and standardizes student fields for cross-view compatibility.
     */
    static normalizeStudentRecord(ss = {}, f2Match = null, gmMatch = null, existing = {}, activeDeadline = null) {
        ss = ss || {};
        existing = existing || {};
        const studentNo = ss.student_no || ss.studentId || f2Match?.student_number || f2Match?.student_no || existing.student_no || existing.studentId || 'N/A';
        const fullName = ss.full_name || ss.fullName || (f2Match ? (f2Match.given_name ? `${f2Match.given_name} ${f2Match.last_name || ''}`.trim() : f2Match.name) : null) || existing.full_name || existing.fullName || 'Unknown Student';
        const program = ss.program_name || ss.course || f2Match?.degree_program || existing.program_name || existing.course || 'BSIT';
        const yearLevel = ss.year_level || ss.year || f2Match?.year_level || existing.year_level || '1';
        const birthdate = ss.date_of_birth || ss.birthdate || f2Match?.birthdate || existing.date_of_birth || 'N/A';
        const gender = ss.gender || (f2Match?.sex_at_birth === 'F' ? 'Female' : (f2Match?.sex_at_birth === 'M' ? 'Male' : null)) || existing.gender || 'Female';
        
        const saNumber = f2Match?.tes_application_number && f2Match.tes_application_number !== 'N/A'
            ? f2Match.tes_application_number
            : (existing.sa_number || existing.saNumber || existing.familyDetails?.saNumber || 'N/A');

        const scholarshipName = f2Match?.scholarship_name || ss.scholarship_name || existing.scholarship_name || existing.scholarshipProgram || 'CHED TES';
        
        // Dynamically compute status based on actual submission and admin validation
        const hasSubmitted = this.hasStudentSubmitted(existing, f2Match, ss);
        const status = this.computeDynamicStatus(existing, f2Match, ss, activeDeadline);

        const existingDocs = existing.documents || {};
        let saVerificationStatus = 'No Submission Yet';
        let idValidationStatus = 'No Submission Yet';

        if (status === 'Approved' || status === 'Verified') {
            saVerificationStatus = 'Approved';
            idValidationStatus = 'Approved';
        } else if (status === 'Rejected') {
            saVerificationStatus = 'Rejected';
            idValidationStatus = 'Rejected';
        } else if (hasSubmitted) {
            saVerificationStatus = existingDocs.saVerificationStatus || existing.saVerificationStatus || 'Pending';
            idValidationStatus = existingDocs.idValidationStatus || existing.idValidationStatus || 'Pending';
        } else {
            saVerificationStatus = 'No Submission Yet';
            idValidationStatus = 'No Submission Yet';
        }

        const batch = f2Match?.tes_batch || gmMatch?.batch || existing.batch || 'Batch 1';

        const fatherName = ss.father_full_name || existing.father_full_name || existing.familyDetails?.fatherName || 'N/A';
        const fatherEdu = ss.father_occupation || existing.father_occupation || existing.familyDetails?.fatherEduStatus || 'N/A';
        const motherName = ss.mother_full_name || existing.mother_full_name || existing.familyDetails?.motherName || 'N/A';
        const motherEdu = ss.mother_occupation || existing.mother_occupation || existing.familyDetails?.motherEduStatus || 'N/A';
        const religion = ss.religion || existing.religion || existing.familyDetails?.religion || 'Roman Catholic';

        const lastName = f2Match?.last_name || (ss.full_name ? ss.full_name.split(' ').pop() : '');
        const firstName = f2Match?.given_name || (ss.full_name ? ss.full_name.split(' ').slice(0, -1).join(' ') : '');
        const mi = f2Match?.middle_initial || '';

        const existingFam = existing.familyDetails || {};
        const resolvedScholarYear = existing.scholarYearLevel || existing.yearBecameScholar || existing.year_became_scholar || existingFam.scholarYearLevel || existingFam.yearBecameScholar || null;
        const rawPayouts = (existing.payoutsReceived !== undefined && existing.payoutsReceived !== null && String(existing.payoutsReceived).trim() !== '')
            ? existing.payoutsReceived
            : ((existingFam.payoutsReceived !== undefined && existingFam.payoutsReceived !== null && String(existingFam.payoutsReceived).trim() !== '')
                ? existingFam.payoutsReceived
                : ((existing.payouts_received !== undefined && existing.payouts_received !== null && String(existing.payouts_received).trim() !== '')
                    ? existing.payouts_received
                    : ((existingFam.payouts_received !== undefined && existingFam.payouts_received !== null && String(existingFam.payouts_received).trim() !== '')
                        ? existingFam.payouts_received
                        : null)));

        const documents = {
            ...existingDocs,
            saVerificationStatus: saVerificationStatus,
            idValidationStatus: idValidationStatus,
            saNumber: saNumber
        };

        return {
            id: ss.id || f2Match?.id || existing.id || existing.uid || undefined,
            uid: ss.id || f2Match?.id || existing.uid || undefined,
            
            // Identification
            student_no: studentNo,
            studentId: studentNo,
            full_name: fullName,
            fullName: fullName,
            last_name: lastName,
            first_name: firstName,
            given_name: firstName,
            middle_initial: mi,

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
            scholarYearLevel: resolvedScholarYear,
            yearBecameScholar: resolvedScholarYear,
            payouts_received: rawPayouts,
            payoutsReceived: rawPayouts,
            status: status,
            documents: documents,
            saVerificationStatus: saVerificationStatus,
            idValidationStatus: idValidationStatus,
            sa_verification_status: saVerificationStatus,
            id_validation_status: idValidationStatus,
            adminRemarks: existing.adminRemarks || existing.admin_remarks || (shouldAutoApprove ? 'Automatically approved as confirmed scholar grantee.' : ''),
            admin_remarks: existing.admin_remarks || existing.adminRemarks || (shouldAutoApprove ? 'Automatically approved as confirmed scholar grantee.' : ''),
            role: 'student',
            sa_number: saNumber,
            saNumber: saNumber,
            academic_year: f2Match?.academic_year || existing.academic_year || '2024-2025',
            academicYear: f2Match?.academic_year || existing.academic_year || '2024-2025',
            semester: f2Match?.semester || existing.semester || '1st Semester',
            total_amount: f2Match?.total_amount || 10000.00,
            tes_amount: f2Match?.tes_amount || 10000.00,

            // Demographics
            date_of_birth: birthdate,
            birthdate: birthdate,
            age: ss.age || existing.age || 20,
            gender: gender,
            civil_status: ss.civil_status || existing.civil_status || 'Single',
            religion: religion,
            mobile_number: ss.mobile_number || f2Match?.phone_number || ss.contactNumber || existing.mobile_number || 'N/A',
            contactNumber: ss.mobile_number || f2Match?.phone_number || ss.contactNumber || existing.mobile_number || 'N/A',
            email_address: ss.email_address || f2Match?.email_address || ss.email || existing.email_address || 'N/A',
            email: ss.email_address || f2Match?.email_address || ss.email || existing.email_address || 'N/A',

            // Family
            father_full_name: fatherName,
            father_occupation: fatherEdu,
            mother_full_name: motherName,
            mother_occupation: motherEdu,
            familyDetails: {
                ...existingFam,
                fatherName: fatherName,
                fatherEduStatus: fatherEdu,
                motherName: motherName,
                motherEduStatus: motherEdu,
                yearlyIncome: existingFam.yearlyIncome || '₱120,000',
                religion: religion,
                tribe: existingFam.tribe || 'N/A',
                saNumber: saNumber,
                scholarYearLevel: resolvedScholarYear,
                yearBecameScholar: resolvedScholarYear,
                payoutsReceived: rawPayouts,
                payouts_received: rawPayouts
            },

            // Profile Picture
            profilePictureUrl: existing.profilePictureUrl || existing.profileImageUrl || existing.photoUrl || null,
            created_at: f2Match?.created_at || ss.created_at || existing.created_at || new Date().toISOString(),
            updated_at: f2Match?.updated_at || new Date().toISOString()
        };
    }

    /**
     * Loads student grantees list directly from Supabase.
     * Selects students present in `annex_form_2` (Form 2) table,
     * and joins their detailed profile and demographic information from `school_students`.
     * Default status is 'Pending' since their status is not yet verified.
     * If records are deleted in Supabase, they are immediately reflected/gone.
     * Returns the normalized array of student grantees.
     */
    static async loadAndSyncStudents() {
        const supabase = window.supabaseClient;
        if (!supabase) {
            console.warn('StudentSyncService: Supabase client unavailable.');
            return [];
        }

        try {
            // 0. Fetch active deadline announcement configured by Super Admin
            let activeDeadline = null;
            try {
                const { data: annData } = await supabase
                    .from('announcements')
                    .select('*')
                    .eq('isActive', true)
                    .order('createdAt', { ascending: false });

                if (Array.isArray(annData) && annData.length > 0) {
                    const dlAnn = annData.find(a => a.type === 'Deadline') || annData[0];
                    if (dlAnn) {
                        const tagMatch = (dlAnn.content || '').match(/\[Deadline:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}[^\]]*)\]/i);
                        if (tagMatch) {
                            const parsed = new Date(tagMatch[1].trim());
                            if (!isNaN(parsed.getTime())) activeDeadline = parsed;
                        } else {
                            const dateMatch = ((dlAnn.title || '') + ' ' + (dlAnn.content || '')).match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
                            if (dateMatch) {
                                const parsed = new Date(dateMatch[0]);
                                if (!isNaN(parsed.getTime())) activeDeadline = parsed;
                            }
                        }
                    }
                }
            } catch (dlErr) {
                console.warn('StudentSyncService: Could not check active deadline announcement:', dlErr);
            }

            // 1. Fetch Form 2 records (ground truth for Student Grantees)
            let f2Query = supabase.from('annex_form_2').select('*');
            if (typeof f2Query.order === 'function') {
                f2Query = f2Query.order('created_at', { ascending: false });
            }
            let f2Res = await f2Query;

            if (f2Res.error) {
                console.warn('StudentSyncService: Error loading annex_form_2:', f2Res.error);
                f2Res = { data: [] };
            }

            const form2List = f2Res.data || [];

            // 2. Fetch School Student records (demographics & details)
            let ssQuery = supabase.from('school_students').select('*');
            if (typeof ssQuery.order === 'function') {
                ssQuery = ssQuery.order('created_at', { ascending: false });
            }
            let ssRes = await ssQuery;

            if (ssRes.error) {
                console.warn('StudentSyncService: Error loading school_students:', ssRes.error);
                ssRes = { data: [] };
            }

            const schoolStudents = ssRes.data || [];

            // 3. Check student_grantees table for existing records
            let sgList = [];
            try {
                let sgRes = await supabase.from('student_grantees').select('*');
                if (sgRes && sgRes.data) {
                    sgList = sgRes.data;
                }
            } catch (_) {}

            // If annex_form_2 is completely empty, fallback to student_grantees records if available
            if (!Array.isArray(form2List) || form2List.length === 0) {
                if (Array.isArray(sgList) && sgList.length > 0) {
                    return sgList.map(sg => {
                        const ssMatch = Array.isArray(schoolStudents) ? schoolStudents.find(ss => this.isMatch(ss, sg)) : null;
                        return this.normalizeStudentRecord(ssMatch || {}, null, null, sg, activeDeadline);
                    });
                }
                return [];
            }

            // 4. For each Form 2 record, select its student data from school_students
            const toInsert = [];
            const toUpdate = [];
            const result = form2List.map(f2 => {
                const ssMatch = Array.isArray(schoolStudents)
                    ? schoolStudents.find(ss => this.isMatch(ss, f2))
                    : null;
                const existingSg = Array.isArray(sgList)
                    ? sgList.find(sg => this.isMatch(sg, f2) || (ssMatch && this.isMatch(sg, ssMatch)))
                    : null;
                const normalized = this.normalizeStudentRecord(ssMatch || {}, f2, null, existingSg || {}, activeDeadline);

                if (!existingSg) {
                    toInsert.push({
                        student_no: normalized.student_no,
                        studentId: normalized.student_no,
                        full_name: normalized.full_name,
                        fullName: normalized.fullName,
                        program_name: normalized.program_name,
                        course: normalized.course,
                        year_level: String(normalized.year_level),
                        year: String(normalized.year),
                        date_of_birth: normalized.date_of_birth,
                        birthdate: normalized.birthdate,
                        age: normalized.age,
                        gender: normalized.gender,
                        civil_status: normalized.civil_status,
                        religion: normalized.religion,
                        mobile_number: normalized.mobile_number,
                        contactNumber: normalized.contactNumber,
                        email_address: normalized.email_address,
                        email: normalized.email,
                        father_full_name: normalized.father_full_name,
                        father_occupation: normalized.father_occupation,
                        mother_full_name: normalized.mother_full_name,
                        mother_occupation: normalized.mother_occupation,
                        status: normalized.status, // "No Submission Yet" initially!
                        scholarship_name: normalized.scholarship_name,
                        role: 'student',
                        sa_number: normalized.sa_number,
                        saNumber: normalized.saNumber,
                        academic_year: normalized.academic_year,
                        academicYear: normalized.academicYear,
                        semester: normalized.semester,
                        documents: normalized.documents,
                        familyDetails: normalized.familyDetails,
                        idValidationStatus: normalized.idValidationStatus,
                        id_validation_status: normalized.idValidationStatus,
                        saVerificationStatus: normalized.saVerificationStatus,
                        sa_verification_status: normalized.saVerificationStatus,
                        admin_remarks: normalized.admin_remarks,
                        email_status: 'pending',
                        email_sent_at: null
                    });
                } else if (existingSg) {
                    // Update database record if status differs from dynamic computed status
                    const needsStatusSync = existingSg.status !== normalized.status ||
                        existingSg.saVerificationStatus !== normalized.saVerificationStatus ||
                        existingSg.idValidationStatus !== normalized.idValidationStatus;

                    if (needsStatusSync) {
                        toUpdate.push({
                            id: existingSg.id,
                            uid: existingSg.uid,
                            status: normalized.status,
                            saVerificationStatus: normalized.saVerificationStatus,
                            sa_verification_status: normalized.saVerificationStatus,
                            idValidationStatus: normalized.idValidationStatus,
                            id_validation_status: normalized.idValidationStatus,
                            documents: {
                                ...(existingSg.documents || {}),
                                saVerificationStatus: normalized.saVerificationStatus,
                                idValidationStatus: normalized.idValidationStatus,
                                saNumber: normalized.saNumber
                            },
                            admin_remarks: normalized.admin_remarks,
                            updated_at: new Date().toISOString()
                        });
                    }
                }

                return normalized;
            });

            // Automatically populate student_grantees table in Supabase if records were missing
            if (toInsert.length > 0) {
                try {
                    const { error: insErr } = await supabase.from('student_grantees').insert(toInsert);
                    if (insErr) {
                        console.warn('StudentSyncService: Could not insert missing grantees into student_grantees:', insErr);
                    } else {
                        console.log(`StudentSyncService: Synced ${toInsert.length} students into student_grantees in Supabase.`);
                    }
                } catch (insErr) {
                    console.warn('StudentSyncService: Could not insert missing grantees into student_grantees:', insErr);
                }
            }

            // Automatically update existing grantees status in Supabase
            if (toUpdate.length > 0) {
                for (const item of toUpdate) {
                    try {
                        const { id, ...updateFields } = item;
                        if (id) {
                            await supabase.from('student_grantees').update(updateFields).eq('id', id);
                        } else if (item.uid) {
                            await supabase.from('student_grantees').update(updateFields).eq('uid', item.uid);
                        }
                    } catch (updErr) {
                        console.warn('StudentSyncService: Could not sync grantee status in Supabase:', updErr);
                    }
                }
                console.log(`StudentSyncService: Synced ${toUpdate.length} student grantee statuses in Supabase.`);
            }

            return result;
        } catch (err) {
            console.error('StudentSyncService: Error loading students:', err);
            return [];
        }
    }
}

