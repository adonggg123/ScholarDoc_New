// js/views/annex5_generator.js
import { BillingService } from '../services/billing_service.js';
import { VerificationService } from '../services/verification_service.js';
import { AnnexSyncService } from '../services/annex_sync_service.js';
import { AdminNotificationService } from '../services/admin_notification_service.js';
import { AcademicYearService } from '../services/academic_year_service.js';

const supabase = window.supabaseClient;

function splitFullName(raw) {
    if (!raw) return { firstName: '', middleName: '', lastName: '' };
    let str = String(raw).trim();
    if (!str) return { firstName: '', middleName: '', lastName: '' };

    const suffixes = new Set(['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'V', 'VI']);
    const surnamePrefixes = new Set(['DE', 'DEL', 'DELA', 'DELOS', 'SAN', 'STA', 'STA.', 'SANTA', 'VAN', 'VON', 'AL']);

    if (str.includes(',')) {
        const commaParts = str.split(',');
        const lastPart = commaParts[0].trim();
        const rest = commaParts.slice(1).join(',').trim();
        const tokens = rest.split(/\s+/).filter(Boolean);
        
        let first = '';
        let middle = '';

        if (tokens.length === 0) {
            return { firstName: '', middleName: '', lastName: lastPart };
        } else if (tokens.length === 1) {
            first = tokens[0];
        } else {
            const lastToken = tokens[tokens.length - 1];
            if (suffixes.has(lastToken.toUpperCase())) {
                const suff = tokens.pop();
                if (tokens.length > 1) {
                    middle = tokens.pop();
                    first = tokens.join(' ');
                } else {
                    first = tokens.join(' ');
                }
                return { firstName: first, middleName: middle, lastName: `${lastPart} ${suff}` };
            } else {
                middle = tokens.pop();
                first = tokens.join(' ');
            }
        }
        return { firstName: first, middleName: middle, lastName: lastPart };
    }

    // Space-separated
    let tokens = str.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { firstName: '', middleName: '', lastName: '' };

    let suffix = '';
    if (tokens.length > 1 && suffixes.has(tokens[tokens.length - 1].toUpperCase())) {
        suffix = tokens.pop();
    }

    if (tokens.length === 1) {
        return { firstName: tokens[0], middleName: '', lastName: suffix ? suffix : '' };
    }
    if (tokens.length === 2) {
        const ln = suffix ? `${tokens[1]} ${suffix}` : tokens[1];
        return { firstName: tokens[0], middleName: '', lastName: ln };
    }

    let lastName = '';
    let middleName = '';
    let firstName = '';

    // Check if compound prefix like 'DE LA CRUZ' (3 tokens)
    if (tokens.length >= 4 && (tokens[tokens.length - 3].toUpperCase() === 'DE' && (tokens[tokens.length - 2].toUpperCase() === 'LA' || tokens[tokens.length - 2].toUpperCase() === 'LOS'))) {
        lastName = tokens.slice(tokens.length - 3).join(' ');
        tokens = tokens.slice(0, tokens.length - 3);
        if (tokens.length > 1) {
            middleName = tokens.pop();
            firstName = tokens.join(' ');
        } else {
            firstName = tokens[0] || '';
        }
    } else if (tokens.length >= 3 && surnamePrefixes.has(tokens[tokens.length - 2].toUpperCase())) {
        lastName = tokens.slice(tokens.length - 2).join(' ');
        tokens = tokens.slice(0, tokens.length - 2);
        if (tokens.length > 1) {
            middleName = tokens.pop();
            firstName = tokens.join(' ');
        } else {
            firstName = tokens[0] || '';
        }
    } else {
        lastName = tokens.pop();
        middleName = tokens.pop();
        firstName = tokens.join(' ');
    }

    if (suffix) {
        lastName = `${lastName} ${suffix}`.trim();
    }

    return { firstName, middleName, lastName };
}

function getCachedGranteeBatch(record) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_batches') || '{}');
        if (record && record.id && cache[record.id]) return cache[record.id];
        const sNo = record?.studentId || record?.student_id || record?.student_no || record?.studentNo;
        if (sNo && cache[String(sNo).trim()]) return cache[String(sNo).trim()];
        const ln = (record?.lastName || record?.last_name || '').toLowerCase().trim();
        const fn = (record?.firstName || record?.first_name || '').toLowerCase().trim();
        const mn = (record?.middleName || record?.middle_name || '').toLowerCase().trim();
        const normKey = `${ln}|${fn}|${mn}`.replace(/[^a-z0-9|]/g, '');
        if (normKey && cache[normKey]) return cache[normKey];
        const rawName = (record?.name || `${ln}, ${fn} ${mn}`).trim().toLowerCase();
        if (rawName && cache[rawName]) return cache[rawName];
    } catch (_) {}
    return null;
}

function resolveGranteeBatch(record) {
    let rawB = record?.batch || record?.tes_batch || (record?.documents && record?.documents.batch) || getCachedGranteeBatch(record) || 'Batch 1.2';
    rawB = String(rawB).trim();
    if (rawB === '1' || rawB.toLowerCase() === 'batch 1') {
        return 'Batch 1.1';
    }
    if (!rawB.toLowerCase().startsWith('batch')) {
        return `Batch ${rawB}`;
    }
    return rawB;
}

// State
const initialRegistrarTerm = AcademicYearService.getDefaultTerm();
let selectedAcademicYear = initialRegistrarTerm.academicYear || '2026-2027';
let selectedSemester = initialRegistrarTerm.semester || '1st Semester';
let isPopulatingRegistrarTerms = false;

// DOM Elements for School Student Records Target Academic Period
let selectSchoolAy = null;
let customSchoolAyContainer = null;
let customSchoolAyInput = null;
let selectSchoolSem = null;
let customSchoolSemContainer = null;
let customSchoolSemInput = null;
let schoolTermSelectBox = null;
let schoolTermValidationHint = null;

// ── Target Term Helpers & Validation for School Student Records Upload ──
function getSelectedSchoolUploadTerm() {
    if (!selectSchoolAy) {
        selectSchoolAy = document.getElementById('select-school-ay');
        customSchoolAyContainer = document.getElementById('custom-school-ay-container');
        customSchoolAyInput = document.getElementById('custom-school-ay-input');
        selectSchoolSem = document.getElementById('select-school-sem');
        customSchoolSemContainer = document.getElementById('custom-school-sem-container');
        customSchoolSemInput = document.getElementById('custom-school-sem-input');
        schoolTermSelectBox = document.getElementById('school-term-selection-container');
        schoolTermValidationHint = document.getElementById('school-term-validation-hint');
    }

    if (!selectSchoolAy || !selectSchoolSem) {
        return { academicYear: selectedAcademicYear, semester: selectedSemester };
    }

    const ayVal = selectSchoolAy.value;
    let chosenAy = '';
    if (ayVal === 'custom') {
        chosenAy = customSchoolAyInput ? customSchoolAyInput.value.trim() : '';
    } else if (ayVal && ayVal !== 'All') {
        chosenAy = ayVal.trim();
    }

    const semVal = selectSchoolSem.value;
    let chosenSem = '';
    if (semVal === 'custom') {
        chosenSem = customSchoolSemInput ? customSchoolSemInput.value.trim() : '';
    } else if (semVal && semVal !== 'All') {
        chosenSem = semVal.trim();
    }

    if (!chosenAy || !chosenSem) {
        showSchoolTermError(!chosenAy ? 'ay' : 'sem');
        return null;
    }

    clearSchoolTermError();

    // Auto-register custom entries if any
    if (ayVal === 'custom' && chosenAy) {
        AcademicYearService.addCustomAcademicYear(chosenAy);
    }
    if (semVal === 'custom' && chosenSem) {
        AcademicYearService.addCustomSemester(chosenSem);
    }

    // Save chosen values as system defaults
    AcademicYearService.setDefaultTerm(chosenAy, chosenSem);

    selectedAcademicYear = chosenAy;
    selectedSemester = chosenSem;

    // Synchronize top filter dropdowns and active term label
    const topAy = document.getElementById('admin-filter-ay');
    if (topAy && topAy.value !== chosenAy) topAy.value = chosenAy;
    const topSem = document.getElementById('admin-filter-sem');
    if (topSem && topSem.value !== chosenSem) topSem.value = chosenSem;
    updateRegistrarActiveTermLabel();

    return { academicYear: chosenAy, semester: chosenSem };
}

function showSchoolTermError(missingField = 'ay') {
    if (!schoolTermSelectBox) schoolTermSelectBox = document.getElementById('school-term-selection-container');
    if (!schoolTermValidationHint) schoolTermValidationHint = document.getElementById('school-term-validation-hint');
    if (schoolTermSelectBox) schoolTermSelectBox.classList.add('error-state');
    if (schoolTermValidationHint) schoolTermValidationHint.classList.remove('hidden');

    if (missingField === 'ay') {
        if (selectSchoolAy && selectSchoolAy.value === 'custom' && customSchoolAyInput) {
            customSchoolAyInput.focus();
        } else if (selectSchoolAy) {
            selectSchoolAy.focus();
        }
    } else {
        if (selectSchoolSem && selectSchoolSem.value === 'custom' && customSchoolSemInput) {
            customSchoolSemInput.focus();
        } else if (selectSchoolSem) {
            selectSchoolSem.focus();
        }
    }

    if (typeof showToast === 'function') {
        showToast('Please select or enter an Academic Year and Semester before uploading school student records.', 'alert-triangle');
    }
}

function clearSchoolTermError() {
    if (!schoolTermSelectBox) schoolTermSelectBox = document.getElementById('school-term-selection-container');
    if (!schoolTermValidationHint) schoolTermValidationHint = document.getElementById('school-term-validation-hint');
    if (schoolTermSelectBox) schoolTermSelectBox.classList.remove('error-state');
    if (schoolTermValidationHint) schoolTermValidationHint.classList.add('hidden');
}

let rawSuperAdminGrantees = [];
let rawSchoolStudents = [];
let uploadedSchoolFile = null;

let selectedSchoolStudentIds = new Set();
let isSchoolTableExpanded = false;

let verifiedForm2List = [];
let verifiedForm3List = [];
let needsReviewList = [];

let activeResolutionItem = null;
let activeResolutionSource = null;
let activeResolutionItemKey = null;
let dbRealtimeChannel = null;
let isImportingSchoolStudents = false;

// Helper: Paginated fetch for all school_students records without 1000 limit cap
async function fetchAllSchoolStudents() {
    let all = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        try {
            const { data, error } = await supabase
                .from('school_students')
                .select('*')
                .order('student_no', { ascending: true })
                .range(from, to);
            if (error || !data || data.length === 0) {
                hasMore = false;
            } else {
                all = all.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch (e) {
            console.warn('Error fetching paginated school_students:', e);
            hasMore = false;
        }
    }
    return all;
}

// Helper to map school_students records
function mapSchoolStudentRecord(s, studentProfileMap = new Map()) {
    const sNo = String(s.student_no || s.studentNo || s.studentId || s.student_id || '').trim();
    const sName = String(s.full_name || s.fullName || s.name || '').trim().toLowerCase();
    const matchedSt = studentProfileMap.get(sNo) || studentProfileMap.get(sName);
    const scholarship = s.scholarship_name || s.scholarship || (matchedSt ? (matchedSt.scholarship_name || matchedSt.scholarshipProgram || matchedSt.scholarshipName) : null) || 'TES';

    const rawDob = s.date_of_birth || s.dateOfBirth || s.birthdate || s.dob || s.birthday || '';
    const formattedDob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : '';
    let ageVal = s.age;
    if (!ageVal || ageVal === 'N/A' || isNaN(ageVal)) {
        ageVal = formattedDob ? calculateAge(formattedDob) : '';
    }

    const family = s.familyDetails || {};
    const fatherFullName = (s.father_full_name || s.fatherFullName || s.fatherName || family.fatherFullName || family.fatherName || '').trim();
    const fatherOccupation = (s.father_occupation || s.fatherOccupation || s.fatherEduStatus || family.fatherOccupation || family.fatherEduStatus || '').trim();
    const motherFullName = (s.mother_full_name || s.motherFullName || s.motherName || family.motherFullName || family.motherName || '').trim();
    const motherOccupation = (s.mother_occupation || s.motherOccupation || s.motherEduStatus || family.motherOccupation || family.motherEduStatus || '').trim();

    // Extract authentic student-submitted SA number ('N/A' by default until submitted by student)
    const resolvedSa = matchedSt ? AnnexSyncService.extractAuthenticSaNumber(matchedSt) : 'N/A';

    const resolvedFullName = s.full_name || s.fullName || s.name || (s.last_name || s.first_name ? [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ') : '');
    const resolvedProgram = s.program_name || s.programName || s.course || s.program || '';
    const resolvedYear = s.year_level || s.yearLevel || s.year || '';
    const resolvedCivilStatus = (s.civil_status || s.civilStatus || family.civilStatus || '').trim() || 'Single';
    const resolvedReligion = (s.religion || family.religion || '').trim();
    const resolvedMobile = (s.mobile_number || s.mobileNumber || s.phone || s.contactNumber || '').trim();
    const resolvedEmail = (s.email_address || s.emailAddress || s.email || s.authEmail || '').trim();

    return {
        id: s.id,
        uid: s.student_no || s.studentNo || s.studentId || s.student_id || s.id || Math.random().toString(36).substring(2),
        studentNo: sNo,
        studentId: sNo,
        saNumber: resolvedSa,
        sa_number: resolvedSa,
        tes_application_number: resolvedSa,
        fullName: resolvedFullName,
        name: resolvedFullName,
        first_name: s.first_name || s.firstName || '',
        last_name: s.last_name || s.lastName || '',
        middle_name: s.middle_name || s.middleName || '',
        programName: resolvedProgram,
        course: resolvedProgram,
        yearLevel: resolvedYear,
        year: resolvedYear,
        dateOfBirth: formattedDob || rawDob,
        birthdate: formattedDob || rawDob,
        dob: formattedDob || rawDob,
        age: ageVal,
        gender: (s.gender || s.sex || '').trim(),
        civilStatus: resolvedCivilStatus,
        maritalStatus: resolvedCivilStatus,
        religion: resolvedReligion,
        mobileNumber: resolvedMobile,
        phone: resolvedMobile,
        contactNumber: resolvedMobile,
        emailAddress: resolvedEmail,
        email: resolvedEmail,
        authEmail: resolvedEmail,
        fatherFullName: fatherFullName,
        fatherName: fatherFullName,
        fatherOccupation: fatherOccupation,
        fatherEduStatus: fatherOccupation,
        motherFullName: motherFullName,
        motherName: motherFullName,
        motherOccupation: motherOccupation,
        motherEduStatus: motherOccupation,
        familyDetails: {
            fatherFullName: fatherFullName,
            fatherName: fatherFullName,
            fatherOccupation: fatherOccupation,
            fatherEduStatus: fatherOccupation,
            motherFullName: motherFullName,
            motherName: motherFullName,
            motherOccupation: motherOccupation,
            motherEduStatus: motherOccupation,
            religion: resolvedReligion,
            civilStatus: resolvedCivilStatus
        },
        scholarship: scholarship,
        scholarshipName: scholarship,
        status: (matchedSt && matchedSt.status) || s.status || 'Enrolled'
    };
}

// ── IndexedDB & Storage Helpers for School Student Records ──────────────
const SCHOOL_DB_NAME = 'ScholarDocSchoolDB';
const SCHOOL_DB_VERSION = 1;
const SCHOOL_STORE_NAME = 'school_term_records';

function openSchoolDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }
        try {
            const req = indexedDB.open(SCHOOL_DB_NAME, SCHOOL_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(SCHOOL_STORE_NAME)) {
                    db.createObjectStore(SCHOOL_STORE_NAME, { keyPath: 'termKey' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
        } catch (_) {
            resolve(null);
        }
    });
}

async function idbSaveSchoolTermRecords(termKey, records) {
    if (!termKey || !records || records.length === 0) return false;
    try {
        const db = await openSchoolDB();
        if (!db) return false;
        return new Promise((resolve) => {
            const tx = db.transaction(SCHOOL_STORE_NAME, 'readwrite');
            const store = tx.objectStore(SCHOOL_STORE_NAME);
            store.put({ termKey, records, count: records.length, updatedAt: new Date().toISOString() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (_) {
        return false;
    }
}

async function idbGetSchoolTermRecords(termKey) {
    if (!termKey) return null;
    try {
        const db = await openSchoolDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(SCHOOL_STORE_NAME, 'readonly');
            const store = tx.objectStore(SCHOOL_STORE_NAME);
            const req = store.get(termKey);
            req.onsuccess = () => resolve(req.result ? req.result.records : null);
            req.onerror = () => resolve(null);
        });
    } catch (_) {
        return null;
    }
}

async function idbDeleteSchoolTermRecords(termKey) {
    if (!termKey) return false;
    try {
        const db = await openSchoolDB();
        if (!db) return false;
        return new Promise((resolve) => {
            const tx = db.transaction(SCHOOL_STORE_NAME, 'readwrite');
            const store = tx.objectStore(SCHOOL_STORE_NAME);
            store.delete(termKey);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (_) {
        return false;
    }
}

async function idbClearAllSchoolTermRecords() {
    try {
        const db = await openSchoolDB();
        if (!db) return false;
        return new Promise((resolve) => {
            const tx = db.transaction(SCHOOL_STORE_NAME, 'readwrite');
            const store = tx.objectStore(SCHOOL_STORE_NAME);
            store.clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (_) {
        return false;
    }
}

function getSchoolTermStudentsMap() {
    try {
        return JSON.parse(localStorage.getItem('scholardoc_school_term_students') || '{}');
    } catch (_) {
        return {};
    }
}

function getSchoolTermsRegistry() {
    try {
        return JSON.parse(localStorage.getItem('scholardoc_school_terms_registry') || '{}');
    } catch (_) {
        return {};
    }
}

// Reconcile local term caches with authoritative Supabase state so deleted or un-uploaded terms stay empty
async function autoHealSchoolStudentTerms(allDbStudents) {
    try {
        if (!allDbStudents || allDbStudents.length === 0) {
            localStorage.removeItem('scholardoc_school_term_students');
            localStorage.removeItem('scholardoc_school_terms_registry');
            localStorage.removeItem('scholardoc_school_student_terms');
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('scholardoc_school_records_')) {
                    try { localStorage.removeItem(k); } catch (_) { }
                }
            });
            await idbClearAllSchoolTermRecords();
            return;
        }

        const termMap = getSchoolTermStudentsMap();
        const registry = getSchoolTermsRegistry();

        let minCreatedMs = Infinity;
        allDbStudents.forEach(s => {
            if (s.created_at) {
                const ms = new Date(s.created_at).getTime();
                if (!isNaN(ms) && ms < minCreatedMs) minCreatedMs = ms;
            }
        });
        if (!isFinite(minCreatedMs)) minCreatedMs = 0;
        else minCreatedMs = Math.max(0, minCreatedMs - 60000);

        const validLoggedTerms = new Set();
        let fetchedLogsOk = false;

        try {
            const { data: logs, error: logErr } = await supabase
                .from('audit_logs')
                .select('action, timestamp')
                .ilike('action', '%school_students database%')
                .order('timestamp', { ascending: false })
                .limit(50);
            if (!logErr && Array.isArray(logs)) {
                fetchedLogsOk = true;
                logs.forEach(l => {
                    const ts = l.timestamp ? new Date(l.timestamp).getTime() : Infinity;
                    if (ts >= minCreatedMs) {
                        const m = String(l.action || '').match(/\(([^•\)]+)\s*•\s*([^\)]+)\)/);
                        if (m) {
                            validLoggedTerms.add(`${m[1].trim()}_${m[2].trim()}`);
                        }
                    }
                });
            }
        } catch (_) { }

        try {
            const { data: notifs, error: notifErr } = await supabase
                .from('notifications')
                .select('title, message, timestamp')
                .ilike('message', '%school student records (%')
                .order('timestamp', { ascending: false })
                .limit(50);
            if (!notifErr && Array.isArray(notifs)) {
                fetchedLogsOk = true;
                notifs.forEach(n => {
                    const ts = n.timestamp ? new Date(n.timestamp).getTime() : Infinity;
                    if (ts >= minCreatedMs) {
                        const m = String(n.message || '').match(/\(([^•\)]+)\s*•\s*([^\)]+)\)/);
                        if (m) {
                            validLoggedTerms.add(`${m[1].trim()}_${m[2].trim()}`);
                        }
                    }
                });
            }
        } catch (_) { }

        Object.entries(registry).forEach(([tKey, meta]) => {
            if (meta && meta.explicitlyUploadedAt) {
                const upMs = new Date(meta.explicitlyUploadedAt).getTime();
                if (!isNaN(upMs) && upMs >= minCreatedMs) {
                    validLoggedTerms.add(tKey);
                }
            }
        });

        let needSave = false;

        if (fetchedLogsOk || minCreatedMs > 0) {
            const allCandidateKeys = new Set([
                ...Object.keys(termMap),
                ...Object.keys(registry)
            ]);
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('scholardoc_school_records_')) {
                    allCandidateKeys.add(k.replace('scholardoc_school_records_', ''));
                }
            });

            for (const tKey of allCandidateKeys) {
                if (!validLoggedTerms.has(tKey)) {
                    delete termMap[tKey];
                    delete registry[tKey];
                    try { localStorage.removeItem(`scholardoc_school_records_${tKey}`); } catch (_) { }
                    await idbDeleteSchoolTermRecords(tKey);
                    needSave = true;
                }
            }
        }

        if (validLoggedTerms.size === 1) {
            const onlyTermKey = Array.from(validLoggedTerms)[0];
            if (!termMap[onlyTermKey] || termMap[onlyTermKey].length === 0) {
                const parts = onlyTermKey.split('_');
                const tAy = parts[0];
                const tSem = parts.slice(1).join('_');
                termMap[onlyTermKey] = allDbStudents.map(s => String(s.student_no || s.studentNo || s.studentId || '').trim()).filter(Boolean);
                registry[onlyTermKey] = {
                    academicYear: tAy,
                    semester: tSem,
                    count: termMap[onlyTermKey].length,
                    updatedAt: new Date().toISOString()
                };
                needSave = true;
            }
        }

        if (needSave) {
            localStorage.setItem('scholardoc_school_term_students', JSON.stringify(termMap));
            localStorage.setItem('scholardoc_school_terms_registry', JSON.stringify(registry));

            const rebuiltStudentTermsCache = {};
            Object.entries(termMap).forEach(([tKey, sNos]) => {
                const parts = tKey.split('_');
                const tAy = parts[0];
                const tSem = parts.slice(1).join('_');
                (sNos || []).forEach(sNo => {
                    if (!rebuiltStudentTermsCache[sNo]) rebuiltStudentTermsCache[sNo] = [];
                    if (!rebuiltStudentTermsCache[sNo].some(t => t.academicYear === tAy && t.semester === tSem)) {
                        rebuiltStudentTermsCache[sNo].push({ academicYear: tAy, semester: tSem });
                    }
                });
            });
            localStorage.setItem('scholardoc_school_student_terms', JSON.stringify(rebuiltStudentTermsCache));
        }
    } catch (e) {
        console.warn('Error during autoHealSchoolStudentTerms:', e);
    }
}

// Helper to save school student term assignments in persistent storage without overwriting other terms
function saveSchoolStudentTerms(records, ay, sem) {
    if (!records || records.length === 0 || !ay || !sem) return;
    try {
        const termKey = `${ay}_${sem}`;
        const nowIso = new Date().toISOString();

        // 1. Save list of student numbers belonging to this term
        const termStudentsMap = getSchoolTermStudentsMap();
        const studentNos = records.map(r => String(r.studentNo || r.studentId || r.student_no || '').trim()).filter(Boolean);
        termStudentsMap[termKey] = Array.from(new Set(studentNos));
        localStorage.setItem('scholardoc_school_term_students', JSON.stringify(termStudentsMap));

        // 2. Add this term to each student's multi-term list in scholardoc_school_student_terms (never overwrite!)
        const studentTermsCache = JSON.parse(localStorage.getItem('scholardoc_school_student_terms') || '{}');
        const termVal = { academicYear: ay, semester: sem };
        records.forEach(r => {
            const sNo = String(r.studentNo || r.studentId || r.student_no || '').trim();
            const sName = String(r.fullName || r.full_name || '').toLowerCase().trim();
            const sId = r.id ? String(r.id).trim() : null;

            const addTerm = (key) => {
                if (!key) return;
                let existing = studentTermsCache[key];
                let list = Array.isArray(existing) ? existing : (existing && existing.academicYear ? [existing] : []);
                if (!list.some(t => t.academicYear === ay && t.semester === sem)) {
                    list.push(termVal);
                }
                studentTermsCache[key] = list;
            };

            addTerm(sNo);
            addTerm(sName);
            addTerm(sId);
        });
        localStorage.setItem('scholardoc_school_student_terms', JSON.stringify(studentTermsCache));

        // 3. Register the uploaded term metadata
        const registry = getSchoolTermsRegistry();
        registry[termKey] = {
            academicYear: ay,
            semester: sem,
            count: records.length,
            updatedAt: nowIso,
            explicitlyUploadedAt: nowIso
        };
        localStorage.setItem('scholardoc_school_terms_registry', JSON.stringify(registry));

        // 4. Save parsed records snapshot in IndexedDB & localStorage
        idbSaveSchoolTermRecords(termKey, records);
        try {
            localStorage.setItem(`scholardoc_school_records_${termKey}`, JSON.stringify(records));
        } catch (_) { }
    } catch (e) {
        console.warn('Error saving school student terms cache:', e);
    }
}

// Determines whether a student belongs to a specific academic year and semester
function isSchoolStudentInTerm(s, targetAy, targetSem, studentProfileMap = new Map()) {
    if (!targetAy || targetAy === 'All') {
        if (!targetSem || targetSem === 'All') return true;
    }

    const sNo = String(s.student_no || s.studentNo || s.studentId || '').trim();
    const sName = String(s.full_name || s.fullName || s.name || '').toLowerCase().trim();
    const sId = s.id ? String(s.id).trim() : null;
    const termKey = `${targetAy}_${targetSem}`;

    // 1. Direct lookup in term-students mapping
    const termStudentsMap = getSchoolTermStudentsMap();
    if (targetAy && targetAy !== 'All' && targetSem && targetSem !== 'All') {
        if (termStudentsMap && Array.isArray(termStudentsMap[termKey])) {
            const studentSet = new Set(termStudentsMap[termKey]);
            if (sNo && studentSet.has(sNo)) return true;
            if (sName && studentSet.has(sName)) return true;
            if (sId && studentSet.has(sId)) return true;
            return false;
        }
        // If no school student records have been uploaded for this specific term, remain strictly empty
        return false;
    }

    // 2. Multi-term list check in scholardoc_school_student_terms
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_school_student_terms') || '{}');
        const entry = (sNo && cache[sNo]) || (sId && cache[sId]) || (sName && cache[sName]);
        if (Array.isArray(entry)) {
            const hasMatch = entry.some(t => {
                const matchAy = !targetAy || targetAy === 'All' || t.academicYear === targetAy;
                const matchSem = !targetSem || targetSem === 'All' || t.semester === targetSem;
                return matchAy && matchSem;
            });
            if (hasMatch) return true;
        } else if (entry && entry.academicYear && entry.semester) {
            const matchAy = !targetAy || targetAy === 'All' || entry.academicYear === targetAy;
            const matchSem = !targetSem || targetSem === 'All' || entry.semester === targetSem;
            if (matchAy && matchSem) return true;
        }
    } catch (_) { }

    // 3. Matched profile in student_grantees
    const matchedSt = studentProfileMap.get(sNo) || studentProfileMap.get(sName);
    if (matchedSt) {
        const ay = matchedSt.academic_year || matchedSt.academicYear;
        const sem = matchedSt.semester;
        if (ay && sem) {
            const matchAy = !targetAy || targetAy === 'All' || ay === targetAy;
            const matchSem = !targetSem || targetSem === 'All' || sem === targetSem;
            if (matchAy && matchSem) return true;
        }
    }

    // 4. Direct property on student object
    const objAy = s.academicYear || s.academic_year;
    const objSem = s.semester;
    if (objAy && objSem) {
        const matchAy = !targetAy || targetAy === 'All' || objAy === targetAy;
        const matchSem = !targetSem || targetSem === 'All' || objSem === targetSem;
        return matchAy && matchSem;
    }

    return false;
}

