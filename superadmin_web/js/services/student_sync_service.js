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
     * Computes the Levenshtein edit distance between two strings
     */
    static levenshteinDistance(s1, s2) {
        s1 = String(s1 || '').toLowerCase();
        s2 = String(s2 || '').toLowerCase();
        if (s1 === s2) return 0;
        if (!s1.length) return s2.length;
        if (!s2.length) return s1.length;

        const prev = new Array(s2.length + 1);
        const curr = new Array(s2.length + 1);
        for (let j = 0; j <= s2.length; j++) prev[j] = j;

        for (let i = 1; i <= s1.length; i++) {
            curr[0] = i;
            const c1 = s1.charCodeAt(i - 1);
            for (let j = 1; j <= s2.length; j++) {
                const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            }
            for (let j = 0; j <= s2.length; j++) prev[j] = curr[j];
        }
        return prev[s2.length];
    }

    /**
     * Normalized Levenshtein similarity (0.0 to 1.0)
     */
    static levenshteinSimilarity(s1, s2) {
        s1 = String(s1 || '').trim().toLowerCase();
        s2 = String(s2 || '').trim().toLowerCase();
        if (s1 === s2) return 1.0;
        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen === 0) return 1.0;
        return Math.max(0, 1 - (this.levenshteinDistance(s1, s2) / maxLen));
    }

    /**
     * Parses full names into structured parts (last, first, mi, tokens).
     * Handles standard Philippine registrar formats like:
     * "SURNAME, FIRSTNAME [MIDDLE/SUFFIX]" or "FIRSTNAME [MIDDLE] SURNAME [SUFFIX]".
     */
    static parseName(fullName, fallbackLast = '', fallbackFirst = '') {
        const raw = String(fullName || '').trim();
        if (!raw) {
            return {
                last: (fallbackLast || '').trim().toLowerCase(),
                first: (fallbackFirst || '').trim().toLowerCase(),
                mi: '',
                tokens: this.nameTokens(`${fallbackLast} ${fallbackFirst}`)
            };
        }

        const cleanStr = raw.replace(/\bN\/A\b/gi, '').replace(/\s+/g, ' ').replace(/^,\s*|,\s*$/g, '').trim();
        let last = '';
        let first = '';
        let mi = '';

        const suffixes = new Set(['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'V', 'VI']);

        if (cleanStr.includes(',')) {
            const parts = cleanStr.split(',');
            last = parts[0].trim();
            const rest = parts.slice(1).join(' ').trim().split(/\s+/).filter(Boolean);
            if (rest.length > 0) {
                const lastToken = rest[rest.length - 1];
                if (suffixes.has(lastToken.toUpperCase())) {
                    const suff = rest.pop();
                    last = `${last} ${suff}`.trim();
                }
                if (rest.length > 1 && (rest[rest.length - 1].length === 1 || (rest[rest.length - 1].length === 2 && rest[rest.length - 1].endsWith('.')))) {
                    mi = rest.pop().replace(/\.$/, '').toUpperCase();
                }
                first = rest.join(' ').trim();
            }
        } else {
            const parts = cleanStr.split(/\s+/).filter(Boolean);
            if (parts.length === 1) {
                last = parts[0];
            } else {
                let suffix = '';
                if (suffixes.has(parts[parts.length - 1].toUpperCase())) {
                    suffix = parts.pop();
                }
                last = parts.pop() || '';
                if (suffix) last = `${last} ${suffix}`.trim();
                if (parts.length > 1 && (parts[parts.length - 1].length === 1 || (parts[parts.length - 1].length === 2 && parts[parts.length - 1].endsWith('.')))) {
                    mi = parts.pop().replace(/\.$/, '').toUpperCase();
                }
                first = parts.join(' ').trim();
            }
        }

        return {
            last: (fallbackLast || last).toLowerCase().trim(),
            first: (fallbackFirst || first).toLowerCase().trim(),
            mi: mi,
            tokens: this.nameTokens(cleanStr)
        };
    }

    /**
     * Strict and intelligent matching between a School Student, Form 2, and a Grantee record.
     * Prevents false positives by:
     * 1. Treating different institutional student IDs as a strict rejection.
     * 2. Requiring surname similarity >= 0.82 for any name match.
     * 3. Requiring given name token overlap or similarity >= 0.70.
     */
    static isMatch(student, grantee) {
        if (!student || !grantee) return false;

        // 0. Match by primary database ID or UID if identical
        const sUid = String(student.uid || student.id || '').trim();
        const gUid = String(grantee.uid || grantee.id || '').trim();
        if (sUid && gUid && sUid === gUid) {
            return true;
        }

        // 1. Institutional Student Number / ID
        const sNo = this.clean(student.student_no || student.student_number || student.studentId || student.id_number || student.idNumber);
        const gNo = this.clean(grantee.student_no || grantee.student_number || grantee.studentId || grantee.student_id || grantee.id_number);

        const hasSNo = sNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(sNo);
        const hasGNo = gNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(gNo);

        // If BOTH records provide a valid student ID:
        // - Matching student ID -> definitive match!
        // - Conflicting student ID -> STRICT REJECTION! Different student IDs can never match.
        if (hasSNo && hasGNo) {
            return sNo === gNo;
        }

        // 2. Match by verified Email Address if both present
        const sEmail = (student.email_address || student.email || '').toString().toLowerCase().trim();
        const gEmail = (grantee.email_address || grantee.email || '').toString().toLowerCase().trim();
        if (sEmail && gEmail && sEmail.includes('@') && sEmail === gEmail && sEmail !== 'n/a') {
            return true;
        }

        // 3. Exact Clean Full Name Match
        const sFullName = student.full_name || student.fullName || student.name || `${student.given_name || student.first_name || ''} ${student.last_name || ''}`.trim();
        const gFullName = grantee.full_name || grantee.fullName || grantee.name || `${grantee.given_name || grantee.first_name || ''} ${grantee.last_name || ''}`.trim();

        const sClean = this.clean(sFullName);
        const gClean = this.clean(gFullName);
        if (sClean && gClean && sClean.length >= 5 && sClean === gClean) {
            return true;
        }

        // 4. Strict Surname + Given Name Verification
        const sName = this.parseName(sFullName, student.last_name, student.given_name || student.first_name);
        const gName = this.parseName(gFullName, grantee.last_name, grantee.given_name || grantee.first_name);

        const sLastClean = this.clean(sName.last);
        const gLastClean = this.clean(gName.last);

        // NON-NEGOTIABLE: Surname similarity must be at least 0.82
        // (Allows minor OCR typos like CANADA vs CATADA, but completely rejects different surnames)
        if (!sLastClean || !gLastClean) return false;
        const lastSim = this.levenshteinSimilarity(sLastClean, gLastClean);
        const isLastSub = (sLastClean.length >= 4 && gLastClean.length >= 4) && (sLastClean.includes(gLastClean) || gLastClean.includes(sLastClean));
        if (lastSim < 0.82 && !isLastSub) {
            return false;
        }

        // Check given names
        const sFirstClean = this.clean(sName.first);
        const gFirstClean = this.clean(gName.first);
        const firstSim = this.levenshteinSimilarity(sFirstClean, gFirstClean);

        const sTokens = sName.tokens;
        const gTokens = gName.tokens;
        const sharedTokens = sTokens.filter(t => gTokens.includes(t));

        // Check middle initials if both explicitly present
        if (sName.mi && gName.mi && sName.mi !== gName.mi && lastSim < 0.95) {
            return false;
        }

        if (firstSim >= 0.70 || sharedTokens.length >= 1 || (sFirstClean && gFirstClean && (sFirstClean.includes(gFirstClean) || gFirstClean.includes(sFirstClean)))) {
            return true;
        }

        return false;
    }

    /**
     * Finds the best matching School Student record for a Form 2 / Grantee record.
     * Uses student number match as primary, followed by scored name matching.
     * Enforces 1-to-1 matching using claimedSet.
     */
    static findBestStudentMatch(grantee, schoolStudents, claimedSet = null) {
        if (!grantee || !Array.isArray(schoolStudents) || schoolStudents.length === 0) return null;

        const gNo = this.clean(grantee.student_no || grantee.student_number || grantee.studentId || grantee.student_id);
        const hasGNo = gNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(gNo);

        // 1. Exact Institutional Student Number Match (Primary)
        if (hasGNo) {
            const exact = schoolStudents.find(ss => {
                if (claimedSet && claimedSet.has(ss.student_no)) return false;
                const sNo = this.clean(ss.student_no || ss.studentId);
                return sNo === gNo;
            });
            if (exact) {
                if (claimedSet) claimedSet.add(exact.student_no);
                return exact;
            }
        }

        // 2. Strict Scored Name Matching
        let bestCandidate = null;
        let bestScore = 0;

        for (const ss of schoolStudents) {
            if (claimedSet && claimedSet.has(ss.student_no)) continue;

            const sNo = this.clean(ss.student_no || ss.studentId);
            const hasSNo = sNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(sNo);
            if (hasGNo && hasSNo && sNo !== gNo) continue;

            if (this.isMatch(ss, grantee)) {
                const sName = this.parseName(ss.full_name);
                const gName = this.parseName(grantee.full_name || `${grantee.last_name || ''}, ${grantee.given_name || ''}`, grantee.last_name, grantee.given_name);
                const lastSim = this.levenshteinSimilarity(this.clean(sName.last), this.clean(gName.last));
                const firstSim = this.levenshteinSimilarity(this.clean(sName.first), this.clean(gName.first));

                const score = (lastSim * 60) + (firstSim * 40);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = ss;
                }
            }
        }

        if (bestCandidate && bestScore >= 75) {
            if (claimedSet) claimedSet.add(bestCandidate.student_no);
            return bestCandidate;
        }

        return null;
    }

    /**
     * Finds the best matching existing student_grantees record for a Form 2 / School Student entry.
     * Enforces 1-to-1 mapping using claimedSet.
     */
    static findBestExistingSgMatch(f2, ssMatch, sgList, claimedSet = null) {
        if (!Array.isArray(sgList) || sgList.length === 0) return null;

        const targetNo = this.clean(f2?.student_number || f2?.student_no || ssMatch?.student_no || ssMatch?.studentId);
        const hasTargetNo = targetNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(targetNo);

        // 1. Exact Student Number Match
        if (hasTargetNo) {
            const match = sgList.find(sg => {
                const id = String(sg.id || sg.uid || '');
                if (claimedSet && claimedSet.has(id)) return false;
                const sgNo = this.clean(sg.student_no || sg.studentId);
                return sgNo === targetNo;
            });
            if (match) {
                if (claimedSet) claimedSet.add(String(match.id || match.uid || ''));
                return match;
            }
        }

        // 2. Exact DB ID / UID Match
        const targetId = String(f2?.id || ssMatch?.id || '').trim();
        if (targetId) {
            const match = sgList.find(sg => {
                const id = String(sg.id || sg.uid || '');
                if (claimedSet && claimedSet.has(id)) return false;
                return String(sg.id || '').trim() === targetId || String(sg.uid || '').trim() === targetId;
            });
            if (match) {
                if (claimedSet) claimedSet.add(String(match.id || match.uid || ''));
                return match;
            }
        }

        // 3. Strict isMatch
        for (const sg of sgList) {
            const id = String(sg.id || sg.uid || '');
            if (claimedSet && claimedSet.has(id)) continue;

            const sgNo = this.clean(sg.student_no || sg.studentId);
            const hasSgNo = sgNo.length >= 5 && !['unassigned', 'none', 'null', 'undefined'].includes(sgNo);
            if (hasTargetNo && hasSgNo && sgNo !== targetNo) continue;

            if (this.isMatch(sg, f2) || (ssMatch && this.isMatch(sg, ssMatch))) {
                if (claimedSet) claimedSet.add(id);
                return sg;
            }
        }

        return null;
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
        const hasAtm = !!(existing.atmCardUrl || existing.atm_card_url || docs.atmCardUrl || docs.atm_card_url || docs.atmProofUrl);
        const hasDeposit = !!(existing.depositSlipUrl || existing.deposit_slip_url || docs.depositSlipUrl || docs.deposit_slip_url);

        if (hasPdf || hasFront || hasBack || hasAtm || hasDeposit) {
            return true;
        }

        // 3. Meaningful student-provided SA Number (distinct from default 'N/A' placeholder)
        const saCandidates = [
            docs.saNumber,
            docs.sa_number,
            docs.atmExtractedSaNumber,
            existing.saNumber,
            existing.sa_number,
            existing.familyDetails?.saNumber
        ];
        let sa = '';
        for (const c of saCandidates) {
            if (c !== undefined && c !== null) {
                const str = String(c).trim();
                if (str !== '' && str.toUpperCase() !== 'N/A' && str.toLowerCase() !== 'null') {
                    sa = str;
                    break;
                }
            }
        }
        if (sa) {
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
     * Official school student demographic details and full names take priority.
     */
    static normalizeStudentRecord(ss = {}, f2Match = null, gmMatch = null, existing = {}, activeDeadline = null) {
        ss = ss || {};
        existing = existing || {};
        const studentNo = ss.student_no || ss.studentId || f2Match?.student_number || f2Match?.student_no || existing.student_no || existing.studentId || 'N/A';
        const fullName = ss.full_name || ss.fullName || (f2Match ? (f2Match.given_name ? `${f2Match.last_name || ''}, ${f2Match.given_name} ${f2Match.middle_initial || ''}`.trim() : f2Match.name) : null) || existing.full_name || existing.fullName || 'Unknown Student';
        const program = ss.program_name || ss.course || f2Match?.degree_program || existing.program_name || existing.course || 'BSIT';
        const yearLevel = ss.year_level || ss.year || f2Match?.year_level || existing.year_level || '1';
        const birthdate = ss.date_of_birth || ss.birthdate || f2Match?.birthdate || existing.date_of_birth || 'N/A';
        
        let gender = ss.gender || (f2Match?.sex_at_birth === 'F' ? 'Female' : (f2Match?.sex_at_birth === 'M' ? 'Male' : null)) || existing.gender || 'Female';
        if (gender === 'M' || gender === 'Male' || gender === 'male') gender = 'Male';
        else if (gender === 'F' || gender === 'Female' || gender === 'female') gender = 'Female';

        const existingDocs = existing.documents || {};
        const saCandidates = [
            f2Match?.tes_application_number,
            existingDocs.saNumber,
            existingDocs.sa_number,
            existingDocs.atmExtractedSaNumber,
            existing.sa_number,
            existing.saNumber,
            existing.familyDetails?.saNumber
        ];
        let saNumber = 'N/A';
        for (const c of saCandidates) {
            if (c !== undefined && c !== null) {
                const s = String(c).trim();
                if (s !== '' && s.toUpperCase() !== 'N/A' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
                    saNumber = s;
                    break;
                }
            }
        }

        const scholarshipName = f2Match?.scholarship_name || ss.scholarship_name || existing.scholarship_name || existing.scholarshipProgram || 'CHED TES';

        // Dynamically compute status based on actual submission and admin validation
        const hasSubmitted = this.hasStudentSubmitted(existing, f2Match, ss);
        const status = this.computeDynamicStatus(existing, f2Match, ss, activeDeadline);

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

        // Check localStorage grantee batches mapping if available
        let localBatchMap = {};
        try {
            localBatchMap = JSON.parse(localStorage.getItem('scholardoc_grantee_batches') || '{}');
        } catch (_) { }

        const sNo = ss.student_no || ss.studentId || f2Match?.student_number || f2Match?.student_no || existing.student_no || existing.studentId || '';
        const saNum = f2Match?.tes_application_number || existing.sa_number || existing.saNumber || '';
        const exId = existing.id || existing.uid || '';
        const normFullName = (fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const cachedBatch = (sNo && localBatchMap[sNo]) ||
            (saNum && localBatchMap[saNum]) ||
            (exId && localBatchMap[exId]) ||
            (normFullName && localBatchMap[normFullName]) ||
            (f2Match?.id && localBatchMap[f2Match.id]) ||
            (gmMatch?.id && localBatchMap[gmMatch.id]);

        const rawBatch = cachedBatch ||
            f2Match?.tes_batch ||
            f2Match?.batch ||
            gmMatch?.batch ||
            existing.batch ||
            existing.tes_batch ||
            ss.batch ||
            ss.tes_batch ||
            existingDocs.batch ||
            'Batch 1.1';

        let batch = String(rawBatch || 'Batch 1.1').trim();
        // Upgrade legacy '1' or 'Batch 1' to 'Batch 1.1'
        if (batch === '1' || batch.toLowerCase() === 'batch 1') {
            batch = 'Batch 1.1';
        } else if (!batch.toLowerCase().startsWith('batch')) {
            batch = `Batch ${batch}`;
        } else if (!batch) {
            batch = 'Batch 1.1';
        }

        const fatherName = ss.father_full_name || existing.father_full_name || existing.familyDetails?.fatherName || 'N/A';
        const fatherEdu = ss.father_occupation || existing.father_occupation || existing.familyDetails?.fatherEduStatus || 'N/A';
        const motherName = ss.mother_full_name || existing.mother_full_name || existing.familyDetails?.motherName || 'N/A';
        const motherEdu = ss.mother_occupation || existing.mother_occupation || existing.familyDetails?.motherEduStatus || 'N/A';
        const religion = ss.religion || existing.religion || existing.familyDetails?.religion || 'Roman Catholic';

        const parsedName = this.parseName(fullName, f2Match?.last_name, f2Match?.given_name);
        const lastName = f2Match?.last_name || parsedName.last || '';
        const firstName = f2Match?.given_name || parsedName.first || '';
        const mi = f2Match?.middle_initial || parsedName.mi || '';

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
            id: existing.id || undefined,
            uid: existing.uid || existing.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),

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
            adminRemarks: existing.adminRemarks || existing.admin_remarks || '',
            admin_remarks: existing.admin_remarks || existing.adminRemarks || '',
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
            console.log(`StudentSyncService: Loaded ${form2List.length} annex_form_2 records.`);

            // 2. Fetch School Student records (demographics & details)
            let schoolStudents = [];
            let ssPage = 0;
            const ssPageSize = 1000;
            let ssHasMore = true;
            while (ssHasMore) {
                const from = ssPage * ssPageSize;
                const to = from + ssPageSize - 1;
                const { data, error } = await supabase
                    .from('school_students')
                    .select('*')
                    .range(from, to);
                if (error || !data || data.length === 0) {
                    ssHasMore = false;
                } else {
                    schoolStudents = schoolStudents.concat(data);
                    if (data.length < ssPageSize) ssHasMore = false;
                    else ssPage++;
                }
            }
            console.log(`StudentSyncService: Loaded ${schoolStudents.length} school_students records.`);

            // 3. Check student_grantees table for existing records
            let sgList = [];
            try {
                let sgRes = await supabase.from('student_grantees').select('*');
                if (sgRes && sgRes.data) {
                    sgList = sgRes.data;
                    console.log(`StudentSyncService: Loaded ${sgList.length} existing student_grantees records.`);
                }
            } catch (_) { }

            // 3b. Fetch New Grantees Masterlist records to cross-reference batches
            let newGranteesList = [];
            try {
                const ngRes = await supabase.from('new_grantees_masterlist').select('*');
                if (ngRes && ngRes.data) {
                    newGranteesList = ngRes.data;
                    console.log(`StudentSyncService: Loaded ${newGranteesList.length} new_grantees_masterlist records.`);
                }
            } catch (_) { }

            // If annex_form_2 is completely empty, fallback to student_grantees records if available
            if (!Array.isArray(form2List) || form2List.length === 0) {
                if (Array.isArray(sgList) && sgList.length > 0) {
                    console.log(`StudentSyncService: No Form 2 data found. Falling back to ${sgList.length} existing student_grantees records.`);
                    return sgList.map(sg => {
                        const ssMatch = Array.isArray(schoolStudents) ? schoolStudents.find(ss => this.isMatch(ss, sg)) : null;
                        const gmMatch = Array.isArray(newGranteesList) ? newGranteesList.find(gm => this.isMatch(gm, sg)) : null;
                        return this.normalizeStudentRecord(ssMatch || {}, null, gmMatch, sg, activeDeadline);
                    });
                }
                console.log('StudentSyncService: No Form 2 data and no existing student_grantees. Returning empty list.');
                return [];
            }

            // 4. For each Form 2 record, select its student data from school_students
            const toInsert = [];
            const toUpdate = [];
            const claimedSchoolStudentNos = new Set();
            const claimedSgIds = new Set();

            const result = form2List.map(f2 => {
                const ssMatch = Array.isArray(schoolStudents)
                    ? this.findBestStudentMatch(f2, schoolStudents, claimedSchoolStudentNos)
                    : null;
                const existingSg = Array.isArray(sgList)
                    ? this.findBestExistingSgMatch(f2, ssMatch, sgList, claimedSgIds)
                    : null;
                const gmMatch = Array.isArray(newGranteesList)
                    ? newGranteesList.find(gm => this.isMatch(gm, f2) || (ssMatch && this.isMatch(gm, ssMatch)))
                    : null;
                const normalized = this.normalizeStudentRecord(ssMatch || {}, f2, gmMatch, existingSg || {}, activeDeadline);

                if (!existingSg) {
                    const newUid = normalized.uid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
                    normalized.uid = newUid;
                    toInsert.push({
                        uid: newUid,
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

            // 5. Include any valid student_grantees records that were NOT in Form 2
            //    (e.g. records created via mobile app login or direct DB insertion)
            //    Prevent any duplicates by verifying clean student_no and DB IDs.
            if (Array.isArray(sgList) && sgList.length > 0) {
                const existingResultNos = new Set(result.map(r => this.clean(r.student_no)).filter(Boolean));

                for (const sg of sgList) {
                    const sgId = String(sg.id || '');
                    const sgUid = String(sg.uid || '');
                    const sgNo = this.clean(sg.student_no || sg.studentId);

                    // Skip if already claimed or matched in the Form 2 loop
                    if ((sgId && claimedSgIds.has(sgId)) || (sgUid && claimedSgIds.has(sgUid))) {
                        continue;
                    }
                    if (sgNo && existingResultNos.has(sgNo)) {
                        continue;
                    }
                    // Also skip if isMatch detects match with any existing result record
                    const alreadyIncluded = result.some(r => this.isMatch(r, sg));
                    if (alreadyIncluded) continue;

                    const ssMatch = Array.isArray(schoolStudents)
                        ? this.findBestStudentMatch(sg, schoolStudents, claimedSchoolStudentNos)
                        : null;
                    const normalized = this.normalizeStudentRecord(ssMatch || {}, null, null, sg, activeDeadline);
                    result.push(normalized);
                    if (sgNo) existingResultNos.add(sgNo);
                }
                console.log(`StudentSyncService: Final result includes ${result.length} total students (Form 2 + unmatched student_grantees).`);
            }

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

