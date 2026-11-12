// js/services/annex_sync_service.js
import { VerificationService } from './verification_service.js';

/**
 * AnnexSyncService
 * Provides real-time, persistent, and deduplicated synchronization of
 * verified Form 2 (Enrolled) and Form 3 (Not Included) student records
 * between the Admin Interface (Review Queue / Annex 5 Generator),
 * the Super Admin Reports section, and the Supabase database.
 */

const STORAGE_KEY = 'scholardoc_annex5_verified_data';
const CHANNEL_NAME = 'scholardoc_annex5_sync_channel';
const CUSTOM_EVENT_NAME = 'scholardoc_annex5_sync_event';

// Initialize BroadcastChannel if supported
let broadcastChannel = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    }
} catch (e) {
    console.warn('BroadcastChannel not supported in this environment, falling back to storage events:', e);
}

export class AnnexSyncService {
    static isSavingToDb = false;

    /**
     * Generates a term-specific storage key to ensure complete data isolation between academic periods.
     */
    static getStorageKey(academicYear, semester) {
        if (academicYear && semester && academicYear !== 'All' && semester !== 'All') {
            return `${STORAGE_KEY}_${academicYear}_${semester}`;
        }
        return STORAGE_KEY;
    }

    /**
     * Checks whether a candidate SA value is empty or a placeholder/seeded dummy value.
     */
    static isPlaceholderSa(val) {
        if (val === undefined || val === null) return true;
        const s = String(val).trim();
        if (!s) return true;
        const upper = s.toUpperCase();
        if (
            upper === 'N/A' ||
            upper === 'NA' ||
            upper === 'NONE' ||
            upper === 'NULL' ||
            upper === 'UNDEFINED' ||
            upper === 'PENDING' ||
            upper === 'UNASSIGNED' ||
            upper === 'NOT SPECIFIED' ||
            upper === 'NOT SUBMITTED YET' ||
            upper === '-' ||
            upper === '--'
        ) {
            return true;
        }
        // Filter out seeded/dummy TES application numbers (e.g., 2023-TES-001, TES-001)
        if (/^\d{4}-TES-\d+$/i.test(s) || /^TES-\d+$/i.test(s)) {
            return true;
        }
        return false;
    }

    /**
     * Extracts authentic student-submitted SA number. Returns 'N/A' when none is submitted.
     */
    static extractAuthenticSaNumber(...objects) {
        for (const obj of objects) {
            if (!obj) continue;
            if (typeof obj === 'string') {
                const s = obj.trim();
                if (!this.isPlaceholderSa(s)) {
                    return s;
                }
                continue;
            }
            const candidates = [
                obj.saNumber,
                obj.sa_number,
                obj.tes_application_number,
                obj.documents?.saNumber,
                obj.documents?.sa_number,
                obj.documents?.atmExtractedSaNumber,
                obj.documents?.atm_extracted_sa_number,
                obj.atmExtractedSaNumber,
                obj.familyDetails?.saNumber
            ];
            for (const c of candidates) {
                if (!this.isPlaceholderSa(c)) {
                    return String(c).trim();
                }
            }
        }
        return 'N/A';
    }

    /**
     * Extracts a stable, unique key for a grantee or verification item.
     * Prioritizes semantic student identifiers (Student ID, SA Number, Full Name)
     * over database row UUIDs so records from different tables or import runs
     * match correctly.
     */
    static getUniqueKey(item) {
        if (!item) return '';
        const g = item.grantee || item;
        const s = item.matchedStudent || {};

        // 1. Primary: Valid Student ID (prefer matched student ID or grantee student ID)
        const idRaw = String(s.studentId || s.studentNo || s.student_no || g.student_id || g.studentId || g.studentNo || g.student_no || item.student_id || item.studentId || '').trim().toLowerCase();
        const cleanId = idRaw.replace(/[^a-z0-9]/g, '');
        const isPlaceholderId = (v) => !v || v === 'na' || v === 'unassigned' || v === 'null' || v === 'undefined' || v.length < 3;
        if (!isPlaceholderId(cleanId)) {
            return `id_${cleanId}`;
        }

        // 2. TES / SA App Number if valid
        const saRaw = String(s.saNumber || g.saNumber || g.sa_number || g.tes_application_number || item.saNumber || item.tes_application_number || g.familyDetails?.saNumber || s.familyDetails?.saNumber || '').trim().toLowerCase();
        const cleanSa = saRaw.replace(/[^a-z0-9]/g, '');
        if (cleanSa && cleanSa !== 'na' && cleanSa !== 'unassigned' && cleanSa !== 'null' && cleanSa.length >= 4) {
            return `sa_${cleanSa}`;
        }

        // 3. Normalized Name (Last + First + Middle)
        const nameParts = this.parseNameParts(item);
        if (nameParts.cleanKey && nameParts.cleanKey.length >= 3) {
            return `name_${nameParts.cleanKey}`;
        }

        const lName = (g.last_name || g.lastName || '').trim().toLowerCase();
        const fName = (g.first_name || g.firstName || '').trim().toLowerCase();
        const mName = (g.middle_name || g.middleName || '').trim().toLowerCase();
        const combined = `${lName}_${fName}_${mName}`.replace(/[^a-z0-9]/g, '');
        if (combined && combined.length >= 3) return `name_${combined}`;

        const rawName = (g.name || g.fullName || `${lName} ${fName}`).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (rawName && rawName.length >= 3) return `raw_${rawName}`;

        // 4. Fallback: Database record ID if no student ID, SA number, or name is available
        const dbId = String(g.id || item.id || '').trim();
        if (dbId) {
            return `gid_${dbId}`;
        }

        return Math.random().toString(36).substring(2, 9);
    }