// Helper to get a school student's academic term
function getSchoolStudentTerm(s, studentProfileMap = new Map(), targetAy = selectedAcademicYear, targetSem = selectedSemester) {
    if (targetAy && targetSem && targetAy !== 'All' && targetSem !== 'All') {
        if (isSchoolStudentInTerm(s, targetAy, targetSem, studentProfileMap)) {
            return { academicYear: targetAy, semester: targetSem };
        }
    }

    const sNo = String(s.student_no || s.studentNo || s.studentId || '').trim();
    const sName = String(s.full_name || s.fullName || '').toLowerCase().trim();
    const sId = s.id ? String(s.id).trim() : null;

    let ay = s.academic_year || s.academicYear;
    let sem = s.semester;
    if (ay && sem) return { academicYear: ay, semester: sem };

    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_school_student_terms') || '{}');
        const entry = (sNo && cache[sNo]) || (sId && cache[sId]) || (sName && cache[sName]);
        if (Array.isArray(entry) && entry.length > 0) {
            const activeMatch = entry.find(t => (!targetAy || targetAy === 'All' || t.academicYear === targetAy) && (!targetSem || targetSem === 'All' || t.semester === targetSem));
            if (activeMatch) return activeMatch;
            return entry[0];
        } else if (entry && entry.academicYear && entry.semester) {
            return { academicYear: entry.academicYear, semester: entry.semester };
        }
    } catch (_) { }

    const matchedSt = studentProfileMap.get(sNo) || studentProfileMap.get(sName);
    if (matchedSt) {
        ay = matchedSt.academic_year || matchedSt.academicYear;
        sem = matchedSt.semester;
        if (ay && sem) return { academicYear: ay, semester: sem };
    }

    return {
        academicYear: targetAy && targetAy !== 'All' ? targetAy : '2026-2027',
        semester: targetSem && targetSem !== 'All' ? targetSem : '1st Semester'
    };
}

// ── 1. Load Data from Supabase ───────────────────────────────────────
async function loadInitialData() {
    try {
        // 1. Fetch Super Admin Grantee Masterlist (strictly from new_grantees_masterlist)
        let { data: masterlistData, error: errMasterlist } = await supabase
            .from('new_grantees_masterlist')
            .select('*')
            .order('created_at', { ascending: false });

        let localTermCache = {};
        try {
            localTermCache = JSON.parse(localStorage.getItem('scholardoc_grantee_terms') || '{}');
        } catch (_) { }

        function getGranteeTerm(m, ln, fn, mn) {
            let ay = m.academic_year || m.academicYear;
            let sem = m.semester;
            if (!ay || !sem) {
                const normKey = `${(ln || '').toLowerCase()}|${(fn || '').toLowerCase()}|${(mn || '').toLowerCase()}`.replace(/[^a-z0-9|]/g, '');
                const rawName = `${ln}, ${fn} ${mn}`.toLowerCase().trim();
                const cached = (m.id && localTermCache[m.id]) || (normKey && localTermCache[normKey]) || (rawName && localTermCache[rawName]);
                if (cached) {
                    if (!ay) ay = cached.academicYear;
                    if (!sem) sem = cached.semester;
                }
            }
            return {
                academicYear: ay || selectedAcademicYear || '2026-2027',
                semester: sem || selectedSemester || '1st Semester'
            };
        }

        if (!errMasterlist && masterlistData && masterlistData.length > 0) {
            const mapped = masterlistData.map(m => {
                let fn = m.first_name || '';
                let mn = m.middle_name || '';
                let ln = m.last_name || '';
                if (fn && (!ln || !ln.trim())) {
                    const parsed = splitFullName(fn);
                    fn = parsed.firstName;
                    mn = parsed.middleName || mn;
                    ln = parsed.lastName;
                } else if (!fn && m.name) {
                    const parsed = splitFullName(m.name);
                    fn = parsed.firstName;
                    mn = parsed.middleName || mn;
                    ln = parsed.lastName;
                }
                const term = getGranteeTerm(m, ln, fn, mn);
                return {
                    id: m.id,
                    name: m.name || `${ln}, ${fn} ${mn}`.trim(),
                    last_name: ln,
                    first_name: fn,
                    middle_name: mn,
                    batch: resolveGranteeBatch({ ...m, last_name: ln, first_name: fn, middle_name: mn }),
                    student_id: m.student_id || '',
                    course: m.course || m.program || '',
                    year: m.year || '1',
                    academicYear: term.academicYear,
                    semester: term.semester
                };
            });

            // Filter according to selected academic year & semester
            rawSuperAdminGrantees = mapped.filter(g => {
                const matchAy = selectedAcademicYear === 'All' || g.academicYear === selectedAcademicYear;
                const matchSem = selectedSemester === 'All' || g.semester === selectedSemester;
                return matchAy && matchSem;
            });

            const syncEl = document.getElementById('superadmin-sync-status');
            if (syncEl) {
                syncEl.innerHTML = `<i class="icon-check-circle-2" style="font-size: 14px;"></i> Synced with Super Admin Import (${rawSuperAdminGrantees.length} records for ${selectedAcademicYear} • ${selectedSemester})`;
            }
        } else {
            // When table is empty or deleted in Supabase, show strictly empty list
            rawSuperAdminGrantees = [];
            const syncEl = document.getElementById('superadmin-sync-status');
            if (syncEl) syncEl.innerHTML = `<i class="icon-info" style="font-size: 14px;"></i> Database table empty (0 grantees)`;
        }

        // 2. Fetch Default School Student Records (strictly from school_students)
        const schoolDbData = await fetchAllSchoolStudents();
        let errSchool = null;

        // Reconcile local term students map with authoritative Supabase state
        await autoHealSchoolStudentTerms(schoolDbData);

        // Optional profile enrichment from student_grantees table
        let { data: studentsDbData } = await supabase
            .from('student_grantees')
            .select('*');

        const studentProfileMap = new Map();
        (studentsDbData || []).forEach(st => {
            const sNo = String(st.student_no || st.studentId || '').trim();
            const sName = String(st.full_name || st.fullName || '').trim().toLowerCase();
            if (sNo) studentProfileMap.set(sNo, st);
            if (sName) studentProfileMap.set(sName, st);
            if (st.uid) studentProfileMap.set(String(st.uid).trim(), st);
            if (st.id) studentProfileMap.set(String(st.id).trim(), st);
        });

        if (!errSchool && schoolDbData && schoolDbData.length > 0) {
            // Only load a term snapshot if this academic year & semester has uploaded school student records
            const termKey = `${selectedAcademicYear}_${selectedSemester}`;
            const termStudentsMap = getSchoolTermStudentsMap();
            const hasUploadedTermRecords = selectedAcademicYear !== 'All' &&
                selectedSemester !== 'All' &&
                Array.isArray(termStudentsMap[termKey]) &&
                termStudentsMap[termKey].length > 0;
            let termSnapshot = null;
            if (hasUploadedTermRecords) {
                try {
                    const rawSnap = localStorage.getItem(`scholardoc_school_records_${termKey}`);
                    if (rawSnap) termSnapshot = JSON.parse(rawSnap);
                } catch (_) { }
                if (!termSnapshot) {
                    termSnapshot = await idbGetSchoolTermRecords(termKey);
                }
            }

            if (termSnapshot && Array.isArray(termSnapshot) && termSnapshot.length > 0) {
                // Validate termSnapshot: If records have missing studentNo AND missing fullName, discard corrupted snapshot
                const corruptCount = termSnapshot.filter(s => {
                    const no = String(s.studentNo || s.student_no || s.studentId || '').trim();
                    const name = String(s.fullName || s.full_name || s.name || '').trim();
                    return !no && !name;
                }).length;

                if (corruptCount > 0) {
                    console.warn(`[SchoolStudents] Discarding corrupted local snapshot (${corruptCount} corrupt items) for ${termKey}`);
                    try { localStorage.removeItem(`scholardoc_school_records_${termKey}`); } catch (_) { }
                    termSnapshot = null;
                }
            }

            if (termSnapshot && Array.isArray(termSnapshot) && termSnapshot.length > 0) {
                // Also build lookup for schoolDbData to merge any Supabase records with local snapshot
                const dbMap = new Map();
                (schoolDbData || []).forEach(dbSt => {
                    const dbNo = String(dbSt.student_no || dbSt.studentNo || dbSt.studentId || '').trim();
                    if (dbNo) dbMap.set(dbNo, dbSt);
                    const dbName = String(dbSt.full_name || dbSt.fullName || '').trim().toLowerCase();
                    if (dbName) dbMap.set(dbName, dbSt);
                });

                rawSchoolStudents = termSnapshot.map(s => {
                    const sNo = String(s.studentNo || s.student_no || s.studentId || '').trim();
                    const sName = String(s.fullName || s.full_name || s.name || '').trim().toLowerCase();
                    const fromDb = dbMap.get(sNo) || dbMap.get(sName);
                    // Authoritative database fields must NEVER be overwritten by empty or missing snapshot fields
                    let merged = s;
                    if (fromDb) {
                        merged = { ...s };
                        Object.keys(fromDb).forEach(k => {
                            if (fromDb[k] !== undefined && fromDb[k] !== null && fromDb[k] !== '') {
                                merged[k] = fromDb[k];
                            }
                        });
                    }
                    const mapped = mapSchoolStudentRecord(merged, studentProfileMap);
                    mapped.academicYear = selectedAcademicYear;
                    mapped.semester = selectedSemester;
                    return mapped;
                });
            } else {
                // Filter school students using multi-term membership
                const filteredSchool = schoolDbData.filter(s => {
                    return isSchoolStudentInTerm(s, selectedAcademicYear, selectedSemester, studentProfileMap);
                });

                rawSchoolStudents = filteredSchool.map(s => {
                    const mapped = mapSchoolStudentRecord(s, studentProfileMap);
                    mapped.academicYear = selectedAcademicYear !== 'All' ? selectedAcademicYear : (s.academic_year || '2026-2027');
                    mapped.semester = selectedSemester !== 'All' ? selectedSemester : (s.semester || '1st Semester');
                    return mapped;
                });
            }
        } else {
            // When table is empty or deleted in Supabase, show strictly empty list
            rawSchoolStudents = [];
        }

        // 3. Automatic Restore from Supabase Database for Form 2 & Form 3 for active term
        try {
            const dbSync = await AnnexSyncService.loadFromSupabase({
                academicYear: selectedAcademicYear,
                semester: selectedSemester,
                fallbackToLatest: false
            });
            if (dbSync && dbSync.fromDb) {
                if ((!dbSync.form2List || dbSync.form2List.length === 0) && (!dbSync.form3List || dbSync.form3List.length === 0)) {
                    // Database tables annex_form_2 and annex_form_3 are empty for this term
                    const cachedTerm = AnnexSyncService.getVerifiedData(selectedAcademicYear, selectedSemester);
                    if (cachedTerm && ((cachedTerm.form2List && cachedTerm.form2List.length > 0) || (cachedTerm.form3List && cachedTerm.form3List.length > 0))) {
                        verifiedForm2List = cachedTerm.form2List || [];
                        verifiedForm3List = cachedTerm.form3List || [];
                        needsReviewList = cachedTerm.needsReviewList || [];
                    } else {
                        verifiedForm2List = [];
                        verifiedForm3List = [];
                        needsReviewList = [];
                    }
                } else {
                    verifiedForm2List = dbSync.form2List || [];
                    verifiedForm3List = dbSync.form3List || [];
                    needsReviewList = [];
                    AnnexSyncService.saveVerifiedData({
                        form2List: verifiedForm2List,
                        form3List: verifiedForm3List,
                        needsReviewList: [],
                        updatedBy: 'Supabase Auto-Restore',
                        syncToDb: false,
                        academicYear: selectedAcademicYear,
                        semester: selectedSemester
                    });
                }
            } else {
                verifiedForm2List = [];
                verifiedForm3List = [];
                needsReviewList = [];
            }
        } catch (dbErr) {
            console.warn('Auto-restore check error:', dbErr);
        }

        updateSourceCounts();
        populateSuperAdminBatchFilter();
        renderSuperAdminGranteesTable(rawSuperAdminGrantees);
        renderSchoolStudentsTable(rawSchoolStudents);
        runCrossVerification();

        // Setup real-time listeners so Supabase deletions reflect immediately
        setupDatabaseRealtimeListeners();

    } catch (e) {
        console.error('Error loading initial verification data:', e);
        showToast('Error loading records: ' + e.message, 'alert-triangle');
    }
}

