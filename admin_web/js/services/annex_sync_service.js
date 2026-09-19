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
    /**
     * Extracts a stable, unique key for a grantee or verification item.
     */
    static getUniqueKey(item) {
        if (!item) return '';
        const g = item.grantee || item;
        const s = item.matchedStudent || {};

        // 1. Primary: Student ID / No. (if valid and not 'N/A' or empty)
        const studentId = String(s.studentId || s.studentNo || g.student_id || g.studentId || g.studentNo || '').trim().toLowerCase();
        if (studentId && studentId !== 'n/a' && studentId !== 'unassigned') {
            return `id_${studentId.replace(/[^a-z0-9]/g, '')}`;
        }

        // 2. Secondary: Normalized Name (Last + First + Middle)
        const lName = (g.last_name || g.lastName || s.lastName || s.last_name || '').trim().toLowerCase();
        const fName = (g.first_name || g.firstName || s.firstName || s.first_name || '').trim().toLowerCase();
        const mName = (g.middle_name || g.middleName || s.mi || s.middleInitial || '').trim().toLowerCase();

        const combined = `${lName}_${fName}_${mName}`.replace(/[^a-z0-9]/g, '');
        if (combined) return `name_${combined}`;

        const rawName = (g.name || g.fullName || s.fullName || s.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (rawName) return `raw_${rawName}`;

        if (g.id) return `uuid_${String(g.id)}`;
        return Math.random().toString(36).substring(2, 9);
    }

    /**
     * Helper to reliably extract and normalize name parts.
     */
    static parseNameParts(item) {
        const grantee = item.grantee || {};
        const student = item.matchedStudent || {};

        if (typeof VerificationService !== 'undefined' && VerificationService.normalizeName) {
            const norm = VerificationService.normalizeName(student.fullName || grantee.name || '');
            if (norm.lastName || norm.firstName) {
                return norm;
            }
        }

        let lastName = student.lastName || grantee.last_name || '';
        let firstName = student.firstName || grantee.first_name || '';
        let mi = student.mi || student.middleInitial || grantee.middle_name || '';

        if (!lastName || !firstName) {
            const raw = String(student.fullName || student.name || grantee.name || '').trim();
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
        return { lastName, firstName, mi };
    }

    /**
     * Strictly deduplicates records across Form 2, Form 3, and Needs Review Queue.
     * Prevents any record from appearing in multiple lists simultaneously.
     */
    static deduplicateLists(form2List = [], form3List = [], needsReviewList = []) {
        const seenKeys = new Set();
        const cleanForm2 = [];
        const cleanForm3 = [];
        const cleanReview = [];

        // 1. Form 2: Included / Enrolled Grantees
        for (const item of (form2List || [])) {
            const key = this.getUniqueKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                const itemCopy = { ...item };
                itemCopy.classification = 'MATCHED_FORM2';
                itemCopy.isEnrolled = true;
                cleanForm2.push(itemCopy);
            }
        }

        // 2. Form 3: Not Included Grantees (Special statuses: Not enrolled, Dropped, Waived, LOA, Transferee, Graduated)
        for (const item of (form3List || [])) {
            const key = this.getUniqueKey(item);
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                const itemCopy = { ...item };
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
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
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
    static saveVerifiedData({ form2List, form3List, needsReviewList, updatedBy = 'Admin', syncToDb = true }) {
        try {
            const deduplicated = this.deduplicateLists(form2List, form3List, needsReviewList);
            const totalCount = deduplicated.form2List.length + deduplicated.form3List.length + deduplicated.needsReviewList.length;

            const payload = {
                timestamp: Date.now(),
                updatedBy: updatedBy,
                totalCount: totalCount,
                form2Count: deduplicated.form2List.length,
                form3Count: deduplicated.form3List.length,
                reviewCount: deduplicated.needsReviewList.length,
                form2List: deduplicated.form2List,
                form3List: deduplicated.form3List,
                needsReviewList: deduplicated.needsReviewList
            };

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

            // Automatically sync to Supabase in the background
            if (syncToDb && (deduplicated.form2List.length > 0 || deduplicated.form3List.length > 0)) {
                this.saveToSupabase({
                    form2List: deduplicated.form2List,
                    form3List: deduplicated.form3List
                }).catch(err => console.warn('Background Supabase auto-sync error:', err));
            }

            return payload;
        } catch (e) {
            console.error('Error saving Annex 5 verified sync data:', e);
            return null;
        }
    }

    /**
     * Retrieves the latest verified data from storage.
     */
    static getVerifiedData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.form2List)) return null;

            // Ensure deduplication on read
            const deduplicated = this.deduplicateLists(
                parsed.form2List || [],
                parsed.form3List || [],
                parsed.needsReviewList || []
            );

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
     */
    static async saveToSupabase({
        form2List = [],
        form3List = [],
        academicYear = '2024-2025',
        semester = '1st Semester',
        heiName = 'USTP Oroquieta',
        heiCampus = 'Oroquieta Campus'
    } = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) {
            console.warn('AnnexSyncService.saveToSupabase: Supabase client is not available.');
            return { success: false, error: 'Supabase client not available' };
        }

        try {
            // 1. Prepare Form 2 Rows (Enrolled Grantees)
            const f2Rows = (form2List || []).map((item, idx) => {
                const ctrl = String(idx + 1).padStart(5, '0');
                const grantee = item.grantee || {};
                const student = item.matchedStudent || {};
                const name = this.parseNameParts(item);

                const studentNo = student.studentId || student.studentNo || grantee.student_id || grantee.studentNo || null;
                const saNo = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || grantee.sa_number || 'N/A';
                const gender = (student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
                const bdate = student.birthdate || student.dateOfBirth || student.birthday || '01/01/2000';
                const degree = student.course || student.programName || grantee.course || 'BSIT';
                const yr = String(student.year || student.yearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
                const email = student.email || student.emailAddress || 'N/A';
                const phone = student.contactNumber || student.phone || student.mobileNumber || 'N/A';
                const batch = String(grantee.batch || '1').replace(/[^0-9]/g, '') || '1';

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
                const saNo = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || grantee.sa_number || 'N/A';
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

            // 3. Sync Form 2 to Supabase: always clear previous for this AY/Sem, and insert new if any
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

            // 4. Sync Form 3 to Supabase: always clear previous for this AY/Sem, and insert new if any
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

            console.log(`AnnexSyncService: Saved ${f2Rows.length} Form 2 rows and ${f3Rows.length} Form 3 rows to Supabase.`);
            return {
                success: true,
                f2Count: f2Rows.length,
                f3Count: f3Rows.length
            };
        } catch (err) {
            console.error('AnnexSyncService.saveToSupabase error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Loads verified Form 2 and Form 3 records from Supabase database.
     */
    static async loadFromSupabase({
        academicYear = '2024-2025',
        semester = '1st Semester',
        fallbackToLatest = true
    } = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) return null;

        try {
            let { data: f2Data, error: errF2 } = await supabase
                .from('annex_form_2')
                .select('*')
                .eq('academic_year', academicYear)
                .eq('semester', semester)
                .order('control_number', { ascending: true });

            let { data: f3Data, error: errF3 } = await supabase
                .from('annex_form_3')
                .select('*')
                .eq('academic_year', academicYear)
                .eq('semester', semester)
                .order('control_number', { ascending: true });

            // Fallback: If no records found for specified AY/Sem, check if any records exist in annex_form_2 / annex_form_3
            if (fallbackToLatest && (!f2Data || f2Data.length === 0) && (!f3Data || f3Data.length === 0)) {
                const resF2 = await supabase.from('annex_form_2').select('*').order('control_number', { ascending: true });
                const resF3 = await supabase.from('annex_form_3').select('*').order('control_number', { ascending: true });
                if (resF2.data && resF2.data.length > 0) f2Data = resF2.data;
                if (resF3.data && resF3.data.length > 0) f3Data = resF3.data;
            }

            if (!errF2 && !errF3) {
                const form2List = (f2Data || []).map(row => ({
                    classification: 'MATCHED_FORM2',
                    isEnrolled: true,
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
                        saNumber: row.tes_application_number
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
                        saNumber: row.tes_application_number
                    }
                }));

                const form3List = (f3Data || []).map(row => ({
                    classification: 'INACTIVE_FORM3',
                    isEnrolled: false,
                    specialStatusReason: row.status,
                    remarks: row.remarks,
                    grantee: {
                        id: row.id,
                        student_id: row.student_number,
                        name: `${row.last_name}, ${row.given_name} ${row.middle_initial || ''}`.trim(),
                        last_name: row.last_name,
                        first_name: row.given_name,
                        middle_name: row.middle_initial,
                        course: row.degree_program,
                        year: row.year_level,
                        saNumber: row.tes_application_number
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
                        saNumber: row.tes_application_number
                    }
                }));

                return {
                    form2List,
                    form3List,
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
     * Clears all verified sync data from local storage and optionally from Supabase.
     */
    static async clearVerifiedData({ clearSupabase = false } = {}) {
        try {
            localStorage.removeItem(STORAGE_KEY);
            const payload = {
                timestamp: Date.now(),
                updatedBy: 'System',
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
                await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await window.supabaseClient.from('annex_form_3').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            }
        } catch (e) {
            console.error('Error clearing sync data:', e);
        }
    }
}