    /**
     * Helper to reliably extract and normalize name parts.
     */
    static parseNameParts(item) {
        if (!item) return { lastName: '', firstName: '', mi: '', cleanKey: '', tokens: [] };
        const grantee = item.grantee || item || {};
        const student = item.matchedStudent || {};

        if (typeof VerificationService !== 'undefined' && VerificationService.normalizeName) {
            const rawName = grantee.name || grantee.fullName || `${grantee.last_name || ''} ${grantee.first_name || ''}` || student.fullName || student.full_name || student.name || '';
            if (rawName) {
                const norm = VerificationService.normalizeName(rawName);
                if (norm && (norm.lastName || norm.firstName)) {
                    return norm;
                }
            }
        }

        let lastName = student.lastName || student.last_name || grantee.last_name || grantee.lastName || '';
        let firstName = student.firstName || student.first_name || grantee.first_name || grantee.firstName || '';
        let mi = student.mi || student.middleInitial || student.middle_name || grantee.middle_name || grantee.middleName || '';

        if (!lastName || !firstName) {
            const raw = String(student.fullName || student.full_name || student.name || grantee.name || grantee.fullName || '').trim();
            if (raw.includes(',')) {
                const parts = raw.split(',');
                lastName = parts[0].trim();
                const rest = (parts[1] || '').trim().split(/\s+/);
                firstName = rest.slice(0, -1).join(' ') || rest[0] || '';
                mi = rest.length > 1 ? rest[rest.length - 1].charAt(0).toUpperCase() : '';
            } else {
                const tokens = raw.split(/\s+/);
                lastName = tokens[tokens.length - 1] || '';
                firstName = tokens.slice(0, -1).join(' ') || lastName;
            }
        }
        const cleanKey = `${lastName} ${firstName} ${mi}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        const tokens = `${lastName} ${firstName}`.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1);
        return { lastName, firstName, mi, cleanKey, tokens };
    }

    /**
     * Determines whether two items represent the same student/grantee.
     * Robustly compares database UUID, student ID, SA number, and normalized names.
     */
    static isSameStudent(itemA, itemB) {
        if (!itemA || !itemB) return false;
        if (itemA === itemB) return true;

        const gA = itemA.grantee || itemA;
        const sA = itemA.matchedStudent || {};
        const gB = itemB.grantee || itemB;
        const sB = itemB.matchedStudent || {};

        // 1. Direct Database / Record ID match
        const dbIdA = String(gA.id || itemA.id || '').trim();
        const dbIdB = String(gB.id || itemB.id || '').trim();
        if (dbIdA && dbIdB && dbIdA === dbIdB) {
            return true;
        }

        // 2. Student ID match (ignoring generic placeholders)
        const idA = String(sA.studentId || sA.studentNo || sA.student_no || gA.student_id || gA.studentId || gA.studentNo || itemA.student_id || itemA.studentId || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const idB = String(sB.studentId || sB.studentNo || sB.student_no || gB.student_id || gB.studentId || gB.studentNo || itemB.student_id || itemB.studentId || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const isPlaceholderId = (id) => !id || id === 'na' || id === 'unassigned' || id.length < 3;

        if (!isPlaceholderId(idA) && !isPlaceholderId(idB)) {
            if (idA === idB) return true;
        }

        // 3. Unique Key match (if not random or uuid/gid-based)
        const keyA = this.getUniqueKey(itemA);
        const keyB = this.getUniqueKey(itemB);
        if (keyA && keyB && keyA === keyB && !keyA.startsWith('gid_') && !keyA.startsWith('rnd_')) {
            return true;
        }

        // 4. TES / SA App Number match
        const saA = String(sA.saNumber || gA.saNumber || gA.sa_number || gA.familyDetails?.saNumber || sA.familyDetails?.saNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const saB = String(sB.saNumber || gB.saNumber || gB.sa_number || gB.familyDetails?.saNumber || sB.familyDetails?.saNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (saA && saB && saA !== 'na' && saA.length >= 4 && saA === saB) {
            return true;
        }

        // 5. Name Comparison using parsed & normalized name parts
        const namePartsA = this.parseNameParts(itemA);
        const namePartsB = this.parseNameParts(itemB);

        const lastA = String(namePartsA.lastName || gA.last_name || gA.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const lastB = String(namePartsB.lastName || gB.last_name || gB.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const firstA = String(namePartsA.firstName || gA.first_name || gA.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const firstB = String(namePartsB.firstName || gB.first_name || gB.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

        if (lastA && lastB && firstA && firstB) {
            if (lastA === lastB) {
                if (firstA === firstB || firstA.includes(firstB) || firstB.includes(firstA)) {
                    return true;
                }
            }
        }

        // 6. Clean concatenated key comparison
        const cleanA = String(namePartsA.cleanKey || `${lastA}${firstA}`).replace(/[^a-z0-9]/g, '');
        const cleanB = String(namePartsB.cleanKey || `${lastB}${firstB}`).replace(/[^a-z0-9]/g, '');
        if (cleanA && cleanB && cleanA.length >= 4 && cleanA === cleanB) {
            return true;
        }

        // 7. Token overlap comparison
        if (namePartsA.tokens && namePartsB.tokens && namePartsA.tokens.length >= 2 && namePartsB.tokens.length >= 2) {
            const tokensA = namePartsA.tokens;
            const tokensB = namePartsB.tokens;
            const intersection = tokensA.filter(t => tokensB.includes(t));
            if (intersection.length >= Math.min(tokensA.length, tokensB.length)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Strictly deduplicates records across Form 2, Form 3, and Needs Review Queue.
     * Prevents any record from appearing in multiple lists simultaneously.
     * Uses dual-layer protection: unique key matching and deep isSameStudent comparison.
     */
    static deduplicateLists(form2List = [], form3List = [], needsReviewList = []) {
        const seenKeys = new Set();
        const cleanForm2 = [];
        const cleanForm3 = [];
        const cleanReview = [];

        // 1. Form 2: Included / Enrolled Grantees
        for (const item of (form2List || [])) {
            const key = this.getUniqueKey(item);
            const isDuplicate = (key && seenKeys.has(key)) || cleanForm2.some(existing => this.isSameStudent(existing, item));
            if (!isDuplicate) {
                if (key) seenKeys.add(key);
                const itemCopy = { ...item };
                const cleanSa = this.extractAuthenticSaNumber(itemCopy.matchedStudent, itemCopy.grantee);
                if (itemCopy.grantee) {
                    itemCopy.grantee = { ...itemCopy.grantee, saNumber: cleanSa, sa_number: cleanSa, tes_application_number: cleanSa };
                }
                if (itemCopy.matchedStudent) {
                    itemCopy.matchedStudent = { ...itemCopy.matchedStudent, saNumber: cleanSa, sa_number: cleanSa, tes_application_number: cleanSa };
                }
                itemCopy.classification = 'MATCHED_FORM2';
                itemCopy.isEnrolled = true;
                cleanForm2.push(itemCopy);
            }
        }

        // 2. Form 3: Not Included Grantees (Special statuses: Not enrolled, Dropped, Waived, LOA, Transferee, Graduated)
        for (const item of (form3List || [])) {
            const key = this.getUniqueKey(item);
            const isDuplicate = (key && seenKeys.has(key)) || cleanForm2.some(existing => this.isSameStudent(existing, item)) || cleanForm3.some(existing => this.isSameStudent(existing, item));
            if (!isDuplicate) {
                if (key) seenKeys.add(key);
                const itemCopy = { ...item };
                const cleanSa = this.extractAuthenticSaNumber(itemCopy.matchedStudent, itemCopy.grantee);
                if (itemCopy.grantee) {
                    itemCopy.grantee = { ...itemCopy.grantee, saNumber: cleanSa, sa_number: cleanSa, tes_application_number: cleanSa };
                }
                if (itemCopy.matchedStudent) {
                    itemCopy.matchedStudent = { ...itemCopy.matchedStudent, saNumber: cleanSa, sa_number: cleanSa, tes_application_number: cleanSa };
                }
                itemCopy.classification = 'INACTIVE_FORM3';
                itemCopy.isEnrolled = false;
                itemCopy.specialStatusReason = itemCopy.specialStatusReason || 'Not enrolled';
                itemCopy.remarks = itemCopy.remarks || `Categorized: ${itemCopy.specialStatusReason}`;
                cleanForm3.push(itemCopy);
            }
        }

        // 3. Needs Review Queue: Discrepancy items awaiting Admin action
        for (const item of (needsReviewList || [])) {
            const key = this.getUniqueKey(item);
            const isDuplicate = (key && seenKeys.has(key)) || cleanForm2.some(existing => this.isSameStudent(existing, item)) || cleanForm3.some(existing => this.isSameStudent(existing, item)) || cleanReview.some(existing => this.isSameStudent(existing, item));
            if (!isDuplicate) {
                if (key) seenKeys.add(key);
                const itemCopy = { ...item };
                itemCopy.classification = 'NEEDS_REVIEW';
                cleanReview.push(itemCopy);
            }
        }

        return {
            form2List: cleanForm2,
            form3List: cleanForm3,
            needsReviewList: cleanReview
        };
    }

    /**
     * Saves verified lists to persistent storage, broadcasts updates, and auto-syncs to Supabase.
     */
    static saveVerifiedData({
        form2List,
        form3List,
        needsReviewList,
        updatedBy = 'Admin',
        syncToDb = true,
        academicYear = '2026-2027',
        semester = '1st Semester'
    }) {
        try {
            const deduplicated = this.deduplicateLists(form2List, form3List, needsReviewList);
            const totalCount = deduplicated.form2List.length + deduplicated.form3List.length + deduplicated.needsReviewList.length;

            const payload = {
                timestamp: Date.now(),
                updatedBy: updatedBy,
                totalCount: totalCount,
                academicYear: academicYear,
                semester: semester,
                form2Count: deduplicated.form2List.length,
                form3Count: deduplicated.form3List.length,
                reviewCount: deduplicated.needsReviewList.length,
                form2List: deduplicated.form2List,
                form3List: deduplicated.form3List,
                needsReviewList: deduplicated.needsReviewList
            };

            const termStorageKey = this.getStorageKey(academicYear, semester);
            localStorage.setItem(termStorageKey, JSON.stringify(payload));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

            // Broadcast via BroadcastChannel
            if (broadcastChannel) {
                try {
                    broadcastChannel.postMessage({ type: 'SYNC_UPDATE', payload });
                } catch (bcErr) {
                    console.warn('BroadcastChannel postMessage error:', bcErr);
                }
            }

            // Broadcast via in-window CustomEvent
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));

            // Automatically sync to Supabase in the background only when explicitly requested
            if (syncToDb && (deduplicated.form2List.length > 0 || deduplicated.form3List.length > 0)) {
                this.saveToSupabase({
                    form2List: deduplicated.form2List,
                    form3List: deduplicated.form3List,
                    academicYear: academicYear,
                    semester: semester
                }).catch(err => console.warn('Background Supabase auto-sync error:', err));
            }

            return payload;
        } catch (e) {
            console.error('Error saving Annex 5 verified sync data:', e);
            return null;
        }
    }

    /**
     * Retrieves verified data from storage, partitioned strictly by academic year and semester.
     */
    static getVerifiedData(academicYear, semester) {
        try {
            let raw = null;
            if (academicYear && semester && academicYear !== 'All' && semester !== 'All') {
                raw = localStorage.getItem(this.getStorageKey(academicYear, semester));
            }
            if (!raw) {
                const generalRaw = localStorage.getItem(STORAGE_KEY);
                if (generalRaw) {
                    try {
                        const parsedGeneral = JSON.parse(generalRaw);
                        if (parsedGeneral) {
                            const matchAy = !academicYear || academicYear === 'All' || parsedGeneral.academicYear === academicYear;
                            const matchSem = !semester || semester === 'All' || parsedGeneral.semester === semester;
                            if (matchAy && matchSem) {
                                raw = generalRaw;
                            }
                        }
                    } catch (_) {}
                }
            }
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.form2List)) return null;

            // Filter out corrupted/broken items from old cached sessions
            const isValidItem = (item) => {
                if (!item) return false;
                const g = item.grantee || item;
                const s = item.matchedStudent || {};
                const nameStr = (g.name || g.fullName || `${g.last_name || ''} ${g.first_name || ''}` || s.fullName || s.full_name || s.name || '').replace(/^,\s*|,\s*$/g, '').trim();
                if (!nameStr || nameStr === ',') return false;

                // Validate that Form 2 matches don't contain stale false-positive pairings
                if (item.classification === 'MATCHED_FORM2' && item.matchedStudent) {
                    const gL = (g.last_name || g.lastName || '').trim().toLowerCase();
                    const sL = (s.lastName || s.last_name || '').trim().toLowerCase();
                    const gId = (g.student_id || g.studentId || '').trim();
                    const sId = (s.studentId || s.student_no || '').trim();
                    const idsMatch = gId && sId && gId.replace(/[^0-9a-zA-Z]/g, '') === sId.replace(/[^0-9a-zA-Z]/g, '');
                    if (!idsMatch && gL && sL && !gL.includes(sL) && !sL.includes(gL)) {
                        if (typeof VerificationService !== 'undefined' && VerificationService.levenshteinSimilarity) {
                            if (VerificationService.levenshteinSimilarity(gL, sL) < 0.75) {
                                return false; // Stale false-positive match from older run
                            }
                        }
                    }
                }
                return true;
            };
            const validF2 = (parsed.form2List || []).filter(isValidItem);
            const validF3 = (parsed.form3List || []).filter(isValidItem);
            const validRev = (parsed.needsReviewList || []).filter(isValidItem);

            // Ensure deduplication on read
            const deduplicated = this.deduplicateLists(validF2, validF3, validRev);

            return {
                ...parsed,
                ...deduplicated,
                form2Count: deduplicated.form2List.length,
                form3Count: deduplicated.form3List.length,
                reviewCount: deduplicated.needsReviewList.length
            };
        } catch (e) {
            console.warn('Error reading Annex 5 verified sync data:', e);
            return null;
        }
    }

    /**
     * Persists verified Form 2 and Form 3 records directly to the Supabase database.
     * Supports both object parameter and positional arguments (form2List, form3List, updatedBy, academicYear, semester).
     */
    static async saveToSupabase(arg1 = {}, arg2 = [], arg3 = '', arg4 = '2026-2027', arg5 = '1st Semester') {
        let form2List = [];
        let form3List = [];
        let academicYear = '2026-2027';
        let semester = '1st Semester';
        let heiName = 'USTP Oroquieta';
        let heiCampus = 'Oroquieta Campus';
        let allowEmptyForm2 = false;
        let allowEmptyForm3 = false;

        if (Array.isArray(arg1)) {
            form2List = arg1;
            form3List = Array.isArray(arg2) ? arg2 : [];
            academicYear = arg4 || '2026-2027';
            semester = arg5 || '1st Semester';
        } else if (arg1 && typeof arg1 === 'object') {
            form2List = arg1.form2List || [];
            form3List = arg1.form3List || [];
            academicYear = arg1.academicYear || '2026-2027';
            semester = arg1.semester || '1st Semester';
            heiName = arg1.heiName || 'USTP Oroquieta';
            heiCampus = arg1.heiCampus || 'Oroquieta Campus';
            allowEmptyForm2 = Boolean(arg1.allowEmptyForm2);
            allowEmptyForm3 = Boolean(arg1.allowEmptyForm3);
        }
        const supabase = window.supabaseClient;
        if (!supabase) {
            console.warn('AnnexSyncService.saveToSupabase: Supabase client is not available.');
            return { success: false, error: 'Supabase client not available' };
        }

        this.isSavingToDb = true;
        try {
            const dedupedInput = this.deduplicateLists(form2List, form3List, []);
            form2List = dedupedInput.form2List;
            form3List = dedupedInput.form3List;

            // Preserve authentic SA numbers and batches already stored in annex_form_2 or student_grantees
            const existingF2Map = new Map();
            const existingSgMap = new Map();
            try {
                const { data: prevF2 } = await supabase
                    .from('annex_form_2')
                    .select('student_number, last_name, given_name, tes_application_number, tes_batch')
                    .match({ academic_year: academicYear, semester: semester });
                if (Array.isArray(prevF2)) {
                    prevF2.forEach(r => {
                        const sNo = String(r.student_number || '').trim();
                        const nKey = `${String(r.last_name || '').trim().toLowerCase()}|${String(r.given_name || '').trim().toLowerCase()}`;
                        if (sNo) existingF2Map.set(sNo, r);
                        if (nKey !== '|') existingF2Map.set(nKey, r);
                    });
                }
            } catch (_) { }
            try {
                const { data: prevSg } = await supabase
                    .from('student_grantees')
                    .select('student_no, studentId, full_name, fullName, sa_number, saNumber, documents, familyDetails');
                if (Array.isArray(prevSg)) {
                    prevSg.forEach(sg => {
                        const sNo = String(sg.student_no || sg.studentId || '').trim();
                        const sName = String(sg.full_name || sg.fullName || '').trim().toLowerCase();
                        if (sNo) existingSgMap.set(sNo, sg);
                        if (sName) existingSgMap.set(sName, sg);
                        if (sName.includes(',')) {
                            const [l, rest] = sName.split(',').map(p => p.trim());
                            const f = (rest || '').split(/\s+/)[0] || '';
                            if (l && f) existingSgMap.set(`${l}|${f}`, sg);
                        }
                    });
                }
            } catch (_) { }

            // 1. Prepare Form 2 Rows (Enrolled Grantees)
            const f2Rows = (form2List || []).map((item, idx) => {
                const ctrl = String(idx + 1).padStart(5, '0');
                const grantee = item.grantee || {};
                const student = item.matchedStudent || {};
                const name = this.parseNameParts(item);

                const studentNo = student.studentId || student.studentNo || grantee.student_id || grantee.studentNo || null;
                const sNoKey = String(studentNo || '').trim();
                const firstWord = String(name.firstName || '').trim().toLowerCase().split(/\s+/)[0] || '';
                const nKey = `${String(name.lastName || '').trim().toLowerCase()}|${String(name.firstName || '').trim().toLowerCase()}`;
                const nShortKey = `${String(name.lastName || '').trim().toLowerCase()}|${firstWord}`;
                const prevF2Row = existingF2Map.get(sNoKey) || existingF2Map.get(nKey);
                const prevSgRow = existingSgMap.get(sNoKey) || existingSgMap.get(nKey) || existingSgMap.get(nShortKey);

                const saNo = prevSgRow
                    ? this.extractAuthenticSaNumber(prevSgRow)
                    : this.extractAuthenticSaNumber(student, grantee, prevF2Row);
                const gender = (student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
                const bdate = student.birthdate || student.dateOfBirth || student.birthday || '01/01/2000';
                const degree = student.course || student.programName || grantee.course || 'BSIT';
                const yr = String(student.year || student.yearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
                const email = student.email || student.emailAddress || 'N/A';
                const phone = student.mobileNumber || student.phone || student.contactNumber || grantee.phone || 'N/A';
                const batchCandidate = grantee.batch || grantee.tes_batch || student.batch || student.documents?.batch || prevF2Row?.tes_batch || prevSgRow?.documents?.batch || '1.2';
                const rawB = String(batchCandidate).replace(/[^0-9.]/g, '') || '1.2';
                const batch = (rawB === '1') ? '1.1' : rawB;

                return {
                    control_number: ctrl,
                    student_number: studentNo,
                    tes_application_number: saNo,
                    last_name: name.lastName || 'N/A',
                    given_name: name.firstName || 'N/A',
                    middle_initial: name.mi || '',
                    sex_at_birth: gender,
                    birthdate: bdate,
                    degree_program: degree,
                    year_level: yr,
                    email_address: email,
                    phone_number: phone,
                    tes_batch: batch,
                    tes_amount: 10000.00,
                    pwd_amount: 0.00,
                    total_amount: 10000.00,
                    academic_year: academicYear,
                    semester: semester,
                    hei_name: heiName,
                    hei_campus: heiCampus,
                    updated_at: new Date().toISOString()
                };
            });

            // 2. Prepare Form 3 Rows (Not Included Grantees)
            const f3Rows = (form3List || []).map((item, idx) => {
                const ctrl = String(idx + 1).padStart(5, '0');
                const grantee = item.grantee || {};
                const student = item.matchedStudent || {};
                const name = this.parseNameParts(item);

                const studentNo = student.studentId || student.studentNo || grantee.student_id || grantee.studentNo || null;
                const sNoKey = String(studentNo || '').trim();
                const firstWord = String(name.firstName || '').trim().toLowerCase().split(/\s+/)[0] || '';
                const nKey = `${String(name.lastName || '').trim().toLowerCase()}|${String(name.firstName || '').trim().toLowerCase()}`;
                const nShortKey = `${String(name.lastName || '').trim().toLowerCase()}|${firstWord}`;
                const prevSgRow = existingSgMap.get(sNoKey) || existingSgMap.get(nKey) || existingSgMap.get(nShortKey);
                const saNo = prevSgRow
                    ? this.extractAuthenticSaNumber(prevSgRow)
                    : this.extractAuthenticSaNumber(student, grantee);
                const gender = (student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
                const bdate = student.birthdate || student.dateOfBirth || student.birthday || '01/01/2000';
                const degree = student.course || student.programName || grantee.course || 'BSIT';
                const yr = String(student.year || student.yearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
                const status = item.specialStatusReason || item.status || 'Not enrolled';
                const remarks = item.remarks || (status === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${status}`);