// ── Database Realtime Listener Setup ────────────────────────────────
function setupDatabaseRealtimeListeners() {
    if (!supabase || typeof supabase.channel !== 'function') return;

    if (window.__adminAnnex5RealtimeChannel) {
        try { supabase.removeChannel(window.__adminAnnex5RealtimeChannel); } catch (_) {}
        window.__adminAnnex5RealtimeChannel = null;
    }
    if (dbRealtimeChannel) {
        try { supabase.removeChannel(dbRealtimeChannel); } catch (_) {}
        dbRealtimeChannel = null;
    }
    if (typeof supabase.getChannels === 'function') {
        const existing = supabase.getChannels();
        existing.forEach(ch => {
            if (ch.topic && ch.topic.includes('admin-annex5-realtime-sync')) {
                try { supabase.removeChannel(ch); } catch (_) {}
            }
        });
    }

    const uniqueChannelName = `admin-annex5-realtime-sync-${Date.now()}`;
    dbRealtimeChannel = supabase.channel(uniqueChannelName);
    window.__adminAnnex5RealtimeChannel = dbRealtimeChannel;

    dbRealtimeChannel
        // 1. Listen for school_students changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'school_students' }, async (payload) => {
            if (isImportingSchoolStudents) return;
            console.log('[Realtime] school_students change event:', payload.eventType);
            const data = await fetchAllSchoolStudents();
            const filteredSchool = (data || []).filter(s => {
                return isSchoolStudentInTerm(s, selectedAcademicYear, selectedSemester);
            });
            rawSchoolStudents = filteredSchool.map(s => {
                const mapped = mapSchoolStudentRecord(s);
                mapped.academicYear = selectedAcademicYear !== 'All' ? selectedAcademicYear : (s.academic_year || '2026-2027');
                mapped.semester = selectedSemester !== 'All' ? selectedSemester : (s.semester || '1st Semester');
                return mapped;
            });
            updateSourceCounts();
            renderSchoolStudentsTable(rawSchoolStudents);
            runCrossVerification();
        })
        // 2. Listen for new_grantees_masterlist changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'new_grantees_masterlist' }, async (payload) => {
            console.log('[Realtime] new_grantees_masterlist change event:', payload.eventType);
            const { data } = await supabase.from('new_grantees_masterlist').select('*').order('created_at', { ascending: false });
            rawSuperAdminGrantees = (data || []).map(m => {
                let fn = m.first_name || '';
                let mn = m.middle_name || '';
                let ln = m.last_name || '';
                if (fn && (!ln || !ln.trim())) {
                    const parsed = splitFullName(fn);
                    fn = parsed.firstName;
                    mn = parsed.middleName || mn;
                    ln = parsed.lastName;
                } else if (!fn && m.name) {
                    const parsed = splitFullName(m.name);
                    fn = parsed.firstName;
                    mn = parsed.middleName || mn;
                    ln = parsed.lastName;
                }
                return {
                    id: m.id,
                    name: m.name || `${ln}, ${fn} ${mn}`.trim(),
                    last_name: ln,
                    first_name: fn,
                    middle_name: mn,
                    batch: resolveGranteeBatch({ ...m, last_name: ln, first_name: fn, middle_name: mn }),
                    student_id: m.student_id || '',
                    course: m.course || m.program || '',
                    year: m.year || '1'
                };
            });
            updateSourceCounts();
            populateSuperAdminBatchFilter();
            renderSuperAdminGranteesTable(rawSuperAdminGrantees);
            runCrossVerification();
        })
        // 3. Listen for annex_form_2 changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'annex_form_2' }, async (payload) => {
            console.log('[Realtime] annex_form_2 change event:', payload.eventType);
            if (AnnexSyncService.isSavingToDb) return;
            const dbSync = await AnnexSyncService.loadFromSupabase();
            if (dbSync && dbSync.fromDb) {
                if (dbSync.form2List.length === 0 && dbSync.form3List.length === 0) {
                    AnnexSyncService.clearVerifiedData({ clearSupabase: false });
                    verifiedForm2List = [];
                    verifiedForm3List = [];
                    needsReviewList = [];
                    updateKPIMetrics();
                    renderForm2Table(verifiedForm2List);
                    renderForm3Table(verifiedForm3List);
                    renderReviewQueue(needsReviewList);
                } else {
                    verifiedForm2List = dbSync.form2List || [];
                    if (dbSync.form3List && dbSync.form3List.length > 0) verifiedForm3List = dbSync.form3List;
                    runCrossVerification();
                }
            }
        })
        // 4. Listen for annex_form_3 changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'annex_form_3' }, async (payload) => {
            console.log('[Realtime] annex_form_3 change event:', payload.eventType);
            if (AnnexSyncService.isSavingToDb) return;
            const dbSync = await AnnexSyncService.loadFromSupabase();
            if (dbSync && dbSync.fromDb) {
                if (dbSync.form2List.length === 0 && dbSync.form3List.length === 0) {
                    AnnexSyncService.clearVerifiedData({ clearSupabase: false });
                    verifiedForm2List = [];
                    verifiedForm3List = [];
                    needsReviewList = [];
                    updateKPIMetrics();
                    renderForm2Table(verifiedForm2List);
                    renderForm3Table(verifiedForm3List);
                    renderReviewQueue(needsReviewList);
                } else {
                    verifiedForm3List = dbSync.form3List || [];
                    if (dbSync.form2List && dbSync.form2List.length > 0) verifiedForm2List = dbSync.form2List;
                    runCrossVerification();
                }
            }
        })
        // 5. Listen for students table changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, async (payload) => {
            console.log('[Realtime] students change event:', payload.eventType);
            // Refresh counts and verification if student record was removed
            if (payload.eventType === 'DELETE') {
                const deletedUid = payload.old?.uid || payload.old?.id;
                const deletedNo = payload.old?.student_no || payload.old?.studentId;
                if (deletedUid || deletedNo) {
                    rawSchoolStudents = rawSchoolStudents.filter(s => s.id !== deletedUid && s.studentNo !== deletedNo);
                    renderSchoolStudentsTable(rawSchoolStudents);
                    updateSourceCounts();
                }
            }
        })
        .subscribe();
}

// ── 2. Update Source Counts & Status ────────────────────────────────
function updateSourceCounts() {
    const elGranteeCount = document.getElementById('superadmin-grantee-count');
    const elSchoolCount = document.getElementById('school-students-count');
    const elStatusText = document.getElementById('comparison-status-text');

    if (elGranteeCount) elGranteeCount.textContent = rawSuperAdminGrantees.length;
    if (elSchoolCount) elSchoolCount.textContent = rawSchoolStudents.length;

    if (elStatusText) {
        elStatusText.textContent = `Ready to cross-reference ${rawSuperAdminGrantees.length} Super Admin Grantees against ${rawSchoolStudents.length} School Student records.`;
    }
}