                return {
                    control_number: ctrl,
                    student_number: studentNo,
                    tes_application_number: saNo,
                    last_name: name.lastName || 'N/A',
                    given_name: name.firstName || 'N/A',
                    middle_initial: name.mi || '',
                    sex_at_birth: gender,
                    birthdate: bdate,
                    degree_program: degree,
                    year_level: yr,
                    status: status,
                    remarks: remarks,
                    academic_year: academicYear,
                    semester: semester,
                    hei_name: heiName,
                    hei_campus: heiCampus,
                    updated_at: new Date().toISOString()
                };
            });

            // 3. Sync Form 2 to Supabase: replace records for this AY/Sem only when non-empty (or explicitly allowed)
            if (f2Rows.length > 0 || allowEmptyForm2) {
                await supabase.from('annex_form_2').delete().match({ academic_year: academicYear, semester: semester });
                if (f2Rows.length > 0) {
                    const batchSize = 100;
                    for (let i = 0; i < f2Rows.length; i += batchSize) {
                        const chunk = f2Rows.slice(i, i + batchSize);
                        const { error: errF2 } = await supabase.from('annex_form_2').insert(chunk);
                        if (errF2) {
                            console.error('AnnexSyncService: Error inserting to annex_form_2:', errF2);
                            throw errF2;
                        }
                    }
                }
            }

            // 4. Sync Form 3 to Supabase: replace records for this AY/Sem only when non-empty (or explicitly allowed)
            if (f3Rows.length > 0 || allowEmptyForm3) {
                await supabase.from('annex_form_3').delete().match({ academic_year: academicYear, semester: semester });
                if (f3Rows.length > 0) {
                    const batchSize = 100;
                    for (let i = 0; i < f3Rows.length; i += batchSize) {
                        const chunk = f3Rows.slice(i, i + batchSize);
                        const { error: errF3 } = await supabase.from('annex_form_3').insert(chunk);
                        if (errF3) {
                            console.error('AnnexSyncService: Error inserting to annex_form_3:', errF3);
                            throw errF3;
                        }
                    }
                }
            }

            console.log(`AnnexSyncService: Saved ${f2Rows.length} Form 2 rows and ${f3Rows.length} Form 3 rows to Supabase.`);
            return {
                success: true,
                f2Count: f2Rows.length,
                f3Count: f3Rows.length
            };
        } catch (err) {
            console.error('AnnexSyncService.saveToSupabase error:', err);
            return { success: false, error: err.message };
        } finally {
            this.isSavingToDb = false;
        }
    }

    /**
     * Loads verified Form 2 and Form 3 records from Supabase database strictly isolated by term.
     */
    static async loadFromSupabase({
        academicYear = '2026-2027',
        semester = '1st Semester',
        fallbackToLatest = false
    } = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) return null;

        try {
            let qF2 = supabase.from('annex_form_2').select('*').order('control_number', { ascending: true });
            let qF3 = supabase.from('annex_form_3').select('*').order('control_number', { ascending: true });

            if (academicYear && academicYear !== 'All') {
                qF2 = qF2.eq('academic_year', academicYear);
                qF3 = qF3.eq('academic_year', academicYear);
            }
            if (semester && semester !== 'All') {
                qF2 = qF2.eq('semester', semester);
                qF3 = qF3.eq('semester', semester);
            }

            let { data: f2Data, error: errF2 } = await qF2;
            let { data: f3Data, error: errF3 } = await qF3;

            // Only fallback to other terms if explicitly requested and no specific term was selected
            if (fallbackToLatest && (!academicYear || academicYear === 'All') && (!semester || semester === 'All') && (!f2Data || f2Data.length === 0) && (!f3Data || f3Data.length === 0)) {
                const resF2 = await supabase.from('annex_form_2').select('*').order('control_number', { ascending: true });
                const resF3 = await supabase.from('annex_form_3').select('*').order('control_number', { ascending: true });
                if (resF2.data && resF2.data.length > 0) f2Data = resF2.data;
                if (resF3.data && resF3.data.length > 0) f3Data = resF3.data;
            }

            if (!errF2 && !errF3) {
                // Enrich with submitted SA numbers from student_grantees
                const studentGranteesMap = new Map();
                try {
                    const { data: sgData } = await supabase
                        .from('student_grantees')
                        .select('id, uid, student_no, studentId, full_name, fullName, sa_number, saNumber, documents, familyDetails');
                    if (sgData && sgData.length > 0) {
                        sgData.forEach(sg => {
                            const sNo = String(sg.student_no || sg.studentId || '').trim();
                            const sName = String(sg.full_name || sg.fullName || '').trim().toLowerCase();
                            if (sNo) studentGranteesMap.set(sNo, sg);
                            if (sName) studentGranteesMap.set(sName, sg);
                            if (sName.includes(',')) {
                                const [l, rest] = sName.split(',').map(p => p.trim());
                                const f = (rest || '').split(/\s+/)[0] || '';
                                if (l && f) studentGranteesMap.set(`${l}|${f}`, sg);
                            }
                        });
                    }
                } catch (errSg) {
                    console.warn('AnnexSyncService.loadFromSupabase: Could not fetch student_grantees for enrichment:', errSg);
                }

                const resolveSa = (row) => {
                    const sNo = String(row.student_number || '').trim();
                    const sName = `${row.last_name || ''}, ${row.given_name || ''} ${row.middle_initial || ''}`.trim().toLowerCase();
                    const firstWord = String(row.given_name || '').trim().toLowerCase().split(/\s+/)[0] || '';
                    const nShortKey = `${String(row.last_name || '').trim().toLowerCase()}|${firstWord}`;
                    const sg = studentGranteesMap.get(sNo) || studentGranteesMap.get(sName) || studentGranteesMap.get(nShortKey);
                    if (sg) {
                        return AnnexSyncService.extractAuthenticSaNumber(sg);
                    }
                    return AnnexSyncService.extractAuthenticSaNumber(row.tes_application_number);
                };

                const form2List = (f2Data || []).map(row => {
                    const saNum = resolveSa(row);
                    return {
                        classification: 'MATCHED_FORM2',
                        isEnrolled: true,
                        academic_year: row.academic_year,
                        semester: row.semester,
                        grantee: {
                            id: row.id,
                            student_id: row.student_number,
                            name: `${row.last_name}, ${row.given_name} ${row.middle_initial || ''}`.trim(),
                            last_name: row.last_name,
                            first_name: row.given_name,
                            middle_name: row.middle_initial,
                            course: row.degree_program,
                            year: row.year_level,
                            batch: row.tes_batch,
                            saNumber: saNum,
                            sa_number: saNum,
                            academic_year: row.academic_year,
                            semester: row.semester
                        },
                        matchedStudent: {
                            studentId: row.student_number,
                            fullName: `${row.last_name}, ${row.given_name} ${row.middle_initial || ''}`.trim(),
                            lastName: row.last_name,
                            firstName: row.given_name,
                            mi: row.middle_initial,
                            gender: row.sex_at_birth,
                            birthdate: row.birthdate,
                            course: row.degree_program,
                            year: row.year_level,
                            email: row.email_address,
                            phone: row.phone_number,
                            saNumber: saNum,
                            sa_number: saNum,
                            academic_year: row.academic_year,
                            semester: row.semester
                        }
                    };
                });

                const form3List = (f3Data || []).map(row => {
                    const saNum = resolveSa(row);
                    return {
                        classification: 'INACTIVE_FORM3',
                        isEnrolled: false,
                        specialStatusReason: row.status,
                        remarks: row.remarks,
                        academic_year: row.academic_year,
                        semester: row.semester,
                        grantee: {
                            id: row.id,
                            student_id: row.student_number,
                            name: `${row.last_name}, ${row.given_name} ${row.middle_initial || ''}`.trim(),
                            last_name: row.last_name,
                            first_name: row.given_name,
                            middle_name: row.middle_initial,
                            course: row.degree_program,
                            year: row.year_level,
                            saNumber: saNum,
                            sa_number: saNum,
                            academic_year: row.academic_year,
                            semester: row.semester
                        },
                        matchedStudent: {
                            studentId: row.student_number,
                            fullName: `${row.last_name}, ${row.given_name} ${row.middle_initial || ''}`.trim(),
                            lastName: row.last_name,
                            firstName: row.given_name,
                            mi: row.middle_initial,
                            gender: row.sex_at_birth,
                            birthdate: row.birthdate,
                            course: row.degree_program,
                            year: row.year_level,
                            saNumber: saNum,
                            sa_number: saNum,
                            academic_year: row.academic_year,
                            semester: row.semester
                        }
                    };
                });

                const deduplicated = this.deduplicateLists(form2List, form3List, []);
                if (form2List.length > deduplicated.form2List.length) {
                    const keptF2Ids = new Set(deduplicated.form2List.map(i => i.grantee?.id).filter(Boolean));
                    const dupF2Ids = form2List.map(i => i.grantee?.id).filter(id => id && !keptF2Ids.has(id));
                    if (dupF2Ids.length > 0) {
                        supabase.from('annex_form_2').delete().in('id', dupF2Ids).then(() => { }).catch(() => { });
                    }
                }
                return {
                    form2List: deduplicated.form2List,
                    form3List: deduplicated.form3List,
                    needsReviewList: [],
                    fromDb: true
                };
            }
            return null;
        } catch (e) {
            console.warn('AnnexSyncService.loadFromSupabase error:', e);
            return null;
        }
    }

    /**
     * Subscribes to live synchronization updates across tabs, windows, and views.
     * @param {Function} callback Called with the updated verified data payload.
     * @returns {Function} Unsubscribe function to remove listeners.
     */
    static onSync(callback) {
        if (typeof callback !== 'function') return () => { };

        // 1. In-window custom event listener
        const handleCustomEvent = (e) => {
            if (e.detail) callback(e.detail);
        };
        window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

        // 2. Storage event listener (cross-tab fallback)
        const handleStorageEvent = (e) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    callback(parsed);
                } catch (err) {
                    console.warn('Storage event parse error:', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageEvent);

        // 3. BroadcastChannel listener (instant cross-tab)
        let handleBroadcast = null;
        if (broadcastChannel) {
            handleBroadcast = (event) => {
                if (event.data && event.data.type === 'SYNC_UPDATE' && event.data.payload) {
                    callback(event.data.payload);
                }
            };
            broadcastChannel.addEventListener('message', handleBroadcast);
        }

        // Return cleanup function
        return () => {
            window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
            window.removeEventListener('storage', handleStorageEvent);
            if (broadcastChannel && handleBroadcast) {
                broadcastChannel.removeEventListener('message', handleBroadcast);
            }
        };
    }

    /**
     * Clears verified sync data from local storage and optionally from Supabase for a given term.
     */
    static async clearVerifiedData({ clearSupabase = false, academicYear, semester } = {}) {
        try {
            if (academicYear && semester && academicYear !== 'All' && semester !== 'All') {
                localStorage.removeItem(this.getStorageKey(academicYear, semester));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
            const payload = {
                timestamp: Date.now(),
                updatedBy: 'System',
                academicYear: academicYear,
                semester: semester,
                totalCount: 0,
                form2Count: 0,
                form3Count: 0,
                reviewCount: 0,
                form2List: [],
                form3List: [],
                needsReviewList: []
            };
            if (broadcastChannel) {
                broadcastChannel.postMessage({ type: 'SYNC_UPDATE', payload });
            }
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));

            if (clearSupabase && window.supabaseClient) {
                if (academicYear && semester && academicYear !== 'All' && semester !== 'All') {
                    await window.supabaseClient.from('annex_form_2').delete().match({ academic_year: academicYear, semester: semester });
                    await window.supabaseClient.from('annex_form_3').delete().match({ academic_year: academicYear, semester: semester });
                } else {
                    await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    await window.supabaseClient.from('annex_form_3').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                }
            }
        } catch (e) {
            console.error('Error clearing sync data:', e);
        }
    }
}