// ── Render Super Admin Grantees Table (Source 1) ─────────────────────
function renderSuperAdminGranteesTable(items) {
    const tbody = document.getElementById('tbody-superadmin-grantees');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-secondary);">No grantees found in Super Admin masterlist.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((g, idx) => {
        let firstName = g.first_name || g.firstName || '';
        let middleName = g.middle_name || g.middleName || '';
        let lastName = g.last_name || g.lastName || '';
        if (firstName && (!lastName || !lastName.trim())) {
            const parsed = splitFullName(firstName);
            firstName = parsed.firstName;
            middleName = parsed.middleName || middleName;
            lastName = parsed.lastName;
        } else if (!firstName && g.name) {
            const parsed = splitFullName(g.name);
            firstName = parsed.firstName;
            middleName = parsed.middleName || middleName;
            lastName = parsed.lastName;
        }
        const batch = resolveGranteeBatch(g);

        return `
            <tr class="annex-clickable-row" data-index="${idx}" style="border-bottom: 1px solid var(--border-color); vertical-align: middle;" title="Click to view student details and categorization">
                <td style="padding: 10px 14px; font-weight: 600; font-size: 12px; color: var(--text-primary);">${firstName}</td>
                <td style="padding: 10px 14px; font-size: 12px; color: var(--text-primary);">${middleName}</td>
                <td style="padding: 10px 14px; font-weight: 600; font-size: 12px; color: var(--text-primary);">${lastName}</td>
                <td style="padding: 10px 14px; white-space: nowrap;">
                    <span class="badge-batch-pill" title="Assigned Batch">
                        <i class="icon-layers" style="font-size: 11px;"></i>
                        ${batch}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.annex-clickable-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = parseInt(row.getAttribute('data-index'), 10);
            const g = items[idx];
            if (!g) return;
            const f2Item = verifiedForm2List.find(x => AnnexSyncService.isSameStudent(x, g));
            if (f2Item) {
                openStudentDetailsModal(f2Item, 'form2', verifiedForm2List.indexOf(f2Item));
                return;
            }
            const f3Item = verifiedForm3List.find(x => AnnexSyncService.isSameStudent(x, g));
            if (f3Item) {
                openStudentDetailsModal(f3Item, 'form3', verifiedForm3List.indexOf(f3Item));
                return;
            }
            const revItem = needsReviewList.find(x => AnnexSyncService.isSameStudent(x, g));
            if (revItem) {
                openStudentDetailsModal(revItem, 'review', needsReviewList.indexOf(revItem));
                return;
            }
            openStudentDetailsModal({ grantee: g, classification: 'MATCHED_FORM2', isEnrolled: true }, 'form2', -1);
        });
    });
}

// ── Batch Filter Population & Filtering (Source 1) ─────────────────
function populateSuperAdminBatchFilter() {
    const sel = document.getElementById('filter-superadmin-batch');
    if (!sel) return;

    const uniqueBatches = new Set();
    rawSuperAdminGrantees.forEach(g => {
        const b = resolveGranteeBatch(g);
        if (b && b.trim().length > 0) {
            uniqueBatches.add(b.trim());
        }
    });

    if (uniqueBatches.size === 0) {
        uniqueBatches.add('Batch 1.1');
        uniqueBatches.add('Batch 1.2');
        uniqueBatches.add('Batch 1.3');
    }

    const sortedBatches = Array.from(uniqueBatches).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const currentVal = sel.value || 'All Batches';
    sel.innerHTML = '<option value="All Batches">All Batches</option>' +
        sortedBatches.map(b => `<option value="${b}" ${b === currentVal ? 'selected' : ''}>${b}</option>`).join('');
}

function filterSuperAdminGrantees() {
    const q = (document.getElementById('search-superadmin-grantees')?.value || '').toLowerCase().trim();
    const batchSel = document.getElementById('filter-superadmin-batch')?.value || 'All Batches';

    const filtered = rawSuperAdminGrantees.filter(g => {
        const name = (g.name || `${g.last_name || ''} ${g.first_name || ''}`).toLowerCase();
        const id = (g.student_id || g.studentId || '').toLowerCase();
        const course = (g.course || '').toLowerCase();
        const batch = resolveGranteeBatch(g);

        const matchQuery = !q || name.includes(q) || id.includes(q) || course.includes(q);
        const matchBatch = batchSel === 'All Batches' ||
            batch.toLowerCase() === batchSel.toLowerCase() ||
            batch.toLowerCase().replace(/^batch\s*/i, '') === batchSel.toLowerCase().replace(/^batch\s*/i, '');

        return matchQuery && matchBatch;
    });

    renderSuperAdminGranteesTable(filtered);
}

// Search & Batch filter listeners for Super Admin Grantees Table
const searchSAGrantees = document.getElementById('search-superadmin-grantees');
if (searchSAGrantees) {
    searchSAGrantees.addEventListener('input', filterSuperAdminGrantees);
}

const filterSABatch = document.getElementById('filter-superadmin-batch');
if (filterSABatch) {
    filterSABatch.addEventListener('change', filterSuperAdminGrantees);
}

// Helper: Parse and format any Date representation into standard YYYY-MM-DD
function parseAndFormatDate(raw) {
    if (raw === null || raw === undefined || raw === '') return '';

    // 1. If it's a JavaScript Date object (use local date components to avoid UTC offset shifts)
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 2. If it's an Excel numeric serial date (e.g. 39363 or '39363')
    const num = Number(raw);
    if (!isNaN(num) && num > 1000 && num < 75000) {
        if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
            const dateObj = XLSX.SSF.parse_date_code(num);
            if (dateObj && dateObj.y) {
                const y = dateObj.y;
                const m = String(dateObj.m).padStart(2, '0');
                const d = String(dateObj.d).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        // Accurate integer formula without timezone drift
        const totalDays = Math.round(num);
        const adjustedDays = totalDays > 60 ? totalDays - 1 : totalDays;
        const epochDays = adjustedDays - 1;
        const dt = new Date(Date.UTC(1900, 0, 1 + epochDays));
        if (!isNaN(dt.getTime())) {
            const y = dt.getUTCFullYear();
            const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dt.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    const s = String(raw).trim();
    if (!s || s.toLowerCase() === 'n/a') return '';

    // 3. If ISO: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const y = isoMatch[1];
        const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
        const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 4. MM/DD/YYYY or DD/MM/YYYY or MM/DD/YY (including corrupted years like 0003, 0007, 0004)
    const slashMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (slashMatch) {
        let p1 = parseInt(slashMatch[1], 10);
        let p2 = parseInt(slashMatch[2], 10);
        let rawY = parseInt(slashMatch[3], 10);

        let y = rawY;
        if (y < 100) {
            y = (y <= 30 ? 2000 : 1900) + y;
        }

        let m, d;
        if (p1 > 12 && p2 <= 12) {
            // DD/MM/YYYY
            d = String(p1).padStart(2, '0');
            m = String(p2).padStart(2, '0');
        } else {
            // MM/DD/YYYY (standard in Philippine school enrollment records)
            m = String(p1).padStart(2, '0');
            d = String(p2).padStart(2, '0');
        }
        return `${y}-${m}-${d}`;
    }

    // 5. Textual dates with month names (e.g. "October 8, 2007", "8-Oct-2007", "Oct 8 2007")
    const monthMap = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        january: 1, february: 2, march: 3, april: 4, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    };

    const textMatch = s.toLowerCase().match(/([a-z]+)[,\s\-]+(\d{1,2})[,\s\-]+(\d{2,4})/) ||
        s.toLowerCase().match(/(\d{1,2})[,\s\-]+([a-z]+)[,\s\-]+(\d{2,4})/);
    if (textMatch) {
        let monthStr = isNaN(textMatch[1]) ? textMatch[1] : textMatch[2];
        let dayNum = isNaN(textMatch[1]) ? parseInt(textMatch[2], 10) : parseInt(textMatch[1], 10);
        let yearNum = parseInt(textMatch[3], 10);
        if (yearNum < 100) yearNum = (yearNum <= 30 ? 2000 : 1900) + yearNum;
        const prefix = monthStr.substring(0, 3);
        if (monthMap[prefix]) {
            const m = String(monthMap[prefix]).padStart(2, '0');
            const d = String(dayNum).padStart(2, '0');
            return `${yearNum}-${m}-${d}`;
        }
    }

    return s;
}

// Helper: Calculate Age from Date of Birth string or Excel date
function calculateAge(birthdateStr) {
    if (!birthdateStr || birthdateStr === 'N/A') return 'N/A';
    const cleanDate = parseAndFormatDate(birthdateStr);
    if (!cleanDate) return 'N/A';
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const birth = new Date(y, m, d);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return (age >= 0 && age < 125) ? String(age) : 'N/A';
    }
    return 'N/A';
}

// ── Render School Student Records Table (Source 2) ──────────────
function renderSchoolStudentsTable(students) {
    const tbody = document.getElementById('tbody-school-students');
    if (!tbody) return;

    if (!students || students.length === 0) {
        const termDesc = (selectedAcademicYear && selectedSemester && selectedAcademicYear !== 'All' && selectedSemester !== 'All')
            ? ` for A.Y. ${selectedAcademicYear} (${selectedSemester})`
            : '';
        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 32px; color: var(--text-secondary);">No school student records found${termDesc}.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map((s) => {
        const family = s.familyDetails || {};
        const uid = s.uid || s.studentNo || s.studentId || s.student_no || s.student_id || s.id || Math.random().toString(36).substring(2);
        const isChecked = selectedSchoolStudentIds.has(uid) ? 'checked' : '';

        // 1. Student No.
        const studentNo = s.studentNo || s.studentId || s.student_no || s.student_id || 'N/A';

        // 2. Full Name
        let fullName = s.fullName || s.full_name || s.name || '';
        if (!fullName) {
            if (s.last_name || s.first_name) {
                fullName = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ');
            } else {
                fullName = 'N/A';
            }
        }

        // Scholarship Name (Enriched from DB)
        const scholarship = s.scholarship || s.scholarshipName || s.scholarship_name || 'TES';

        // 3. Program Name
        const programName = s.programName || s.program_name || s.program || s.course || 'N/A';

        // 4. Year Level
        const yearLevel = s.yearLevel || s.year_level || s.year || 'N/A';

        // 5. Date of Birth
        const rawDob = s.dateOfBirth || s.date_of_birth || s.birthdate || s.birthday || s.dob || '';
        const dob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : 'N/A';

        // 6. Age
        let age = s.age;
        if (!age || age === 'N/A' || isNaN(age)) {
            age = calculateAge(dob !== 'N/A' ? dob : rawDob);
        }

        // 7. Gender
        const gender = (s.gender || s.sex || '').trim() || 'N/A';

        // 8. Civil Status
        const civilStatus = (s.civilStatus || s.civil_status || s.maritalStatus || family.civilStatus || '').trim() || 'Single';

        // 9. Religion
        const religion = (s.religion || family.religion || '').trim() || 'N/A';

        // 10. Mobile Number
        const mobileNumber = (s.mobileNumber || s.mobile_number || s.contactNumber || s.phone || '').trim() || 'N/A';

        // 11. Email Address
        const emailAddress = (s.emailAddress || s.email_address || s.email || s.authEmail || '').trim() || 'N/A';

        // 12. Father's Full Name
        const fatherFullName = (s.fatherFullName || s.father_full_name || s.fatherName || family.fatherFullName || family.fatherName || '').trim() || 'N/A';

        // 13. Father's Occupation
        const fatherOccupation = (s.fatherOccupation || s.father_occupation || s.fatherEduStatus || family.fatherOccupation || family.fatherEduStatus || '').trim() || 'N/A';

        // 14. Mother's Full Name
        const motherFullName = (s.motherFullName || s.mother_full_name || s.motherName || family.motherFullName || family.motherName || '').trim() || 'N/A';

        // 15. Mother's Occupation
        const motherOccupation = (s.motherOccupation || s.mother_occupation || s.motherEduStatus || family.motherOccupation || family.motherEduStatus || '').trim() || 'N/A';

        return `
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 10px 14px; text-align: center;">
                    <input type="checkbox" class="school-row-checkbox" data-uid="${uid}" ${isChecked} style="width: 15px; height: 15px; accent-color: var(--primary-color); cursor: pointer;">
                </td>
                <td style="padding: 10px 14px; font-size: 12px; color: var(--text-secondary); font-family: monospace; white-space: nowrap;">${studentNo}</td>
                <td style="padding: 10px 14px; font-weight: 600; font-size: 12px; white-space: nowrap; color: var(--text-primary);">${fullName}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${programName}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap; text-align: center;">${yearLevel}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${dob}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap; text-align: center;">${age}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${gender}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${civilStatus}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${religion}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${mobileNumber}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap; color: var(--text-secondary);">${emailAddress}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${fatherFullName}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${fatherOccupation}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${motherFullName}</td>
                <td style="padding: 10px 14px; font-size: 12px; white-space: nowrap;">${motherOccupation}</td>
            </tr>
        `;
    }).join('');

    // Bind row checkboxes
    tbody.querySelectorAll('.school-row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const uid = e.target.dataset.uid;
            if (e.target.checked) selectedSchoolStudentIds.add(uid);
            else selectedSchoolStudentIds.delete(uid);
        });
    });
}

// Search filter for School Students Table
const searchSchoolStudents = document.getElementById('search-school-students');
if (searchSchoolStudents) {
    searchSchoolStudents.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (!q) {
            renderSchoolStudentsTable(rawSchoolStudents);
            return;
        }
        const filtered = rawSchoolStudents.filter(s => {
            const family = s.familyDetails || {};
            const studentNo = (s.studentNo || s.studentId || s.student_no || s.student_id || '').toLowerCase();
            const name = (s.fullName || s.full_name || s.name || `${s.last_name || ''} ${s.first_name || ''}`).toLowerCase();
            const schol = (s.scholarship || s.scholarshipName || s.scholarship_name || '').toLowerCase();
            const prog = (s.programName || s.program_name || s.program || s.course || '').toLowerCase();
            const email = (s.emailAddress || s.email_address || s.email || s.authEmail || '').toLowerCase();
            const father = (s.fatherFullName || s.father_full_name || s.fatherName || family.fatherFullName || family.fatherName || '').toLowerCase();
            const mother = (s.motherFullName || s.mother_full_name || s.motherName || family.motherFullName || family.motherName || '').toLowerCase();
            const religion = (s.religion || family.religion || '').toLowerCase();
            const dob = (s.dateOfBirth || s.date_of_birth || s.birthdate || '').toLowerCase();
            return studentNo.includes(q) || name.includes(q) || schol.includes(q) || prog.includes(q) || email.includes(q) || father.includes(q) || mother.includes(q) || religion.includes(q) || dob.includes(q);
        });
        renderSchoolStudentsTable(filtered);
    });
}

// Select-all checkbox for School Students Table
const selectAllSchool = document.getElementById('school-select-all');
if (selectAllSchool) {
    selectAllSchool.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.school-row-checkbox').forEach(cb => {
            cb.checked = isChecked;
            const uid = cb.dataset.uid;
            if (isChecked && uid) selectedSchoolStudentIds.add(uid);
            else if (uid) selectedSchoolStudentIds.delete(uid);
        });
    });
}

// Toggle Expand / Full Width for School Students Card
const btnToggleExpand = document.getElementById('btn-toggle-school-expand');
const cardSchool = document.getElementById('card-source-school');
const wrapSchoolStudents = document.getElementById('wrap-school-students');
const iconExpand = document.getElementById('icon-school-expand');
const textExpand = document.getElementById('text-school-expand');

if (btnToggleExpand && cardSchool) {
    btnToggleExpand.addEventListener('click', () => {
        isSchoolTableExpanded = !isSchoolTableExpanded;
        if (isSchoolTableExpanded) {
            cardSchool.style.gridColumn = '1 / -1';
            if (wrapSchoolStudents) wrapSchoolStudents.style.maxHeight = '480px';
            if (iconExpand) iconExpand.className = 'icon-minimize-2';
            if (textExpand) textExpand.textContent = 'Collapse';
        } else {
            cardSchool.style.gridColumn = 'auto';
            if (wrapSchoolStudents) wrapSchoolStudents.style.maxHeight = '240px';
            if (iconExpand) iconExpand.className = 'icon-maximize-2';
            if (textExpand) textExpand.textContent = 'Expand';
        }
    });
}

// Download School Student Records Excel Template
const btnDownloadTemplate = document.getElementById('btn-download-school-template');
if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', () => {
        downloadSchoolStudentTemplate();
    });
}

function downloadSchoolStudentTemplate() {
    const headers = [
        'Student No.',
        'Full Name',
        'Scholarship',
        'Program Name',
        'Year Level',
        'Date of Birth',
        'Age',
        'Gender',
        'Civil Status',
        'Religion',
        'Mobile Number',
        'Email Address',
        'Father’s Full Name',
        'Father’s Occupation',
        'Mother’s Full Name',
        'Mother’s Occupation'
    ];

    const sampleData = [
        [
            '2024-00101',
            'DELA CRUZ, JUAN PEDRO M.',
            'TES',
            'Bachelor of Science in Information Technology',
            '1st Year',
            '2004-05-15',
            '20',
            'Male',
            'Single',
            'Roman Catholic',
            '09123456789',
            'juan.delacruz@school.edu.ph',
            'Pedro Dela Cruz',
            'Farmer',
            'Maria Dela Cruz',
            'Housewife'
        ],
        [
            '2024-00102',
            'SANTOS, MARIA CLARA S.',
            'TES',
            'Bachelor of Science in Computer Science',
            '2nd Year',
            '2003-08-22',
            '21',
            'Female',
            'Single',
            'Christian',
            '09987654321',
            'maria.santos@school.edu.ph',
            'Roberto Santos',
            'Government Employee',
            'Elena Santos',
            'Public School Teacher'
        ]
    ];

    const wsData = [headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
        { wch: 15 }, // Student No.
        { wch: 28 }, // Full Name
        { wch: 15 }, // Scholarship
        { wch: 35 }, // Program Name
        { wch: 12 }, // Year Level
        { wch: 15 }, // Date of Birth
        { wch: 8 },  // Age
        { wch: 10 }, // Gender
        { wch: 14 }, // Civil Status
        { wch: 18 }, // Religion
        { wch: 16 }, // Mobile Number
        { wch: 28 }, // Email Address
        { wch: 24 }, // Father's Full Name
        { wch: 22 }, // Father's Occupation
        { wch: 24 }, // Mother's Full Name
        { wch: 22 }  // Mother's Occupation
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'School Student Records');
    XLSX.writeFile(wb, 'School_Student_Records_Template.xlsx');
    if (typeof showToast === 'function') {
        showToast('School Student Records template downloaded!', 'download');
    }
}

// ── 3. School File Upload & Parsing Logic ────────────────────────────
const dropZone = document.getElementById('school-file-dropzone');
const fileInput = document.getElementById('school-file-input');
const uploadPrompt = document.getElementById('school-upload-prompt');
const fileInfo = document.getElementById('school-file-info');
const fileNameDisplay = document.getElementById('school-file-name');
const fileSizeDisplay = document.getElementById('school-file-size');
const btnClearFile = document.getElementById('btn-clear-school-file');

if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
        if (e.target !== btnClearFile && !btnClearFile?.contains(e.target)) {
            const term = getSelectedSchoolUploadTerm();
            if (!term) return;
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#1E88E5';
        dropZone.style.background = 'rgba(30,136,229,0.06)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(30,136,229,0.3)';
        dropZone.style.background = 'rgba(30,136,229,0.02)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(30,136,229,0.3)';
        dropZone.style.background = 'rgba(30,136,229,0.02)';

        const term = getSelectedSchoolUploadTerm();
        if (!term) return;

        if (e.dataTransfer.files.length > 0) {
            handleSchoolFile(e.dataTransfer.files[0], term);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const term = getSelectedSchoolUploadTerm();
        if (!term) {
            fileInput.value = '';
            return;
        }

        if (e.target.files.length > 0) {
            handleSchoolFile(e.target.files[0], term);
        }
    });
}

if (btnClearFile) {
    btnClearFile.addEventListener('click', async (e) => {
        e.stopPropagation();
        uploadedSchoolFile = null;
        if (fileInput) fileInput.value = '';
        if (uploadPrompt) uploadPrompt.style.display = 'flex';
        if (fileInfo) fileInfo.style.display = 'none';

        // Revert to database students (strictly from school_students) with pagination
        let dbStudents = await fetchAllSchoolStudents();

        let { data: fallbackStudents } = await supabase
            .from('student_grantees')
            .select('*');

        const studentProfileMap = new Map();
        (fallbackStudents || []).forEach(st => {
            const sNo = String(st.student_no || st.studentId || '').trim();
            const sName = String(st.full_name || st.fullName || '').trim().toLowerCase();
            if (sNo) studentProfileMap.set(sNo, st);
            if (sName) studentProfileMap.set(sName, st);
            if (st.uid) studentProfileMap.set(String(st.uid).trim(), st);
            if (st.id) studentProfileMap.set(String(st.id).trim(), st);
        });

        if (dbStudents && dbStudents.length > 0) {
            await autoHealSchoolStudentTerms(dbStudents);
            const filteredSchool = dbStudents.filter(s => {
                return isSchoolStudentInTerm(s, selectedAcademicYear, selectedSemester, studentProfileMap);
            });
            rawSchoolStudents = filteredSchool.map(s => {
                const mapped = mapSchoolStudentRecord(s, studentProfileMap);
                mapped.academicYear = selectedAcademicYear !== 'All' ? selectedAcademicYear : (s.academic_year || '2026-2027');
                mapped.semester = selectedSemester !== 'All' ? selectedSemester : (s.semester || '1st Semester');
                return mapped;
            });
        } else {
            // When table is empty or deleted in Supabase, show strictly empty list
            rawSchoolStudents = [];
        }

        updateSourceCounts();
        renderSchoolStudentsTable(rawSchoolStudents);
        runCrossVerification();
        showToast('Reverted to default school database records.', 'info');
    });
}

async function handleSchoolFile(file, explicitTerm) {
    const chosenTerm = explicitTerm || getSelectedSchoolUploadTerm();
    if (!chosenTerm) {
        if (fileInput) fileInput.value = '';
        return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
        alert('Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
        showToast('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.', 'alert-triangle');
        if (fileInput) fileInput.value = '';
        return;
    }

    uploadedSchoolFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (uploadPrompt) uploadPrompt.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'flex';

    isImportingSchoolStudents = true;
    try {
        const parsedStudents = await parseSchoolExcelOrCsv(file);

        if (parsedStudents.length > 0) {
            // Save term association in persistent cache
            saveSchoolStudentTerms(parsedStudents, chosenTerm.academicYear, chosenTerm.semester);

            rawSchoolStudents = parsedStudents.map(s => ({
                ...s,
                academicYear: chosenTerm.academicYear,
                semester: chosenTerm.semester
            }));
            updateSourceCounts();
            renderSchoolStudentsTable(rawSchoolStudents);
            runCrossVerification();

            // Prepare records for database table 'school_students' with deduplication by student_no
            const seenStudentNos = new Set();
            const dbRecords = [];
            parsedStudents.forEach(s => {
                const sNo = String(s.studentNo || s.studentId || '').trim();
                const fName = s.fullName || `${s.last_name || ''} ${s.first_name || ''}`.trim() || 'Unknown';
                if (!sNo || seenStudentNos.has(sNo) || !fName || fName === 'Unknown') return;
                seenStudentNos.add(sNo);

                const ageNum = parseInt(s.age, 10);
                let dob = s.dateOfBirth || s.birthdate || null;
                if (dob) {
                    const match = String(dob).trim().match(/^\d{4}-\d{2}-\d{2}$/);
                    dob = match ? match[0] : null;
                }

                dbRecords.push({
                    student_no: sNo,
                    full_name: fName,
                    program_name: s.programName || s.course || null,
                    year_level: s.yearLevel || s.year || null,
                    date_of_birth: dob,
                    age: !isNaN(ageNum) ? ageNum : null,
                    gender: s.gender || null,
                    civil_status: s.civilStatus || 'Single',
                    religion: s.religion || null,
                    mobile_number: s.mobileNumber || s.phone || null,
                    email_address: s.emailAddress || s.email || null,
                    father_full_name: s.fatherFullName || null,
                    father_occupation: s.fatherOccupation || null,
                    mother_full_name: s.motherFullName || null,
                    mother_occupation: s.motherOccupation || null,
                    updated_at: new Date().toISOString()
                });
            });

            try {
                // Upsert in batches of 100
                const batchSize = 100;
                let storedCount = 0;
                for (let i = 0; i < dbRecords.length; i += batchSize) {
                    const batch = dbRecords.slice(i, i + batchSize);
                    let { error: upsertErr } = await supabase
                        .from('school_students')
                        .upsert(batch, { onConflict: 'student_no' });

                    if (upsertErr) {
                        console.warn('Upsert on school_students failed, attempting fallback insert:', upsertErr);
                        const { error: insertErr } = await supabase
                            .from('school_students')
                            .insert(batch);
                        if (insertErr) {
                            console.error('Insert error to school_students:', insertErr);
                            throw insertErr;
                        }
                    }
                    storedCount += batch.length;
                }

                // Sync matching student_grantees with the selected academic year & semester only if not already assigned
                try {
                    const { data: sgList } = await supabase.from('student_grantees').select('id, student_no, full_name, last_name, academic_year, semester');
                    if (sgList && sgList.length > 0) {
                        const sgUpdates = [];
                        rawSchoolStudents.forEach(st => {
                            const stNo = String(st.studentNo || '').trim();
                            const stName = String(st.fullName || '').toLowerCase().trim();
                            const match = sgList.find(sg => {
                                if (stNo && String(sg.student_no || '').trim() === stNo) return true;
                                if (stName && String(sg.full_name || '').toLowerCase().trim() === stName) return true;
                                return false;
                            });
                            if (match && (!match.academic_year || !match.semester)) {
                                sgUpdates.push(supabase.from('student_grantees').update({
                                    academic_year: chosenTerm.academicYear,
                                    academicYear: chosenTerm.academicYear,
                                    semester: chosenTerm.semester,
                                    updated_at: new Date().toISOString()
                                }).eq('id', match.id));
                            }
                        });
                        if (sgUpdates.length > 0) {
                            await Promise.all(sgUpdates);
                        }
                    }
                } catch (_) { }

                // Fetch fresh complete records from school_students to guarantee exact count & state
                const freshDbStudents = await fetchAllSchoolStudents();
                if (freshDbStudents && freshDbStudents.length > 0) {
                    let { data: sgData } = await supabase.from('student_grantees').select('*');
                    const studentProfileMap = new Map();
                    (sgData || []).forEach(st => {
                        const sNo = String(st.student_no || st.studentId || '').trim();
                        const sName = String(st.full_name || st.fullName || '').trim().toLowerCase();
                        if (sNo) studentProfileMap.set(sNo, st);
                        if (sName) studentProfileMap.set(sName, st);
                        if (st.uid) studentProfileMap.set(String(st.uid).trim(), st);
                        if (st.id) studentProfileMap.set(String(st.id).trim(), st);
                    });
                    const filteredSchool = freshDbStudents.filter(s => {
                        return isSchoolStudentInTerm(s, chosenTerm.academicYear, chosenTerm.semester, studentProfileMap);
                    });
                    rawSchoolStudents = filteredSchool.map(s => {
                        const mapped = mapSchoolStudentRecord(s, studentProfileMap);
                        mapped.academicYear = chosenTerm.academicYear;
                        mapped.semester = chosenTerm.semester;
                        return mapped;
                    });
                    updateSourceCounts();
                    renderSchoolStudentsTable(rawSchoolStudents);
                    runCrossVerification();
                }

                // Log in audit_logs
                try {
                    await supabase.from('audit_logs').insert([{
                        userName: window.currentAdmin?.username || 'Admin',
                        role: window.currentAdmin?.role || 'Admin',
                        action: `Imported and stored ${storedCount} school student records (${chosenTerm.academicYear} • ${chosenTerm.semester}) from ${file.name} into school_students database`,
                        studentId: 'BATCH_IMPORT'
                    }]);
                } catch (e) {
                    console.warn('Could not write audit log:', e);
                }

                // Log activity notification for Admin (Registrar)
                try {
                    await AdminNotificationService.notifyRecordUpdate({
                        title: 'School Enrollment List Uploaded',
                        message: `Uploaded "${file.name}" with ${storedCount} student records (${chosenTerm.academicYear} • ${chosenTerm.semester}) for Annex 5 cross-matching.`,
                        type: 'success',
                        metadata: { filename: file.name, count: storedCount, academicYear: chosenTerm.academicYear, semester: chosenTerm.semester }
                    });
                } catch (_) { }

                // Notify Super Admin of newly uploaded school student records
                try {
                    await supabase.from('notifications').insert([{
                        studentId: 'superadmin',
                        title: 'New Submission: School Student Records Uploaded',
                        message: `Registrar uploaded "${file.name}" containing ${storedCount} school student records (${chosenTerm.academicYear} • ${chosenTerm.semester}) for scholarship validation.`,
                        type: 'info',
                        isRead: false,
                        timestamp: new Date().toISOString()
                    }]);
                } catch (_) { }

                showToast(`Loaded and stored ${storedCount} school student records for ${chosenTerm.academicYear} • ${chosenTerm.semester}!`, 'check-circle');
            } catch (dbErr) {
                console.error('Database store error:', dbErr);
                showToast(`Parsed ${parsedStudents.length} records. (Database: ${dbErr.message || 'Check school_students table'})`, 'alert-triangle');
            }
        } else {
            alert('Could not extract student records from the file. Make sure it has student names and IDs.');
        }
    } catch (err) {
        console.error('File parsing error:', err);
        alert('Error parsing school student file: ' + err.message);
    } finally {
        isImportingSchoolStudents = false;
    }
}

// Helper: Parse School Students from Excel or CSV
async function parseSchoolExcelOrCsv(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                // Read workbook without cellDates: true to preserve exact serial dates without timezone distortion
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

                const students = [];
                let headerRowIndex = -1;
                const colMap = {};

                // 1. Detect Header Row
                for (let r = 0; r < Math.min(10, rows.length); r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;
                    const normalizedRow = row.map(c => String(c || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\.\,\_\-]/g, ' ').replace(/\s+/g, ' ').trim());

                    const hasId = normalizedRow.some(c => c.includes('student no') || c.includes('student id') || c.includes('id number') || c.includes('control no') || c === 'id');
                    const hasName = normalizedRow.some(c => c.includes('full name') || c.includes('student name') || (c.includes('name') && !c.includes('father') && !c.includes('mother')));
                    const hasTemplate = normalizedRow.some(c => c.includes('father') || c.includes('mother') || c.includes('date of birth') || c.includes('program'));

                    if (hasId || hasName || hasTemplate) {
                        headerRowIndex = r;
                        normalizedRow.forEach((col, idx) => {
                            if (!col) return;

                            // 1. Father fields FIRST (before generic 'full name', 'name', or 'status')
                            if (col.includes('father') || col.includes('tatay') || col.includes('ama')) {
                                if (col.includes('occ') || col.includes('work') || col.includes('job') || col.includes('profess') || col.includes('edu') || col.includes('status')) {
                                    colMap.fatherOccupation = idx;
                                } else {
                                    colMap.fatherFullName = idx;
                                }
                            }
                            // 2. Mother fields FIRST (before generic 'full name', 'name', or 'status')
                            else if (col.includes('mother') || col.includes('nanay') || col.includes('ina')) {
                                if (col.includes('occ') || col.includes('work') || col.includes('job') || col.includes('profess') || col.includes('edu') || col.includes('status')) {
                                    colMap.motherOccupation = idx;
                                } else {
                                    colMap.motherFullName = idx;
                                }
                            }
                            // 3. Student Identification
                            else if (col === 'no' || col === 'no.' || col === '#' || col.includes('student no') || col.includes('stud no') || col.includes('student id') || col.includes('student number') || col.includes('id number') || col.includes('id no') || col.includes('control no') || col === 'id' || col === 'student_no' || col === 'student_id') {
                                colMap.studentNo = idx;
                            }
                            // 4. Student Name (strictly non-parent)
                            else if (col.includes('full name') || col.includes('student name') || col.includes('name of student') || col === 'name' || col === 'student' || col === 'student_name') {
                                colMap.fullName = idx;
                            }
                            else if (col.includes('last name') || col.includes('lastname') || col.includes('surname') || col === 'lname') {
                                colMap.lastName = idx;
                            }
                            else if (col.includes('first name') || col.includes('firstname') || col.includes('given name') || col === 'fname') {
                                colMap.firstName = idx;
                            }
                            else if (col.includes('middle name') || col.includes('middlename') || col.includes('middle initial') || col.includes('m i') || col === 'mi' || col === 'mname') {
                                colMap.middleName = idx;
                            }
                            // 5. Academic Program
                            else if (col.includes('program') || col.includes('course') || col.includes('degree') || col.includes('curriculum')) {
                                colMap.programName = idx;
                            }
                            // 6. Year Level
                            else if (col.includes('year level') || col.includes('year') || col.includes('level') || col === 'yr' || col.includes('yr level') || col.startsWith('yr')) {
                                colMap.yearLevel = idx;
                            }
                            // 7. Date of Birth
                            else if (col.includes('date of birth') || col.includes('birth date') || col.includes('birthdate') || col.includes('dob') || col.includes('birthday') || col === 'bday') {
                                colMap.dateOfBirth = idx;
                            }
                            // 8. Age
                            else if (col === 'age' || col.startsWith('age ') || col.endsWith(' age') || col.includes('years old')) {
                                colMap.age = idx;
                            }
                            // 9. Gender / Sex
                            else if (col.includes('gender') || col.includes('sex')) {
                                colMap.gender = idx;
                            }
                            // 10. Civil Status
                            else if (col.includes('civil status') || col.includes('marital status') || col === 'civil_status' || col === 'marital_status' || col.includes('civil')) {
                                colMap.civilStatus = idx;
                            }
                            // 11. Religion
                            else if (col.includes('religion') || col.includes('faith') || col.includes('sect')) {
                                colMap.religion = idx;
                            }
                            // 12. Mobile / Contact
                            else if (col.includes('mobile') || col.includes('contact') || col.includes('phone') || col.includes('cellphone') || col.includes('tel')) {
                                colMap.mobileNumber = idx;
                            }
                            // 13. Email Address
                            else if (col.includes('email') || col.includes('e mail') || col.includes('mail')) {
                                colMap.emailAddress = idx;
                            }
                            // 14. Status
                            else if (col.includes('status') || col.includes('enrollment') || col.includes('remarks')) {
                                colMap.status = idx;
                            }
                            // 15. Scholarship Program / Type
                            else if (col.includes('scholarship') || col.includes('grant') || col === 'scholar' || col === 'scholarship_name') {
                                colMap.scholarship = idx;
                            }
                        });
                        break;
                    }
                }

                // If no header found, but first row has 15 columns matching standard template layout
                if (headerRowIndex === -1 && rows.length > 0 && rows[0].length >= 14) {
                    colMap.studentNo = 0;
                    colMap.fullName = 1;
                    colMap.programName = 2;
                    colMap.yearLevel = 3;
                    colMap.dateOfBirth = 4;
                    colMap.age = 5;
                    colMap.gender = 6;
                    colMap.civilStatus = 7;
                    colMap.religion = 8;
                    colMap.mobileNumber = 9;
                    colMap.emailAddress = 10;
                    colMap.fatherFullName = 11;
                    colMap.fatherOccupation = 12;
                    colMap.motherFullName = 13;
                    colMap.motherOccupation = 14;
                }

                // 2. Parse data rows
                const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
                for (let r = startRow; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    const rowStr = row.join(' ').toLowerCase();
                    if (rowStr.includes('control no') || rowStr.includes('student no') || (rowStr.includes('last name') && rowStr.includes('first name')) || (rowStr.includes('student no') && rowStr.includes('full name'))) {
                        continue; // Skip any repeated header
                    }

                    if (colMap.studentNo !== undefined || colMap.fullName !== undefined || colMap.lastName !== undefined) {
                        // Header mapped extraction
                        let studentNo = colMap.studentNo !== undefined ? String(row[colMap.studentNo] || '').trim() : '';
                        let fullName = colMap.fullName !== undefined ? String(row[colMap.fullName] || '').trim() : '';
                        let lastName = colMap.lastName !== undefined ? String(row[colMap.lastName] || '').trim() : '';
                        let firstName = colMap.firstName !== undefined ? String(row[colMap.firstName] || '').trim() : '';
                        let mi = colMap.middleName !== undefined ? String(row[colMap.middleName] || '').trim() : '';
                        let programName = colMap.programName !== undefined ? String(row[colMap.programName] || 'BSIT').trim() : 'BSIT';
                        let yearLevel = colMap.yearLevel !== undefined ? String(row[colMap.yearLevel] || '1').trim() : '1';

                        // Date of Birth & Age
                        const rawDob = colMap.dateOfBirth !== undefined ? row[colMap.dateOfBirth] : '';
                        const formattedDob = parseAndFormatDate(rawDob);
                        let ageVal = colMap.age !== undefined ? String(row[colMap.age] || '').trim() : '';
                        if (!ageVal || isNaN(ageVal)) {
                            ageVal = formattedDob ? calculateAge(formattedDob) : '';
                        }

                        let gender = colMap.gender !== undefined ? String(row[colMap.gender] || '').trim() : '';
                        let civilStatus = colMap.civilStatus !== undefined ? String(row[colMap.civilStatus] || 'Single').trim() : 'Single';
                        let religion = colMap.religion !== undefined ? String(row[colMap.religion] || '').trim() : '';
                        let mobileNumber = colMap.mobileNumber !== undefined ? String(row[colMap.mobileNumber] || '').trim() : '';
                        let emailAddress = colMap.emailAddress !== undefined ? String(row[colMap.emailAddress] || '').trim() : '';

                        // Parents information (trim to avoid whitespace-only values)
                        let fatherFullName = colMap.fatherFullName !== undefined ? String(row[colMap.fatherFullName] || '').trim() : '';
                        let fatherOccupation = colMap.fatherOccupation !== undefined ? String(row[colMap.fatherOccupation] || '').trim() : '';
                        let motherFullName = colMap.motherFullName !== undefined ? String(row[colMap.motherFullName] || '').trim() : '';
                        let motherOccupation = colMap.motherOccupation !== undefined ? String(row[colMap.motherOccupation] || '').trim() : '';
                        let status = colMap.status !== undefined ? String(row[colMap.status] || 'Enrolled').trim() : 'Enrolled';
                        let scholarship = colMap.scholarship !== undefined ? String(row[colMap.scholarship] || '').trim() : '';

                        if (!fullName && (lastName || firstName)) {
                            fullName = [lastName, firstName, mi].filter(Boolean).join(', ');
                        }

                        if (!fullName && !studentNo) continue;

                        students.push({
                            studentNo: studentNo,
                            studentId: studentNo,
                            fullName: fullName || `${lastName} ${firstName}`.trim(),
                            first_name: firstName,
                            last_name: lastName,
                            middle_name: mi,
                            scholarship: scholarship || 'TES',
                            scholarshipName: scholarship || 'TES',
                            programName: programName,
                            course: programName,
                            yearLevel: yearLevel,
                            year: yearLevel,
                            dateOfBirth: formattedDob,
                            birthdate: formattedDob,
                            dob: formattedDob,
                            age: ageVal,
                            gender: gender,
                            civilStatus: civilStatus,
                            maritalStatus: civilStatus,
                            religion: religion,
                            mobileNumber: mobileNumber,
                            contactNumber: mobileNumber,
                            phone: mobileNumber,
                            emailAddress: emailAddress,
                            email: emailAddress,
                            authEmail: emailAddress,
                            fatherFullName: fatherFullName,
                            fatherName: fatherFullName,
                            fatherOccupation: fatherOccupation,
                            fatherEduStatus: fatherOccupation,
                            motherFullName: motherFullName,
                            motherName: motherFullName,
                            motherOccupation: motherOccupation,
                            motherEduStatus: motherOccupation,
                            familyDetails: {
                                fatherFullName: fatherFullName,
                                fatherName: fatherFullName,
                                fatherOccupation: fatherOccupation,
                                fatherEduStatus: fatherOccupation,
                                motherFullName: motherFullName,
                                motherName: motherFullName,
                                motherOccupation: motherOccupation,
                                motherEduStatus: motherOccupation,
                                religion: religion,
                                civilStatus: civilStatus
                            },
                            status: status,
                            enrollmentStatus: status
                        });
                    } else {
                        // Heuristic Fallback Extraction
                        const cleanCells = row.map(c => String(c || '').trim()).filter(c => c.length > 0);
                        if (cleanCells.length === 0) continue;

                        let studentNo = '';
                        let fullName = '';
                        let programName = 'BSIT';
                        let yearLevel = '1';
                        let rawDob = '';
                        let ageVal = '';
                        let gender = '';
                        let civilStatus = 'Single';
                        let religion = '';
                        let mobileNumber = '';
                        let emailAddress = '';
                        let fatherFullName = '';
                        let fatherOccupation = '';
                        let motherFullName = '';
                        let motherOccupation = '';
                        let status = 'Enrolled';

                        cleanCells.forEach(cell => {
                            if (/^\d{6,15}$/.test(cell) || /^\d{4}-\d{4,6}$/.test(cell)) {
                                studentNo = cell;
                            } else if (cell.includes('@') && cell.includes('.')) {
                                emailAddress = cell;
                            } else if (cell.toLowerCase() === 'male' || cell.toLowerCase() === 'female') {
                                gender = cell.charAt(0).toUpperCase() + cell.slice(1).toLowerCase();
                            } else if (/^(single|married|widowed|separated)$/i.test(cell)) {
                                civilStatus = cell.charAt(0).toUpperCase() + cell.slice(1).toLowerCase();
                            } else if (/^(09|\+639)\d{9}$/.test(cell.replace(/[-\s]/g, ''))) {
                                mobileNumber = cell;
                            } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cell) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(cell) || (Number(cell) > 1000 && Number(cell) < 75000)) {
                                rawDob = cell;
                            } else if (/^\d{1,2}$/.test(cell) && parseInt(cell) >= 15 && parseInt(cell) <= 80 && !ageVal) {
                                ageVal = cell;
                            } else if (cell.toLowerCase().includes('enrolled') || cell.toLowerCase().includes('active') || cell.toLowerCase().includes('drop') || cell.toLowerCase().includes('loa') || cell.toLowerCase().includes('graduat') || cell.toLowerCase().includes('waiv')) {
                                status = cell;
                            } else if (cell.toUpperCase().startsWith('BS') || cell.toLowerCase().includes('bachelor') || cell.toLowerCase().includes('tech')) {
                                programName = cell;
                            } else if (/^[1-5]$/.test(cell) || cell.toLowerCase().includes('year')) {
                                yearLevel = cell.replace(/[^0-9]/g, '') || '1';
                            } else if (cell.includes(' ') && cell.length > 4 && !fullName) {
                                fullName = cell;
                            }
                        });

                        if (!fullName && cleanCells.length >= 2) {
                            fullName = cleanCells.slice(0, 2).join(' ');
                        }

                        const formattedDob = parseAndFormatDate(rawDob);
                        const calculatedAge = ageVal || (formattedDob ? calculateAge(formattedDob) : '');

                        if (fullName || studentNo) {
                            students.push({
                                studentNo: studentNo,
                                studentId: studentNo,
                                fullName: fullName || 'N/A',
                                scholarship: 'TES',
                                scholarshipName: 'TES',
                                programName: programName,
                                course: programName,
                                yearLevel: yearLevel,
                                year: yearLevel,
                                dateOfBirth: formattedDob,
                                birthdate: formattedDob,
                                dob: formattedDob,
                                age: calculatedAge,
                                gender: gender,
                                civilStatus: civilStatus,
                                maritalStatus: civilStatus,
                                religion: religion,
                                mobileNumber: mobileNumber,
                                contactNumber: mobileNumber,
                                phone: mobileNumber,
                                emailAddress: emailAddress,
                                email: emailAddress,
                                authEmail: emailAddress,
                                fatherFullName: fatherFullName,
                                fatherName: fatherFullName,
                                fatherOccupation: fatherOccupation,
                                fatherEduStatus: fatherOccupation,
                                motherFullName: motherFullName,
                                motherName: motherFullName,
                                motherOccupation: motherOccupation,
                                motherEduStatus: motherOccupation,
                                familyDetails: {
                                    fatherFullName: fatherFullName,
                                    fatherName: fatherFullName,
                                    fatherOccupation: fatherOccupation,
                                    fatherEduStatus: fatherOccupation,
                                    motherFullName: motherFullName,
                                    motherName: motherFullName,
                                    motherOccupation: motherOccupation,
                                    motherEduStatus: motherOccupation,
                                    religion: religion,
                                    civilStatus: civilStatus
                                },
                                status: status,
                                enrollmentStatus: status
                            });
                        }
                    }
                }
                resolve(students);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Helper: Parse School Students from PDF
async function parseSchoolPdf(file) {
    if (!window.pdfjsLib) window.pdfjsLib = window['pdfjs-dist/build/pdf'];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    return parseTextLinesToStudents(fullText);
}

// Helper: Parse School Students from DOCX
async function parseSchoolDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return parseTextLinesToStudents(result.value || '');
}

function parseTextLinesToStudents(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const students = [];
    lines.forEach(line => {
        const clean = line.replace(/^[\d\.\-\)\s]+/, '').trim();
        if (clean.length > 4 && !clean.toLowerCase().includes('student name')) {
            const parts = clean.split(/[,\t]+/).map(p => p.trim());
            const fullName = parts.join(' ');
            students.push({
                fullName,
                studentId: '',
                course: 'BSIT',
                year: '1',
                status: 'Enrolled'
            });
        }
    });
    return students;
}

// ── 4. Cross-Verification Engine Execution ──────────────────────────
function runCrossVerification(forceFresh = false) {
    // If either table is empty or deleted from Supabase, clear verification results
    if (!rawSuperAdminGrantees || rawSuperAdminGrantees.length === 0 || !rawSchoolStudents || rawSchoolStudents.length === 0) {
        verifiedForm2List = [];
        verifiedForm3List = [];
        needsReviewList = [];
        AnnexSyncService.clearVerifiedData({ clearSupabase: false, academicYear: selectedAcademicYear, semester: selectedSemester });
        updateKPIMetrics();
        renderForm2Table(verifiedForm2List);
        renderForm3Table(verifiedForm3List);
        renderReviewQueue(needsReviewList);
        return;
    }

    const result = VerificationService.runBatchVerification(rawSuperAdminGrantees, rawSchoolStudents);

    // Check if we have previously verified/resolved data from Admin Review Queue or Database (bypassed if forceFresh)
    const savedSync = forceFresh ? null : AnnexSyncService.getVerifiedData(selectedAcademicYear, selectedSemester);
    if (savedSync && (savedSync.form2List.length > 0 || savedSync.form3List.length > 0)) {
        const resolvedForm2Map = new Map(savedSync.form2List.map(item => [AnnexSyncService.getUniqueKey(item), item]));
        const resolvedForm3Map = new Map(savedSync.form3List.map(item => [AnnexSyncService.getUniqueKey(item), item]));

        const combinedForm2 = [];
        const combinedForm3 = [];
        const remainingReview = [];
        const processedKeys = new Set();

        const allItems = [...result.form2List, ...result.form3List, ...result.needsReviewList];
        for (const item of allItems) {
            const key = AnnexSyncService.getUniqueKey(item);
            if (processedKeys.has(key)) continue;

            const savedF2 = resolvedForm2Map.get(key) || savedSync.form2List.find(s => AnnexSyncService.isSameStudent(s, item));
            const savedF3 = resolvedForm3Map.get(key) || savedSync.form3List.find(s => AnnexSyncService.isSameStudent(s, item));

            if (savedF2) {
                const gL = (item.grantee?.last_name || item.grantee?.lastName || '').trim().toLowerCase();
                const sL = (savedF2.matchedStudent?.lastName || savedF2.matchedStudent?.last_name || '').trim().toLowerCase();
                const isValid = !sL || !gL || gL === sL || gL.includes(sL) || sL.includes(gL) || (VerificationService.levenshteinSimilarity && VerificationService.levenshteinSimilarity(gL, sL) >= 0.75);
                if (isValid) {
                    processedKeys.add(key);
                    processedKeys.add(AnnexSyncService.getUniqueKey(savedF2));
                    combinedForm2.push({ ...item, ...savedF2, classification: 'MATCHED_FORM2', isEnrolled: true });
                } else {
                    processedKeys.add(key);
                    if (item.classification === 'MATCHED_FORM2') combinedForm2.push(item);
                    else if (item.classification === 'INACTIVE_FORM3') combinedForm3.push(item);
                    else remainingReview.push(item);
                }
            } else if (savedF3) {
                processedKeys.add(key);
                processedKeys.add(AnnexSyncService.getUniqueKey(savedF3));
                combinedForm3.push({ ...item, ...savedF3, classification: 'INACTIVE_FORM3', isEnrolled: false });
            } else if (item.classification === 'MATCHED_FORM2') {
                processedKeys.add(key);
                combinedForm2.push(item);
            } else if (item.classification === 'INACTIVE_FORM3') {
                processedKeys.add(key);
                combinedForm3.push(item);
            } else {
                processedKeys.add(key);
                remainingReview.push(item);
            }
        }

        for (const savedItem of savedSync.form2List || []) {
            const key = AnnexSyncService.getUniqueKey(savedItem);
            const alreadyInF2 = combinedForm2.some(c => AnnexSyncService.isSameStudent(c, savedItem));
            const stillExists = rawSuperAdminGrantees.some(g => AnnexSyncService.isSameStudent(savedItem, g));
            if (!alreadyInF2 && stillExists) {
                processedKeys.add(key);
                combinedForm2.push(savedItem);
            }
        }
        for (const savedItem of savedSync.form3List || []) {
            const key = AnnexSyncService.getUniqueKey(savedItem);
            const alreadyInF3 = combinedForm3.some(c => AnnexSyncService.isSameStudent(c, savedItem));
            const stillExists = rawSuperAdminGrantees.some(g => AnnexSyncService.isSameStudent(savedItem, g));
            if (!alreadyInF3 && stillExists) {
                processedKeys.add(key);
                combinedForm3.push(savedItem);
            }
        }

        const deduped = AnnexSyncService.deduplicateLists(combinedForm2, combinedForm3, remainingReview);
        verifiedForm2List = deduped.form2List;
        verifiedForm3List = deduped.form3List;
        needsReviewList = deduped.needsReviewList;
    } else {
        const deduped = AnnexSyncService.deduplicateLists(result.form2List, result.form3List, result.needsReviewList);
        verifiedForm2List = deduped.form2List;
        verifiedForm3List = deduped.form3List;
        needsReviewList = deduped.needsReviewList;
    }

    // Persist and broadcast verified Form 2 / Form 3 state to Supabase so Student Grantees stays in sync
    AnnexSyncService.saveVerifiedData({
        form2List: verifiedForm2List,
        form3List: verifiedForm3List,
        needsReviewList: needsReviewList,
        updatedBy: window.currentAdmin?.username || 'Admin',
        syncToDb: (verifiedForm2List.length > 0 || verifiedForm3List.length > 0),
        academicYear: selectedAcademicYear,
        semester: selectedSemester
    });

    updateKPIMetrics();
    renderForm2Table(verifiedForm2List);
    renderForm3Table(verifiedForm3List);
    renderReviewQueue(needsReviewList);
}

// ── 5. KPI Metrics Updater ──────────────────────────────────────────
function updateKPIMetrics() {
    const total = rawSuperAdminGrantees.length;
    const f2Count = verifiedForm2List.length;
    const f3Count = verifiedForm3List.length;
    const revCount = needsReviewList.length;
    const f2TotalAmount = f2Count * 10000;

    const elTotal = document.getElementById('stat-kpi-total');
    const elF2 = document.getElementById('stat-kpi-form2');
    const elF3 = document.getElementById('stat-kpi-form3');
    const elRev = document.getElementById('stat-kpi-review');

    if (elTotal) elTotal.textContent = total;
    if (elF2) elF2.textContent = f2Count;
    if (elF3) elF3.textContent = f3Count;
    if (elRev) elRev.textContent = revCount;

    const badgeF2 = document.getElementById('badge-form2-count');
    const badgeF3 = document.getElementById('badge-form3-count');
    const badgeRev = document.getElementById('badge-review-count');

    if (badgeF2) badgeF2.textContent = f2Count;
    if (badgeF3) badgeF3.textContent = f3Count;
    if (badgeRev) badgeRev.textContent = revCount;

    const statF2Count = document.getElementById('stat-form2-count');
    const statF2Amt = document.getElementById('stat-form2-amount');
    const statF3Count = document.getElementById('stat-form3-count');

    if (statF2Count) statF2Count.textContent = `${f2Count} Enrolled Grantees`;
    if (statF2Amt) statF2Amt.textContent = `\u20B1${f2TotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} Total Billing`;
    if (statF3Count) statF3Count.textContent = `${f3Count} Not Included Grantees`;
}

// ── 6. Render Form 2 Table (Enrolled / Eligible Grantees) ───────────
function renderForm2Table(items) {
    const tbody = document.getElementById('tbody-form2');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 36px; color: var(--text-secondary);">No verified enrolled grantees for Form 2.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee || {};
        const student = item.matchedStudent || {};
        const rawNameStr = student.fullName || student.full_name || student.name || grantee.name || grantee.fullName || '';
        let name = VerificationService.normalizeName(rawNameStr);
        if (!name.lastName && !name.firstName) {
            const l = (grantee.last_name || grantee.lastName || student.last_name || student.lastName || '').trim();
            const f = (grantee.first_name || grantee.firstName || student.first_name || student.firstName || '').trim();
            const m = (grantee.middle_name || grantee.middleName || student.middle_name || student.middleName || '').trim();
            name = { lastName: l || 'N/A', firstName: f || 'N/A', mi: m ? m.charAt(0).toUpperCase() : '' };
        }
        const sa = AnnexSyncService.extractAuthenticSaNumber(student, grantee);
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || student.year_level || grantee.year || grantee.year_level || '1').replace(/[^0-9]/g, '') || '1';
        const email = student.email || student.authEmail || 'N/A';
        const phone = student.contactNumber || student.phone || 'N/A';
        const studentId = student.studentId || student.student_no || student.studentNo || grantee.student_id || grantee.studentNo || 'N/A';
        const degree = student.program_name || student.programName || student.course || grantee.course || grantee.program_name || 'BSIT';
        const itemKey = AnnexSyncService.getUniqueKey(item);

        return `
            <tr class="annex-clickable-row" data-index="${idx}" data-key="${itemKey}" style="cursor: pointer;" title="Click to view student details and categorization">
                <td style="font-weight: 700; color: var(--primary-color);">${ctrl}</td>
                <td><span style="font-weight: 600;">${studentId}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(15,50,96,0.06); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${degree}</td>
                <td style="text-align: center;">${year}</td>
                <td><span style="font-size: 11px; color: var(--text-secondary);">${email}</span></td>
                <td><span style="font-size: 11px;">${phone}</span></td>
                <td style="text-align: center;"><span class="badge-batch-pill">${String(grantee.batch || grantee.tes_batch || resolveGranteeBatch(grantee) || '1.2').replace(/^batch\s*/i, '').trim()}</span></td>
                <td style="font-weight: 600; color: #2E7D32;">\u20B110,000.00</td>
                <td style="text-align: center; color: var(--text-secondary);">\u20B10.00</td>
                <td style="font-weight: 700; color: #2E7D32;">\u20B110,000.00</td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.annex-clickable-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = parseInt(row.getAttribute('data-index'), 10);
            const clickedItem = items[idx];
            if (clickedItem) {
                openStudentDetailsModal(clickedItem, 'form2', idx);
            }
        });
    });
}

// ── 7. Render Form 3 Table (Not Included / Special Status) ──────────
function renderForm3Table(items) {
    const tbody = document.getElementById('tbody-form3');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 36px; color: var(--text-secondary);">No Form 3 special status records.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee || {};
        const student = item.matchedStudent || {};
        const rawNameStr = student.fullName || student.full_name || student.name || grantee.name || grantee.fullName || '';
        let name = VerificationService.normalizeName(rawNameStr);
        if (!name.lastName && !name.firstName) {
            const l = (grantee.last_name || grantee.lastName || student.last_name || student.lastName || '').trim();
            const f = (grantee.first_name || grantee.firstName || student.first_name || student.firstName || '').trim();
            const m = (grantee.middle_name || grantee.middleName || student.middle_name || student.middleName || '').trim();
            name = { lastName: l || 'N/A', firstName: f || 'N/A', mi: m ? m.charAt(0).toUpperCase() : '' };
        }
        const sa = AnnexSyncService.extractAuthenticSaNumber(student, grantee);
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || student.year_level || grantee.year || grantee.year_level || '1').replace(/[^0-9]/g, '') || '1';
        const studentId = student.studentId || student.student_no || student.studentNo || grantee.student_id || grantee.studentNo || 'N/A';
        const degree = student.program_name || student.programName || student.course || grantee.course || grantee.program_name || 'BSIT';
        const reason = item.specialStatusReason || 'Not enrolled';
        const remarks = item.remarks || (reason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${reason}`);
        const itemKey = AnnexSyncService.getUniqueKey(item);

        let badgeStyle = 'background: rgba(255,152,0,0.12); color: #E65100;';
        if (reason === 'Dropped' || reason === 'Waived') badgeStyle = 'background: rgba(244,67,54,0.12); color: #D32F2F;';
        if (reason === 'Graduated') badgeStyle = 'background: rgba(76,175,80,0.12); color: #2E7D32;';

        return `
            <tr class="annex-clickable-row" data-index="${idx}" data-key="${itemKey}" style="cursor: pointer;" title="Click to view student details and categorization">
                <td style="font-weight: 700; color: #E65100;">${ctrl}</td>
                <td><span style="font-weight: 600;">${studentId}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(255,143,0,0.08); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${degree}</td>
                <td style="text-align: center;">${year}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                        ${reason}
                    </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 11px;">${remarks}</td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.annex-clickable-row').forEach(row => {
        row.addEventListener('click', () => {
            const idx = parseInt(row.getAttribute('data-index'), 10);
            const clickedItem = items[idx];
            if (clickedItem) {
                openStudentDetailsModal(clickedItem, 'form3', idx);
            }
        });
    });
}

// ── 8. Render Needs Review Queue ────────────────────────────────────
function renderReviewQueue(items) {
    const container = document.getElementById('review-items-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px; background: rgba(16,185,129,0.04); border: 1.5px dashed rgba(16,185,129,0.3); border-radius: 16px;">
                <i class="icon-check-circle-2" style="font-size: 36px; color: #10b981; margin-bottom: 8px;"></i>
                <h4 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #065f46;">All Records Categorized & Verified</h4>
                <p style="margin: 0; font-size: 13px; color: #047857;">All Super Admin scholarship grantees have been successfully verified into Form 2 or Form 3.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        const grantee = item.grantee;
        const student = item.matchedStudent;
        const confidence = item.confidence;
        const discrepancies = item.discrepancies || [];

        const gLast = (grantee.last_name || grantee.lastName || '').trim();
        const gFirst = (grantee.first_name || grantee.firstName || '').trim();
        const gMiddle = (grantee.middle_name || grantee.middleName || '').trim();
        let granteeName = (grantee.name || grantee.fullName || '').replace(/^,\s*|,\s*$/g, '').trim();
        if (!granteeName || granteeName === ',') {
            if (gLast && gFirst) {
                granteeName = `${gLast}, ${gFirst}${gMiddle ? ' ' + gMiddle : ''}`;
            } else if (gFirst || gLast) {
                granteeName = `${gFirst} ${gLast}`.trim();
            } else {
                granteeName = 'Grantee';
            }
        }

        let studentName = 'No Matching Record in School File';
        if (student) {
            const sLast = (student.last_name || student.lastName || '').trim();
            const sFirst = (student.first_name || student.firstName || '').trim();
            const sMiddle = (student.middle_name || student.middleName || student.middle_initial || '').trim();
            studentName = (student.fullName || student.full_name || student.name || '').replace(/^,\s*|,\s*$/g, '').trim();
            if (!studentName || studentName === ',') {
                if (sLast && sFirst) {
                    studentName = `${sLast}, ${sFirst}${sMiddle ? ' ' + sMiddle : ''}`;
                } else if (sFirst || sLast) {
                    studentName = `${sFirst} ${sLast}`.trim();
                } else {
                    studentName = 'Enrolled Student';
                }
            }
        }

        const granteeId = grantee.student_id || grantee.studentId || grantee.student_no || grantee.studentNo || 'Unassigned';
        const granteeProg = grantee.course || grantee.program || grantee.program_name || 'N/A';
        const studentProg = student ? (student.program_name || student.course || student.program || 'N/A') : 'N/A';

        return `
            <div class="card" style="padding: 18px 22px; border-left: 4px solid #E53935; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 6px; background: rgba(229,57,53,0.1); color: #E53935;">
                            #${idx + 1}
                        </span>
                        <div>
                            <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary);">${granteeName}</h4>
                            <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-secondary);">
                                ID: <strong>${granteeId}</strong> • Program: <strong>${granteeProg}</strong> • Batch: <strong>${resolveGranteeBatch(grantee)}</strong>
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: rgba(229,57,53,0.1); color: #D32F2F;">
                            ${confidence > 0 ? `Match Confidence: ${confidence}%` : '<i class="icon-x-circle" style="font-size: 12px; margin-right: 4px;"></i> Unmatched Record (0%)'}
                        </span>
                    </div>
                </div>

                <!-- Comparison Row -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: rgba(0,0,0,0.02); padding: 12px 16px; border-radius: 10px; font-size: 12px;">
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">Super Admin Grantee List:</span>
                        <div>Name: <strong>${granteeName}</strong></div>
                        <div>Program: <strong>${granteeProg}</strong></div>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">School Student Masterlist:</span>
                        <div style="${!student ? 'color: #b91c1c; font-style: italic;' : ''}">Name: <strong>${studentName}</strong></div>
                        <div>Status: <span style="font-weight: 700; color: ${item.isEnrolled ? '#2E7D32' : '#E65100'};">${student?.status || student?.enrollmentStatus || 'Not in School File'}</span></div>
                    </div>
                </div>

                <!-- Discrepancy Chips -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${discrepancies.map(d => `
                        <span style="padding: 3px 10px; border-radius: 8px; background: rgba(229,57,53,0.08); color: #C62828; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="icon-alert-circle" style="font-size: 12px;"></i> ${d}
                        </span>
                    `).join('')}
                </div>

                <!-- Action Toolbar -->
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
                    <button class="btn-review-approve" data-review-index="${idx}" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i class="icon-check"></i> Approve to Form 2 (Enrolled)
                    </button>
                    <button class="btn-review-categorize" data-review-index="${idx}" style="background: linear-gradient(135deg, #FF8F00, #F57C00); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i class="icon-tag"></i> Categorize to Form 3
                    </button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.btn-review-approve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-review-index'));
            resolveReviewItem(idx, 'form2');
        });
    });

    document.querySelectorAll('.btn-review-categorize').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-review-index'));
            openResolutionModal(idx);
        });
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ── 9. Review Resolution Actions ────────────────────────────────────
function resolveReviewItem(reviewIndex, targetForm, specialReason = 'Not enrolled', remarks = '') {
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    needsReviewList.splice(reviewIndex, 1);

    if (targetForm === 'form2') {
        item.classification = 'MATCHED_FORM2';
        item.isEnrolled = true;
        if (!item.matchedStudent) {
            item.matchedStudent = {
                fullName: item.grantee?.name || '',
                studentId: item.grantee?.student_id || '',
                course: item.grantee?.course || 'BSIT',
                year: item.grantee?.year || '1',
                status: 'Enrolled'
            };
        } else {
            item.matchedStudent.status = 'Enrolled';
        }
        verifiedForm2List.push(item);
        showToast(`Approved ${item.grantee?.name || 'Grantee'} to Form 2 (Enrolled)`, 'check-circle');
    } else {
        item.classification = 'INACTIVE_FORM3';
        item.isEnrolled = false;
        item.specialStatusReason = specialReason;
        item.remarks = remarks || `Categorized: ${specialReason}`;
        if (!item.matchedStudent) {
            item.matchedStudent = {
                fullName: item.grantee?.name || '',
                studentId: item.grantee?.student_id || '',
                course: item.grantee?.course || 'BSIT',
                year: item.grantee?.year || '1',
                status: specialReason
            };
        } else {
            item.matchedStudent.status = specialReason;
        }
        verifiedForm3List.push(item);
        showToast(`Categorized ${item.grantee?.name || 'Grantee'} to Form 3 (${specialReason})`, 'tag');
    }

    // Save and broadcast synchronized state across views
    const synced = AnnexSyncService.saveVerifiedData({
        form2List: verifiedForm2List,
        form3List: verifiedForm3List,
        needsReviewList: needsReviewList,
        updatedBy: window.currentAdmin?.username || 'Admin',
        academicYear: selectedAcademicYear,
        semester: selectedSemester
    });
    if (synced) {
        verifiedForm2List = synced.form2List;
        verifiedForm3List = synced.form3List;
        needsReviewList = synced.needsReviewList;
    }

    // Audit log entry for resolution
    try {
        const granteeName = item.grantee?.name || `${item.grantee?.last_name || ''}, ${item.grantee?.first_name || ''}`.trim();
        supabase.from('audit_logs').insert([{
            userName: window.currentAdmin?.username || 'Admin',
            role: window.currentAdmin?.role || 'Admin',
            action: `Review Queue: Categorized ${granteeName} to ${targetForm === 'form2' ? 'Form 2 (Enrolled)' : `Form 3 (${specialReason})`}`,
            studentId: item.grantee?.student_id || item.matchedStudent?.studentId || 'N/A'
        }]).then(() => { }).catch(err => console.warn('Could not record audit log:', err));

        // Dispatch activity notification
        AdminNotificationService.notifyRecordUpdate({
            title: 'Review Queue Item Resolved',
            message: `Grantee "${granteeName}" resolved to Annex ${targetForm === 'form2' ? 'Form 2 (Enrolled)' : `Form 3 (${specialReason})`}.`,
            type: targetForm === 'form2' ? 'success' : 'warning',
            metadata: { student: granteeName, form: targetForm, reason: specialReason }
        }).catch(() => { });
    } catch (e) {
        console.warn('Audit log error:', e);
    }

    updateKPIMetrics();
    renderForm2Table(verifiedForm2List);
    renderForm3Table(verifiedForm3List);
    renderReviewQueue(needsReviewList);
}

// ── 10. Resolution & Student Details Modal Handlers ──────────────────
const resModal = document.getElementById('resolution-modal');
const btnCloseRes = document.getElementById('btn-close-resolution');
const btnCancelRes = document.getElementById('btn-cancel-resolution');
const btnConfirmRes = document.getElementById('btn-confirm-resolution');
const btnClassifyForm3 = document.getElementById('btn-classify-form3');
const btnActionForm2 = document.getElementById('btn-action-form2');
const modalTargetLabel = document.getElementById('modal-target-label');
const modalResolutionTitle = document.getElementById('modal-resolution-title');
const modalGranteeName = document.getElementById('modal-grantee-name');
const modalStatusBadge = document.getElementById('modal-status-badge');
const modalStudentId = document.getElementById('modal-student-id');
const modalSaNumber = document.getElementById('modal-sa-number');
const modalProgram = document.getElementById('modal-program');
const modalYearLevel = document.getElementById('modal-year-level');
const modalGender = document.getElementById('modal-gender');
const modalBirthdate = document.getElementById('modal-birthdate');
const modalBatch = document.getElementById('modal-batch');
const modalEmail = document.getElementById('modal-email');
const modalPhone = document.getElementById('modal-phone');
const modalTargetForm = document.getElementById('modal-target-form');
const modalForm3ReasonGroup = document.getElementById('modal-form3-reason-group');
const modalForm3Reason = document.getElementById('modal-form3-reason');
const modalRemarks = document.getElementById('modal-remarks');

function getItemDisplayName(item) {
    if (!item) return 'Grantee';
    const g = item.grantee || {};
    const s = item.matchedStudent || {};
    const raw = s.fullName || s.full_name || s.name || g.name || g.fullName || '';
    if (raw && !raw.startsWith(',') && !raw.endsWith(',')) return raw;
    const l = (g.last_name || g.lastName || s.last_name || s.lastName || '').trim();
    const f = (g.first_name || g.firstName || s.first_name || s.firstName || '').trim();
    const m = (g.middle_name || g.middleName || s.middle_name || s.middleName || '').trim();
    if (l && f) return `${l}, ${f}${m ? ' ' + m.charAt(0).toUpperCase() + '.' : ''}`;
    return l || f || 'Grantee';
}

function refreshFormTables() {
    const inputF2 = document.getElementById('search-form2');
    const q2 = inputF2 ? inputF2.value.toLowerCase().trim() : '';
    const f2List = q2 ? verifiedForm2List.filter(it => {
        const n = (it.matchedStudent?.fullName || it.grantee?.name || '').toLowerCase();
        const id = (it.matchedStudent?.studentId || it.grantee?.student_id || '').toLowerCase();
        const sa = (it.matchedStudent?.saNumber || it.grantee?.saNumber || '').toLowerCase();
        return n.includes(q2) || id.includes(q2) || sa.includes(q2);
    }) : verifiedForm2List;
    renderForm2Table(f2List);

    const inputF3 = document.getElementById('search-form3');
    const q3 = inputF3 ? inputF3.value.toLowerCase().trim() : '';
    const f3List = q3 ? verifiedForm3List.filter(it => {
        const n = (it.matchedStudent?.fullName || it.grantee?.name || '').toLowerCase();
        const id = (it.matchedStudent?.studentId || it.grantee?.student_id || '').toLowerCase();
        const sa = (it.matchedStudent?.saNumber || it.grantee?.saNumber || '').toLowerCase();
        return n.includes(q3) || id.includes(q3) || sa.includes(q3);
    }) : verifiedForm3List;
    renderForm3Table(f3List);
}

function executeClassifyUnderForm3() {
    const reason = modalForm3Reason ? modalForm3Reason.value : 'Not enrolled';
    const remarks = modalRemarks ? modalRemarks.value.trim() : '';

    if (activeResolutionSource === 'review') {
        const revIdx = needsReviewList.findIndex(x => AnnexSyncService.isSameStudent(x, activeResolutionItem) || AnnexSyncService.getUniqueKey(x) === activeResolutionItemKey);
        resolveReviewItem(revIdx !== -1 ? revIdx : 0, 'form3', reason, remarks);
        closeResolutionModal();
        return;
    }

    const itemKey = activeResolutionItemKey;
    let item = null;

    // Check if item is in Form 2
    const f2Idx = verifiedForm2List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || (activeResolutionItem && AnnexSyncService.isSameStudent(x, activeResolutionItem)));
    if (f2Idx !== -1) {
        item = verifiedForm2List[f2Idx];
        verifiedForm2List.splice(f2Idx, 1);
    } else {
        const f3Idx = verifiedForm3List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || (activeResolutionItem && AnnexSyncService.isSameStudent(x, activeResolutionItem)));
        if (f3Idx !== -1) {
            item = verifiedForm3List[f3Idx];
        } else if (activeResolutionItem) {
            item = { ...activeResolutionItem };
        }
    }

    if (item) {
        item.classification = 'INACTIVE_FORM3';
        item.isEnrolled = false;
        item.specialStatusReason = reason;
        item.remarks = remarks || `Categorized: ${reason}`;
        if (item.matchedStudent) {
            item.matchedStudent.status = reason;
        }

        const existingF3 = verifiedForm3List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || AnnexSyncService.isSameStudent(x, item));
        if (existingF3 !== -1) {
            verifiedForm3List[existingF3] = item;
        } else {
            verifiedForm3List.push(item);
        }

        // Persist to sync storage & Supabase
        AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            needsReviewList: needsReviewList,
            updatedBy: window.currentAdmin?.username || 'Admin',
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });

        const displayName = getItemDisplayName(item);
        try {
            supabase.from('audit_logs').insert([{
                userName: window.currentAdmin?.username || 'Admin',
                role: window.currentAdmin?.role || 'Admin',
                action: `Classified student ${displayName} under Form 3 (${reason})`,
                studentId: item.grantee?.student_id || item.matchedStudent?.studentId || 'N/A'
            }]).then(() => { }).catch(e => console.warn(e));

            AdminNotificationService.notifyRecordUpdate({
                title: 'Student Classified under Form 3',
                message: `${displayName} has been classified under Form 3 (Status Reason: ${reason}).`,
                type: 'warning',
                metadata: { student: displayName, form: 'form3', reason }
            }).catch(() => { });
        } catch (e) {
            console.warn(e);
        }

        updateKPIMetrics();
        refreshFormTables();
        showToast(`Classified ${displayName} under Form 3 (${reason})`, 'tag');
    }

    closeResolutionModal();
}

function executeReclassifyToForm2() {
    const remarks = modalRemarks ? modalRemarks.value.trim() : '';

    if (activeResolutionSource === 'review') {
        const revIdx = needsReviewList.findIndex(x => AnnexSyncService.isSameStudent(x, activeResolutionItem) || AnnexSyncService.getUniqueKey(x) === activeResolutionItemKey);
        resolveReviewItem(revIdx !== -1 ? revIdx : 0, 'form2', 'Enrolled', remarks);
        closeResolutionModal();
        return;
    }

    const itemKey = activeResolutionItemKey;
    let item = null;

    const f3Idx = verifiedForm3List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || (activeResolutionItem && AnnexSyncService.isSameStudent(x, activeResolutionItem)));
    if (f3Idx !== -1) {
        item = verifiedForm3List[f3Idx];
        verifiedForm3List.splice(f3Idx, 1);
    } else {
        const f2Idx = verifiedForm2List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || (activeResolutionItem && AnnexSyncService.isSameStudent(x, activeResolutionItem)));
        if (f2Idx !== -1) item = verifiedForm2List[f2Idx];
        else if (activeResolutionItem) item = { ...activeResolutionItem };
    }

    if (item) {
        item.classification = 'MATCHED_FORM2';
        item.isEnrolled = true;
        delete item.specialStatusReason;
        item.remarks = remarks;
        if (item.matchedStudent) {
            item.matchedStudent.status = 'Enrolled';
        }

        const existingF2 = verifiedForm2List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || AnnexSyncService.isSameStudent(x, item));
        if (existingF2 !== -1) {
            verifiedForm2List[existingF2] = item;
        } else {
            verifiedForm2List.push(item);
        }

        AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            needsReviewList: needsReviewList,
            updatedBy: window.currentAdmin?.username || 'Admin',
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });

        const displayName = getItemDisplayName(item);
        try {
            supabase.from('audit_logs').insert([{
                userName: window.currentAdmin?.username || 'Admin',
                role: window.currentAdmin?.role || 'Admin',
                action: `Reclassified student ${displayName} to Form 2 (Enrolled)`,
                studentId: item.grantee?.student_id || item.matchedStudent?.studentId || 'N/A'
            }]).then(() => { }).catch(e => console.warn(e));

            AdminNotificationService.notifyRecordUpdate({
                title: 'Student Reclassified to Form 2',
                message: `${displayName} has been approved to Annex Form 2 (Enrolled).`,
                type: 'success',
                metadata: { student: displayName, form: 'form2' }
            }).catch(() => { });
        } catch (e) {
            console.warn(e);
        }

        updateKPIMetrics();
        refreshFormTables();
        showToast(`Approved ${displayName} to Form 2 (Enrolled)`, 'check-circle');
    }

    closeResolutionModal();
}

function openStudentDetailsModal(item, source = 'form2', index = -1) {
    if (!item) return;
    activeResolutionSource = source;
    activeResolutionItem = item;
    activeResolutionItemKey = AnnexSyncService.getUniqueKey(item);

    const grantee = item.grantee || {};
    const student = item.matchedStudent || {};

    // 1. Modal Header Title
    if (modalResolutionTitle) {
        modalResolutionTitle.textContent = source === 'review'
            ? 'Manual Grantee Categorization'
            : 'Student Details & Categorization';
    }

    // 2. Full Name
    const rawNameStr = student.fullName || student.full_name || student.name || grantee.name || grantee.fullName || '';
    let nameObj = VerificationService.normalizeName(rawNameStr);
    if (!nameObj.lastName && !nameObj.firstName) {
        const l = (grantee.last_name || grantee.lastName || student.last_name || student.lastName || '').trim();
        const f = (grantee.first_name || grantee.firstName || student.first_name || student.firstName || '').trim();
        const m = (grantee.middle_name || grantee.middleName || student.middle_name || student.middleName || '').trim();
        nameObj = { lastName: l || 'N/A', firstName: f || 'N/A', mi: m ? m.charAt(0).toUpperCase() : '' };
    }
    const displayName = (nameObj.lastName && nameObj.firstName && nameObj.lastName !== 'N/A')
        ? `${nameObj.lastName}, ${nameObj.firstName}${nameObj.mi ? ' ' + nameObj.mi + '.' : ''}`
        : (rawNameStr || 'Student Grantee');

    if (modalGranteeName) modalGranteeName.textContent = displayName;

    // 3. Student ID
    const studentId = student.studentId || student.student_no || student.studentNo || grantee.student_id || grantee.studentNo || grantee.studentId || 'N/A';
    if (modalStudentId) modalStudentId.textContent = studentId;

    // 4. TES SA Number
    const sa = AnnexSyncService.extractAuthenticSaNumber(student, grantee);
    if (modalSaNumber) modalSaNumber.textContent = sa;

    // 5. Degree Program
    const degree = student.program_name || student.programName || student.course || grantee.course || grantee.program_name || 'BSIT';
    if (modalProgram) modalProgram.textContent = degree;

    // 6. Year Level
    const yearRaw = String(student.year || student.scholarYearLevel || student.year_level || grantee.year || grantee.year_level || '1').replace(/[^0-9]/g, '') || '1';
    const yearFormatted = yearRaw === '1' ? '1st Year' : yearRaw === '2' ? '2nd Year' : yearRaw === '3' ? '3rd Year' : yearRaw === '4' ? '4th Year' : `${yearRaw}th Year`;
    if (modalYearLevel) modalYearLevel.textContent = yearFormatted;

    // 7. Sex / Gender
    const rawGender = student.gender || student.sex || grantee.gender || grantee.sex || 'M';
    const genderFormatted = rawGender.toUpperCase().startsWith('F') ? 'Female' : 'Male';
    if (modalGender) modalGender.textContent = genderFormatted;

    // 8. Birthdate
    const bdate = student.birthdate || student.birthday || grantee.birthdate || grantee.birthday || 'N/A';
    if (modalBirthdate) modalBirthdate.textContent = bdate;

    // 9. Batch
    const batch = resolveGranteeBatch(grantee);
    if (modalBatch) modalBatch.textContent = batch || 'Batch 1.2';

    // 10. Email & Phone
    const email = student.email || student.authEmail || grantee.email || 'N/A';
    if (modalEmail) modalEmail.textContent = email;
    const phone = student.contactNumber || student.phone || grantee.phone || grantee.mobile || 'N/A';
    if (modalPhone) modalPhone.textContent = phone;

    // 11. Status Badge
    if (modalStatusBadge) {
        if (source === 'form2') {
            modalStatusBadge.textContent = 'Form 2 – Enrolled (\u20B110,000.00)';
            modalStatusBadge.style.background = 'rgba(16, 185, 129, 0.12)';
            modalStatusBadge.style.color = '#059669';
        } else if (source === 'form3') {
            const r = item.specialStatusReason || 'Not enrolled';
            modalStatusBadge.textContent = `Form 3 – ${r}`;
            modalStatusBadge.style.background = 'rgba(255, 152, 0, 0.12)';
            modalStatusBadge.style.color = '#E65100';
        } else {
            modalStatusBadge.textContent = 'Pending Review Queue';
            modalStatusBadge.style.background = 'rgba(229, 57, 53, 0.12)';
            modalStatusBadge.style.color = '#D32F2F';
        }
    }

    // 12. Controls initial values & Actions visibility
    const targetFormValue = source === 'form2' ? 'form2' : 'form3';
    if (modalTargetForm) modalTargetForm.value = targetFormValue;

    if (modalTargetLabel) {
        if (targetFormValue === 'form2') {
            modalTargetLabel.textContent = 'Form 2 (Enrolled)';
            modalTargetLabel.style.color = '#10b981';
        } else {
            modalTargetLabel.textContent = 'Form 3 (Not Included)';
            modalTargetLabel.style.color = '#E65100';
        }
    }

    if (modalForm3Reason) {
        modalForm3Reason.value = item.specialStatusReason || 'Not enrolled';
    }
    if (modalRemarks) {
        modalRemarks.value = item.remarks || '';
    }

    // Configure action buttons according to source
    if (source === 'form2') {
        if (btnClassifyForm3) btnClassifyForm3.style.display = 'inline-flex';
        if (btnActionForm2) btnActionForm2.style.display = 'none';
        if (btnConfirmRes) btnConfirmRes.textContent = 'Save Changes';
    } else if (source === 'form3') {
        if (btnClassifyForm3) btnClassifyForm3.style.display = 'none';
        if (btnActionForm2) btnActionForm2.style.display = 'inline-flex';
        if (btnConfirmRes) btnConfirmRes.textContent = 'Update Form 3';
    } else {
        if (btnClassifyForm3) btnClassifyForm3.style.display = 'inline-flex';
        if (btnActionForm2) btnActionForm2.style.display = 'inline-flex';
        if (btnConfirmRes) btnConfirmRes.textContent = 'Save & Categorize';
    }

    if (resModal) resModal.style.display = 'flex';
}

function openResolutionModal(reviewIndex) {
    const item = needsReviewList[reviewIndex];
    if (!item) return;
    openStudentDetailsModal(item, 'review', reviewIndex);
}

function closeResolutionModal() {
    activeResolutionItem = null;
    activeResolutionSource = null;
    activeResolutionItemKey = null;
    if (resModal) resModal.style.display = 'none';
}

if (btnCloseRes) btnCloseRes.addEventListener('click', closeResolutionModal);
if (btnCancelRes) btnCancelRes.addEventListener('click', closeResolutionModal);
if (resModal) {
    resModal.addEventListener('click', (e) => {
        if (e.target === resModal) closeResolutionModal();
    });
}

if (modalTargetForm) {
    modalTargetForm.addEventListener('change', (e) => {
        const val = e.target.value;
        if (modalTargetLabel) {
            modalTargetLabel.textContent = val === 'form2' ? 'Form 2 (Enrolled)' : 'Form 3 (Not Included)';
            modalTargetLabel.style.color = val === 'form2' ? '#10b981' : '#E65100';
        }
        if (val === 'form3') {
            if (btnClassifyForm3) btnClassifyForm3.style.display = 'inline-flex';
            if (btnActionForm2) btnActionForm2.style.display = 'none';
        } else {
            if (btnClassifyForm3) btnClassifyForm3.style.display = 'none';
            if (btnActionForm2) btnActionForm2.style.display = 'inline-flex';
        }
    });
}

// Action: Classify student under Form 3
if (btnClassifyForm3) {
    btnClassifyForm3.addEventListener('click', () => {
        executeClassifyUnderForm3();
    });
}

// Action: Reclassify student to Form 2 (Enrolled)
if (btnActionForm2) {
    btnActionForm2.addEventListener('click', () => {
        executeReclassifyToForm2();
    });
}

// Action: Confirm / Save Changes
if (btnConfirmRes) {
    btnConfirmRes.addEventListener('click', () => {
        const targetForm = modalTargetForm ? modalTargetForm.value : 'form2';
        if (targetForm === 'form3') {
            executeClassifyUnderForm3();
        } else if (activeResolutionSource === 'form3') {
            executeReclassifyToForm2();
        } else {
            // Stay in Form 2, update remarks
            const itemKey = activeResolutionItemKey;
            const idx = verifiedForm2List.findIndex(x => AnnexSyncService.getUniqueKey(x) === itemKey || (activeResolutionItem && AnnexSyncService.isSameStudent(x, activeResolutionItem)));
            if (idx !== -1) {
                const item = verifiedForm2List[idx];
                item.remarks = modalRemarks ? modalRemarks.value.trim() : '';
                AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: needsReviewList,
                    updatedBy: window.currentAdmin?.username || 'Admin',
                    academicYear: selectedAcademicYear,
                    semester: selectedSemester
                });
                refreshFormTables();
                showToast(`Updated details for ${getItemDisplayName(item)}`, 'check-circle');
            }
            closeResolutionModal();
        }
    });
}

// Auto Resolve All to Form 3
const btnAutoResolveAll = document.getElementById('btn-auto-resolve-all');
if (btnAutoResolveAll) {
    btnAutoResolveAll.addEventListener('click', () => {
        if (needsReviewList.length === 0) {
            showToast('Review queue is already empty.', 'info');
            return;
        }
        const count = needsReviewList.length;
        while (needsReviewList.length > 0) {
            const item = needsReviewList.shift();
            item.classification = 'INACTIVE_FORM3';
            item.isEnrolled = false;
            item.specialStatusReason = 'Not enrolled';
            item.remarks = 'Batch categorized to Form 3 by Admin';
            if (!item.matchedStudent) {
                item.matchedStudent = {
                    fullName: item.grantee?.name || '',
                    studentId: item.grantee?.student_id || '',
                    course: item.grantee?.course || 'BSIT',
                    year: item.grantee?.year || '1',
                    status: 'Not enrolled'
                };
            } else {
                item.matchedStudent.status = 'Not enrolled';
            }
            verifiedForm3List.push(item);
        }

        const synced = AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            needsReviewList: needsReviewList,
            updatedBy: window.currentAdmin?.username || 'Admin',
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });
        if (synced) {
            verifiedForm2List = synced.form2List;
            verifiedForm3List = synced.form3List;
            needsReviewList = synced.needsReviewList;
        }

        try {
            supabase.from('audit_logs').insert([{
                userName: window.currentAdmin?.username || 'Admin',
                role: window.currentAdmin?.role || 'Admin',
                action: `Review Queue: Batch categorized ${count} grantees to Form 3 (Not enrolled)`,
                studentId: 'BATCH_RESOLVE'
            }]).then(() => { }).catch(e => console.warn(e));

            // Log activity notification for Admin
            AdminNotificationService.notifyRecordUpdate({
                title: 'Bulk Review Items Auto-Resolved',
                message: `Auto-resolved ${count} review queue grantees to Annex Form 3 (Reason: Not Enrolled).`,
                type: 'warning',
                metadata: { count, form: 'Form 3' }
            }).catch(() => { });
        } catch (_) { }

        updateKPIMetrics();
        renderForm2Table(verifiedForm2List);
        renderForm3Table(verifiedForm3List);
        renderReviewQueue(needsReviewList);
        showToast(`Auto-categorized ${count} records to Form 3`, 'check-circle');
    });
}

// ── 11. Tab Switching Navigation ────────────────────────────────────
const tabBtnRev = document.getElementById('tab-btn-review');
const tabBtn2 = document.getElementById('tab-btn-form2');
const tabBtn3 = document.getElementById('tab-btn-form3');

const tabPaneRev = document.getElementById('tab-pane-review');
const tabPane2 = document.getElementById('tab-pane-form2');
const tabPane3 = document.getElementById('tab-pane-form3');

function activateTab(activeBtn, activePane) {
    [tabBtnRev, tabBtn2, tabBtn3].forEach(b => b && b.classList.remove('active'));
    [tabPaneRev, tabPane2, tabPane3].forEach(p => p && (p.style.display = 'none'));

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.style.display = 'block';
}

if (tabBtnRev) tabBtnRev.addEventListener('click', () => activateTab(tabBtnRev, tabPaneRev));
if (tabBtn2) tabBtn2.addEventListener('click', () => activateTab(tabBtn2, tabPane2));
if (tabBtn3) tabBtn3.addEventListener('click', () => activateTab(tabBtn3, tabPane3));

window.activateAnnexTab = activateTab;

// Check if tab or section requested via notification navigation
if (window.requestedAnnexTab) {
    const rTab = window.requestedAnnexTab;
    window.requestedAnnexTab = null;
    if (rTab === 'form2' && tabBtn2 && tabPane2) activateTab(tabBtn2, tabPane2);
    else if (rTab === 'form3' && tabBtn3 && tabPane3) activateTab(tabBtn3, tabPane3);
    else if (rTab === 'review' && tabBtnRev && tabPaneRev) activateTab(tabBtnRev, tabPaneRev);
}

if (window.requestedAnnexSection) {
    const sec = window.requestedAnnexSection;
    window.requestedAnnexSection = null;
    const cardEl = sec === 'school' ? document.getElementById('card-source-school') : document.getElementById('card-source-superadmin');
    if (cardEl) {
        setTimeout(() => {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            cardEl.style.outline = '3px solid #1E88E5';
            cardEl.style.outlineOffset = '2px';
            setTimeout(() => {
                cardEl.style.transition = 'outline 0.8s ease';
                cardEl.style.outline = '3px solid transparent';
            }, 1500);
        }, 200);
    }
}

// ── 12. Search Filter Listeners ─────────────────────────────────────
const searchF2 = document.getElementById('search-form2');
if (searchF2) {
    searchF2.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = verifiedForm2List.filter(item => {
            const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
            const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
            const sa = (item.matchedStudent?.saNumber || item.grantee.saNumber || '').toLowerCase();
            return !q || name.includes(q) || id.includes(q) || sa.includes(q);
        });
        renderForm2Table(filtered);
    });
}

const searchF3 = document.getElementById('search-form3');
if (searchF3) {
    searchF3.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = verifiedForm3List.filter(item => {
            const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
            const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
            const reason = (item.specialStatusReason || '').toLowerCase();
            return !q || name.includes(q) || id.includes(q) || reason.includes(q);
        });
        renderForm3Table(filtered);
    });
}

// Form 2 Clear Action
const btnClearForm2 = document.getElementById('btn-clear-form2-data');
if (btnClearForm2) {
    btnClearForm2.addEventListener('click', async () => {
        if (verifiedForm2List.length === 0) {
            showToast('Form 2 table is already empty.', 'info');
            return;
        }
        if (confirm('Are you sure you want to remove all records from the Annex Form 2 table? This will clear local cache and delete records from Supabase.')) {
            verifiedForm2List = [];
            AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: needsReviewList,
                updatedBy: 'Admin',
                syncToDb: false,
                academicYear: selectedAcademicYear,
                semester: selectedSemester
            });
            if (window.supabaseClient) {
                try {
                    await window.supabaseClient.from('annex_form_2').delete().match({ academic_year: selectedAcademicYear, semester: selectedSemester });
                } catch (err) {
                    console.warn('Error deleting annex_form_2 from database:', err);
                }
            }
            updateKPIMetrics();
            renderForm2Table(verifiedForm2List);
            showToast('Annex Form 2 table data removed.', 'check-circle');

            AdminNotificationService.notifyRecordUpdate({
                title: 'Annex Form 2 Cleared',
                message: 'Registrar Admin cleared all records from the Annex Form 2 table.',
                type: 'warning',
                metadata: { form: 'Form 2' }
            }).catch(() => { });
        }
    });
}

// Form 3 Clear Action
const btnClearForm3 = document.getElementById('btn-clear-form3-data');
if (btnClearForm3) {
    btnClearForm3.addEventListener('click', async () => {
        if (verifiedForm3List.length === 0) {
            showToast('Form 3 table is already empty.', 'info');
            return;
        }
        if (confirm('Are you sure you want to remove all records from the Annex Form 3 table? This will clear local cache and delete records from Supabase.')) {
            verifiedForm3List = [];
            AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: needsReviewList,
                updatedBy: 'Admin',
                syncToDb: false,
                academicYear: selectedAcademicYear,
                semester: selectedSemester
            });
            if (window.supabaseClient) {
                try {
                    await window.supabaseClient.from('annex_form_3').delete().match({ academic_year: selectedAcademicYear, semester: selectedSemester });
                } catch (err) {
                    console.warn('Error deleting annex_form_3 from database:', err);
                }
            }
            updateKPIMetrics();
            renderForm3Table(verifiedForm3List);
            showToast('Annex Form 3 table data removed.', 'check-circle');

            AdminNotificationService.notifyRecordUpdate({
                title: 'Annex Form 3 Cleared',
                message: 'Registrar Admin cleared all records from the Annex Form 3 table.',
                type: 'warning',
                metadata: { form: 'Form 3' }
            }).catch(() => { });
        }
    });
}

// Manual Supabase DB Refresh Action
const refreshAdminFromDb = async () => {
    try {
        const dbSync = await AnnexSyncService.loadFromSupabase({
            academicYear: selectedAcademicYear,
            semester: selectedSemester,
            fallbackToLatest: false
        });
        if (dbSync && dbSync.fromDb) {
            verifiedForm2List = dbSync.form2List || [];
            verifiedForm3List = dbSync.form3List || [];
            needsReviewList = [];
            AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: [],
                updatedBy: 'Supabase Manual Refresh',
                syncToDb: false,
                academicYear: selectedAcademicYear,
                semester: selectedSemester
            });
            updateKPIMetrics();
            renderForm2Table(verifiedForm2List);
            renderForm3Table(verifiedForm3List);
            showToast(`Database synced: ${verifiedForm2List.length} Form 2, ${verifiedForm3List.length} Form 3 records.`, 'check-circle');
        }
    } catch (err) {
        console.error('Error refreshing from database:', err);
        showToast('Failed to sync from database: ' + (err.message || err), 'error');
    }
};

const btnRefreshF2 = document.getElementById('btn-refresh-form2-db');
if (btnRefreshF2) btnRefreshF2.addEventListener('click', refreshAdminFromDb);
const btnRefreshF3 = document.getElementById('btn-refresh-form3-db');
if (btnRefreshF3) btnRefreshF3.addEventListener('click', refreshAdminFromDb);

// Helper: Universal Blob download with FileSaver / Anchor tag fallback
function downloadBlob(blob, filename) {
    if (typeof window.saveAs === 'function') {
        window.saveAs(blob, filename);
        return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 200);
}

// ── 13. Auto-Fill Excel Exports ─────────────────────────────────────
async function exportForm2Excel() {
    const btn = document.getElementById('btn-export-form2-top');
    try {
        if (btn) btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';

        const resp = await fetch('/assets/Annex 5-TES New Form 2.xlsx');
        if (!resp.ok) throw new Error('Could not load Annex 5 Form 2 template');
        const blob = await resp.blob();

        const studentsToFill = verifiedForm2List.map(item => {
            const grantee = item.grantee || {};
            const matched = item.matchedStudent || {};
            return {
                ...grantee,
                ...matched,
                studentId: matched.studentId || matched.student_id || grantee.student_id || grantee.studentId || '',
                saNumber: matched.saNumber || grantee.saNumber || grantee.familyDetails?.saNumber || matched.familyDetails?.saNumber || '',
                fullName: matched.fullName || grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''} ${grantee.middle_name || ''}`.trim(),
                lastName: grantee.last_name || grantee.lastName || matched.lastName || matched.last_name || '',
                firstName: grantee.first_name || grantee.firstName || matched.firstName || matched.first_name || '',
                middleName: grantee.middle_name || grantee.middleName || matched.middleName || matched.middle_name || '',
                batch: resolveGranteeBatch(grantee || matched),
                gender: matched.gender || grantee.gender || 'M',
                birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                course: matched.course || grantee.course || grantee.program || '',
                year: matched.year || grantee.year || '1',
                email: matched.email || matched.authEmail || grantee.email || '',
                contactNumber: matched.contactNumber || matched.phone || grantee.contactNumber || grantee.phone || ''
            };
        });
        const result = await BillingService.fillAnnex5Form2(blob, studentsToFill, {
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });
        downloadBlob(result.blob, `AutoFilled_Annex_5_TES_Form_2_${Date.now()}.xlsx`);
        showToast('Annex 5 Form 2 Excel generated successfully!', 'check-circle');

        // Log activity notification for Admin
        AdminNotificationService.notifyRecordUpdate({
            title: 'Annex 5 Form 2 Generated',
            message: `Generated and exported official CHED Annex 5 Form 2 (Enrolled Grantees) with ${studentsToFill.length} students.`,
            type: 'success',
            metadata: { form: 'Form 2', count: studentsToFill.length }
        }).catch(() => { });
    } catch (err) {
        console.error('Form 2 generation error:', err);
        alert('Failed to generate Form 2: ' + err.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="icon-file-spreadsheet" style="font-size: 15px;"></i> Auto-Fill Form 2 (.xlsx)';
    }
}

async function exportForm3Excel() {
    const btn = document.getElementById('btn-export-form3-top');
    try {
        if (btn) btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';

        const resp = await fetch('/assets/Annex 5-TES New Form 3.xlsx');
        if (!resp.ok) throw new Error('Could not load Annex 5 Form 3 template');
        const blob = await resp.blob();

        const studentsToFill = verifiedForm3List.map(item => {
            const grantee = item.grantee || {};
            const matched = item.matchedStudent || {};
            const specialReason = item.specialStatusReason || matched.status || 'Not enrolled';
            return {
                ...grantee,
                ...matched,
                studentId: matched.studentId || matched.student_id || grantee.student_id || grantee.studentId || '',
                saNumber: matched.saNumber || grantee.saNumber || grantee.familyDetails?.saNumber || matched.familyDetails?.saNumber || '',
                fullName: matched.fullName || grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''} ${grantee.middle_name || ''}`.trim(),
                lastName: grantee.last_name || grantee.lastName || matched.lastName || matched.last_name || '',
                firstName: grantee.first_name || grantee.firstName || matched.firstName || matched.first_name || '',
                middleName: grantee.middle_name || grantee.middleName || matched.middleName || matched.middle_name || '',
                batch: resolveGranteeBatch(grantee || matched),
                gender: matched.gender || grantee.gender || 'M',
                birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                course: matched.course || grantee.course || grantee.program || '',
                year: matched.year || grantee.year || '1',
                status: specialReason,
                remarks: item.remarks || (specialReason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${specialReason}`)
            };
        });

        const result = await BillingService.fillAnnex5Form3(blob, studentsToFill, {
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });
        downloadBlob(result.blob, `AutoFilled_Annex_5_TES_Form_3_${Date.now()}.xlsx`);
        showToast('Annex 5 Form 3 Excel generated successfully!', 'check-circle');

        // Log activity notification for Admin
        AdminNotificationService.notifyRecordUpdate({
            title: 'Annex 5 Form 3 Generated',
            message: `Generated and exported official CHED Annex 5 Form 3 (Exceptions / Not Enrolled) with ${studentsToFill.length} students.`,
            type: 'warning',
            metadata: { form: 'Form 3', count: studentsToFill.length }
        }).catch(() => { });
    } catch (err) {
        console.error('Form 3 generation error:', err);
        alert('Failed to generate Form 3: ' + err.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="icon-file-text" style="font-size: 15px;"></i> Auto-Fill Form 3 (.xlsx)';
    }
}

const btnF2Top = document.getElementById('btn-export-form2-top');
if (btnF2Top) btnF2Top.addEventListener('click', exportForm2Excel);

const btnF3Top = document.getElementById('btn-export-form3-top');
if (btnF3Top) btnF3Top.addEventListener('click', exportForm3Excel);

// ── 14. Run Automated Cross-Verification Button ──────────────────────
const btnRunMatch = document.getElementById('btn-run-smart-match');
if (btnRunMatch) {
    btnRunMatch.addEventListener('click', () => {
        btnRunMatch.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Comparing Lists...';
        btnRunMatch.disabled = true;

        setTimeout(() => {
            runCrossVerification(true);
            btnRunMatch.innerHTML = '<i class="icon-refresh-cw" style="font-size: 16px;"></i> Run Automated Cross-Verification';
            btnRunMatch.disabled = false;
            showToast('Cross-Verification completed! Forms updated.', 'check-circle');

            AdminNotificationService.notifyRecordUpdate({
                title: 'Cross-Verification Completed',
                message: `Cross-matched ${rawSuperAdminGrantees.length} grantees: ${verifiedForm2List.length} verified for Form 2, ${verifiedForm3List.length} in Form 3, and ${needsReviewList.length} in review queue.`,
                type: 'info',
                metadata: { total: rawSuperAdminGrantees.length, form2: verifiedForm2List.length, form3: verifiedForm3List.length, review: needsReviewList.length }
            }).catch(() => { });
        }, 500);
    });
}

function showToast(message, icon = 'check-circle') {
    if (window.showToast) {
        window.showToast(message, icon);
    } else {
        console.log(message);
    }
}

// Live sync subscription
AnnexSyncService.onSync((synced) => {
    if (!synced) return;
    // Strictly ignore sync broadcasts for other academic periods to preserve term isolation
    if (synced.academicYear && selectedAcademicYear && selectedAcademicYear !== 'All' && synced.academicYear !== selectedAcademicYear) return;
    if (synced.semester && selectedSemester && selectedSemester !== 'All' && synced.semester !== selectedSemester) return;

    if (Array.isArray(synced.form2List) && Array.isArray(synced.form3List)) {
        verifiedForm2List = synced.form2List;
        verifiedForm3List = synced.form3List;
        needsReviewList = synced.needsReviewList || [];
        updateKPIMetrics();
        renderForm2Table(verifiedForm2List);
        renderForm3Table(verifiedForm3List);
        renderReviewQueue(needsReviewList);
    }
});

// ── School Term & Custom Academic Year Filter Setup (Registrar) ──────
async function populateRegistrarTerms() {
    if (isPopulatingRegistrarTerms) return;
    isPopulatingRegistrarTerms = true;
    try {
        const [years, semesters] = await Promise.all([
            AcademicYearService.getAcademicYears(),
            AcademicYearService.getSemesters()
        ]);

        const selectAY = document.getElementById('admin-filter-ay');
        const selectSem = document.getElementById('admin-filter-sem');

        if (selectAY) {
            let ayHtml = years.map(y => `<option value="${y}" ${y === selectedAcademicYear ? 'selected' : ''}>${y}</option>`).join('');
            ayHtml += `<option value="All" ${selectedAcademicYear === 'All' ? 'selected' : ''}>All School Years</option>`;
            ayHtml += `<option value="custom">+ Custom A.Y....</option>`;
            selectAY.innerHTML = ayHtml;
            selectAY.value = selectedAcademicYear;
        }

        if (selectSem) {
            let semHtml = semesters.map(s => `<option value="${s}" ${s === selectedSemester ? 'selected' : ''}>${s}</option>`).join('');
            semHtml += `<option value="All" ${selectedSemester === 'All' ? 'selected' : ''}>All Semesters</option>`;
            semHtml += `<option value="custom">+ Custom Semester...</option>`;
            selectSem.innerHTML = semHtml;
            selectSem.value = selectedSemester;
        }

        // Populate Source 1 School Student Records upload term selectors
        if (!selectSchoolAy) selectSchoolAy = document.getElementById('select-school-ay');
        if (!selectSchoolSem) selectSchoolSem = document.getElementById('select-school-sem');

        if (selectSchoolAy) {
            let sAyHtml = `<option value="" disabled ${!selectedAcademicYear ? 'selected' : ''}>-- Select Academic Year * --</option>`;
            sAyHtml += years.map(y => `<option value="${y}" ${y === selectedAcademicYear ? 'selected' : ''}>${y}</option>`).join('');
            sAyHtml += `<option value="custom">+ Enter Custom A.Y....</option>`;
            selectSchoolAy.innerHTML = sAyHtml;
            if (selectedAcademicYear && selectedAcademicYear !== 'All') {
                selectSchoolAy.value = selectedAcademicYear;
            }
        }

        if (selectSchoolSem) {
            let sSemHtml = `<option value="" disabled ${!selectedSemester ? 'selected' : ''}>-- Select Semester * --</option>`;
            sSemHtml += semesters.map(s => `<option value="${s}" ${s === selectedSemester ? 'selected' : ''}>${s}</option>`).join('');
            sSemHtml += `<option value="custom">+ Enter Custom Semester...</option>`;
            selectSchoolSem.innerHTML = sSemHtml;
            if (selectedSemester && selectedSemester !== 'All') {
                selectSchoolSem.value = selectedSemester;
            }
        }

        updateRegistrarActiveTermLabel();
    } catch (e) {
        console.warn('Error populating registrar terms:', e);
    } finally {
        isPopulatingRegistrarTerms = false;
    }
}

function updateRegistrarActiveTermLabel() {
    const lbl = document.getElementById('admin-active-term-label');
    if (lbl) {
        lbl.textContent = `${selectedAcademicYear} • ${selectedSemester}`;
    }
}

function openRegistrarCustomTermModal(defaultFocus = 'ay') {
    const modal = document.getElementById('admin-custom-term-modal');
    if (!modal) return;
    const inpAy = document.getElementById('admin-input-custom-ay');
    const inpSem = document.getElementById('admin-input-custom-sem');
    if (inpAy) inpAy.value = '';
    if (inpSem) inpSem.value = '';
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => {
        if (defaultFocus === 'sem' && inpSem) inpSem.focus();
        else if (inpAy) inpAy.focus();
    }, 50);
}

function closeRegistrarCustomTermModal() {
    const modal = document.getElementById('admin-custom-term-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function handleRegistrarTermChange(newAy, newSem) {
    if (newAy === 'custom') {
        openRegistrarCustomTermModal('ay');
        const selectAY = document.getElementById('admin-filter-ay');
        if (selectAY) selectAY.value = selectedAcademicYear;
        return;
    }
    if (newSem === 'custom') {
        openRegistrarCustomTermModal('sem');
        const selectSem = document.getElementById('admin-filter-sem');
        if (selectSem) selectSem.value = selectedSemester;
        return;
    }

    if (newAy !== undefined) selectedAcademicYear = newAy;
    if (newSem !== undefined) selectedSemester = newSem;

    const selectAY = document.getElementById('admin-filter-ay');
    if (selectAY && selectAY.value !== selectedAcademicYear) selectAY.value = selectedAcademicYear;
    const selectSem = document.getElementById('admin-filter-sem');
    if (selectSem && selectSem.value !== selectedSemester) selectSem.value = selectedSemester;

    if (!selectSchoolAy) selectSchoolAy = document.getElementById('select-school-ay');
    if (!selectSchoolSem) selectSchoolSem = document.getElementById('select-school-sem');

    if (selectSchoolAy && selectSchoolAy.value !== selectedAcademicYear && selectedAcademicYear !== 'All') {
        selectSchoolAy.value = selectedAcademicYear;
    }
    if (selectSchoolSem && selectSchoolSem.value !== selectedSemester && selectedSemester !== 'All') {
        selectSchoolSem.value = selectedSemester;
    }

    // Save as system default term
    if (selectedAcademicYear && selectedAcademicYear !== 'All' && selectedSemester && selectedSemester !== 'All') {
        AcademicYearService.setDefaultTerm(selectedAcademicYear, selectedSemester);
    }

    // Reset file upload dropzone UI for the selected term
    uploadedSchoolFile = null;
    const fileInput = document.getElementById('school-file-input');
    const uploadPrompt = document.getElementById('school-upload-prompt');
    const fileInfo = document.getElementById('school-file-info');
    if (fileInput) fileInput.value = '';
    if (uploadPrompt) uploadPrompt.style.display = 'flex';
    if (fileInfo) fileInfo.style.display = 'none';

    updateRegistrarActiveTermLabel();
    await loadInitialData();
}

function setupRegistrarTermListeners() {
    const selectAY = document.getElementById('admin-filter-ay');
    const selectSem = document.getElementById('admin-filter-sem');
    const btnCustom = document.getElementById('admin-btn-custom-term');
    const btnRefresh = document.getElementById('admin-btn-refresh-term');
    const btnCloseModal = document.getElementById('admin-btn-close-custom-term');
    const btnCancelModal = document.getElementById('admin-btn-cancel-custom-term');
    const btnSaveModal = document.getElementById('admin-btn-save-custom-term');
    const iconRefresh = document.getElementById('admin-icon-refresh-term');

    if (selectAY) {
        selectAY.addEventListener('change', (e) => handleRegistrarTermChange(e.target.value, undefined));
    }
    if (selectSem) {
        selectSem.addEventListener('change', (e) => handleRegistrarTermChange(undefined, e.target.value));
    }
    if (btnCustom) {
        btnCustom.addEventListener('click', () => openRegistrarCustomTermModal('ay'));
    }
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', closeRegistrarCustomTermModal);
    }
    if (btnCancelModal) {
        btnCancelModal.addEventListener('click', closeRegistrarCustomTermModal);
    }
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            if (iconRefresh) iconRefresh.style.animation = 'spin 0.8s linear infinite';
            try {
                if (selectedAcademicYear && selectedAcademicYear !== 'All' && selectedSemester && selectedSemester !== 'All') {
                    AcademicYearService.setDefaultTerm(selectedAcademicYear, selectedSemester);
                }
                await loadInitialData();
                showToast(`Synchronized database for ${selectedAcademicYear} (${selectedSemester})`, 'check-circle');
            } finally {
                if (iconRefresh) {
                    setTimeout(() => { iconRefresh.style.animation = ''; }, 300);
                }
            }
        });
    }

    // Source 1 Upload Term Listeners
    selectSchoolAy = document.getElementById('select-school-ay');
    customSchoolAyContainer = document.getElementById('custom-school-ay-container');
    customSchoolAyInput = document.getElementById('custom-school-ay-input');
    selectSchoolSem = document.getElementById('select-school-sem');
    customSchoolSemContainer = document.getElementById('custom-school-sem-container');
    customSchoolSemInput = document.getElementById('custom-school-sem-input');

    if (selectSchoolAy) {
        selectSchoolAy.addEventListener('change', () => {
            const val = selectSchoolAy.value;
            if (val === 'custom') {
                if (customSchoolAyContainer) {
                    customSchoolAyContainer.classList.remove('hidden');
                    customSchoolAyContainer.style.display = 'block';
                }
                if (customSchoolAyInput) customSchoolAyInput.focus();
            } else {
                if (customSchoolAyContainer) {
                    customSchoolAyContainer.classList.add('hidden');
                    customSchoolAyContainer.style.display = 'none';
                }
                if (val) {
                    handleRegistrarTermChange(val, undefined);
                }
            }
            clearSchoolTermError();
        });

        if (selectSchoolAy.value === 'custom' && customSchoolAyContainer) {
            customSchoolAyContainer.classList.remove('hidden');
            customSchoolAyContainer.style.display = 'block';
        }
    }

    if (customSchoolAyInput) {
        customSchoolAyInput.addEventListener('input', () => {
            clearSchoolTermError();
        });
        const commitCustomAy = () => {
            const val = customSchoolAyInput.value.trim();
            if (val) {
                AcademicYearService.addCustomAcademicYear(val);
                if (selectSchoolAy) {
                    let hasOpt = Array.from(selectSchoolAy.options).some(o => o.value === val);
                    if (!hasOpt) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        const customOpt = selectSchoolAy.querySelector('option[value="custom"]');
                        selectSchoolAy.insertBefore(opt, customOpt || null);
                    }
                }
                handleRegistrarTermChange(val, undefined);
            }
        };
        customSchoolAyInput.addEventListener('blur', commitCustomAy);
        customSchoolAyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitCustomAy();
                if (selectSchoolSem && selectSchoolSem.value === 'custom' && customSchoolSemInput) {
                    customSchoolSemInput.focus();
                }
            }
        });
    }

    if (selectSchoolSem) {
        selectSchoolSem.addEventListener('change', () => {
            const val = selectSchoolSem.value;
            if (val === 'custom') {
                if (customSchoolSemContainer) {
                    customSchoolSemContainer.classList.remove('hidden');
                    customSchoolSemContainer.style.display = 'block';
                }
                if (customSchoolSemInput) customSchoolSemInput.focus();
            } else {
                if (customSchoolSemContainer) {
                    customSchoolSemContainer.classList.add('hidden');
                    customSchoolSemContainer.style.display = 'none';
                }
                if (val) {
                    handleRegistrarTermChange(undefined, val);
                }
            }
            clearSchoolTermError();
        });

        if (selectSchoolSem.value === 'custom' && customSchoolSemContainer) {
            customSchoolSemContainer.classList.remove('hidden');
            customSchoolSemContainer.style.display = 'block';
        }
    }

    if (customSchoolSemInput) {
        customSchoolSemInput.addEventListener('input', () => {
            clearSchoolTermError();
        });
        const commitCustomSem = () => {
            const val = customSchoolSemInput.value.trim();
            if (val) {
                AcademicYearService.addCustomSemester(val);
                if (selectSchoolSem) {
                    let hasOpt = Array.from(selectSchoolSem.options).some(o => o.value === val);
                    if (!hasOpt) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        const customOpt = selectSchoolSem.querySelector('option[value="custom"]');
                        selectSchoolSem.insertBefore(opt, customOpt || null);
                    }
                }
                handleRegistrarTermChange(undefined, val);
            }
        };
        customSchoolSemInput.addEventListener('blur', commitCustomSem);
        customSchoolSemInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitCustomSem();
            }
        });
    }

    const modalCustomTerm = document.getElementById('admin-custom-term-modal');
    if (modalCustomTerm) {
        modalCustomTerm.addEventListener('click', (e) => {
            if (e.target === modalCustomTerm) closeRegistrarCustomTermModal();
        });
    }

    const inpAy = document.getElementById('admin-input-custom-ay');
    const inpSem = document.getElementById('admin-input-custom-sem');
    [inpAy, inpSem].forEach(inp => {
        if (inp) {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (btnSaveModal) btnSaveModal.click();
                } else if (e.key === 'Escape') {
                    closeRegistrarCustomTermModal();
                }
            });
        }
    });

    if (btnSaveModal) {
        btnSaveModal.addEventListener('click', async () => {
            const inpAyEl = document.getElementById('admin-input-custom-ay');
            const inpSemEl = document.getElementById('admin-input-custom-sem');
            const ayVal = (inpAyEl ? inpAyEl.value : '').trim();
            const semVal = (inpSemEl ? inpSemEl.value : '').trim();

            if (!ayVal && !semVal) {
                alert('Please enter a valid Academic Year (e.g. 2026-2027) or Semester.');
                return;
            }

            let addedAy = null;
            let addedSem = null;

            if (ayVal) {
                addedAy = await AcademicYearService.addCustomAcademicYear(ayVal);
                selectedAcademicYear = addedAy;
            }
            if (semVal) {
                addedSem = await AcademicYearService.addCustomSemester(semVal);
                selectedSemester = addedSem;
            }

            closeRegistrarCustomTermModal();
            await populateRegistrarTerms();

            const selAy = document.getElementById('admin-filter-ay');
            if (selAy && selectedAcademicYear) selAy.value = selectedAcademicYear;
            const selSem = document.getElementById('admin-filter-sem');
            if (selSem && selectedSemester) selSem.value = selectedSemester;

            if (selectedAcademicYear && selectedSemester) {
                AcademicYearService.setDefaultTerm(selectedAcademicYear, selectedSemester);
            }

            updateRegistrarActiveTermLabel();
            showToast(`Custom term saved: ${selectedAcademicYear} • ${selectedSemester}`, 'check-circle');
            await loadInitialData();
        });
    }

    // Subscribe to cross-interface updates
    AcademicYearService.onTermsUpdated(async () => {
        await populateRegistrarTerms();
    });

    AcademicYearService.onDefaultTermUpdated(async (newTerm) => {
        if (newTerm?.academicYear) selectedAcademicYear = newTerm.academicYear;
        if (newTerm?.semester) selectedSemester = newTerm.semester;
        await populateRegistrarTerms();
        updateRegistrarActiveTermLabel();
        await loadInitialData();
    });
}

// Initial Setup & Load
setupRegistrarTermListeners();
populateRegistrarTerms().then(() => {
    loadInitialData();
});
