// js/views/masterlist_import.js
import { BillingService } from '../services/billing_service.js';
import { VerificationService } from '../services/verification_service.js';
import { AnnexSyncService } from '../services/annex_sync_service.js';
import { AcademicYearService } from '../services/academic_year_service.js';
import { StudentSyncService } from '../services/student_sync_service.js';

// Dynamically load document parsing libraries if needed
if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    document.head.appendChild(script);
    const workerScript = document.createElement('script');
    workerScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    document.head.appendChild(workerScript);
}

if (!window.mammoth) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    document.head.appendChild(script);
}

// State
let currentFile = null;
let isImportingMasterlist = false;
let allMasterlistRecords = [];
let extractedRecords = [];
let schoolStudents = [];
let selectedSchoolStudentIds = new Set();
let isSchoolTableExpanded = true;
let uploadedSchoolFile = null;

let verifiedForm2List = [];
let verifiedForm3List = [];
let studentExistList = [];
let needsReviewList = [];

// Student Exist & Duplicate Management Elements
let badgeMasterlistDuplicates = null;
let countMasterlistDuplicates = null;
let btnMoveAllDuplicates = null;
let saTabBtnExist = null;
let saBadgeExistCount = null;
let saStatExistCount = null;
let saSearchExist = null;
let saTbodyExist = null;
let saBtnExportExist = null;
let saBtnClearExist = null;

// Elements
let dropZone = null;
let fileInput = null;
let fileInfoContainer = null;
let fileNameDisplay = null;
let fileSizeDisplay = null;
let btnClearFile = null;
let btnExtract = null;
let ocrProgressContainer = null;
let ocrStatusText = null;
let ocrProgressBar = null;
let extractedTableBody = null;
let btnSaveRecords = null;
let filterBatch = null;
let btnClearMasterlist = null;
let selectImportBatch = null;
let customBatchContainer = null;
let customBatchInput = null;
let batchValidationHint = null;
let batchSelectBox = null;

// Target Scholarship Elements (Step 1 Upload)
let selectImportScholarship = null;
let customImportScholarshipContainer = null;
let customImportScholarshipInput = null;
let importScholarshipSelectBox = null;
let importScholarshipValidationHint = null;
let selectedScholarshipProgram = localStorage.getItem('scholardoc_target_scholarship') || 'CHED TES';

// Scholarship Conflict Summary Elements
let summaryConflicts = null;
let importConflictAlert = null;
let importConflictAlertText = null;

// School Students Elements
let elSchoolCount = null;
let btnDownloadSchoolTemplate = null;
let btnToggleSchoolExpand = null;
let iconSchoolExpand = null;
let textSchoolExpand = null;
let btnExportSchoolCsv = null;
let textExportSchoolCsv = null;
let schoolDropzone = null;
let schoolFileInput = null;
let schoolUploadPrompt = null;
let schoolFileInfo = null;
let schoolFileNameDisplay = null;
let schoolFileSizeDisplay = null;
let btnClearSchoolFile = null;
let searchSchoolStudentsInput = null;
let wrapSchoolStudents = null;
let selectAllSchoolCb = null;

// Source Toggle Elements
let toggleBtnGrantees = null;
let toggleBtnSchool = null;
let sectionNewGrantees = null;
let cardSourceSchool = null;
let badgeToggleGrantees = null;
let badgeToggleSchool = null;
let sourceActiveLabel = null;

// Summary Metrics Elements
let importSummaryCard = null;
let summaryExtracted = null;
let summaryImported = null;
let summarySkipped = null;
let summaryErrors = null;

// Annex Tabs Elements
let saTabBtn2 = null;
let saTabBtn3 = null;
let saTabBtnRev = null;
let saTabPane2 = null;
let saTabPane3 = null;
let saTabPaneRev = null;
let saTabPaneExist = null;

let btnExportAnnexExcel = null;
let btnExportF2 = null;
let btnExportF3 = null;
let saSearchF2 = null;
let saSearchF3 = null;
let btnAutoResolveAll = null;

// Term Filter State & Elements (Semester & Academic Year)
let filterAcademicYear = null;
let filterSemester = null;
let headerFilterAcademicYear = null;
let headerFilterSemester = null;
let btnRefreshTerm = null;
let iconRefreshTerm = null;

// Target Academic Period Elements (Step 1 Upload)
let selectImportAy = null;
let customImportAyContainer = null;
let customImportAyInput = null;
let selectImportSem = null;
let customImportSemContainer = null;
let customImportSemInput = null;
let importTermSelectBox = null;
let importTermValidationHint = null;

const initialDefaultTerm = AcademicYearService.getDefaultTerm();
let selectedAcademicYear = initialDefaultTerm.academicYear || '2026-2027';
let selectedSemester = initialDefaultTerm.semester || '1st Semester';

function getTableName() {
    return 'new_grantees_masterlist';
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function normalizeName(lastName, firstName, middleName) {
    const full = `${lastName || ''} ${firstName || ''} ${middleName || ''}`;
    return full.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Target Scholarship Program Helpers & Validation ──────────────────────────
function normalizeScholarshipName(name) {
    if (!name) return '';
    const clean = String(name).trim().toUpperCase();
    if (clean === 'TES' || clean === 'CHED TES' || clean.includes('TERTIARY EDUCATION SUBSIDY')) {
        return 'CHED TES';
    }
    if (clean === 'TDP' || clean.includes('TULONG DUNONG')) {
        return 'TDP';
    }
    if (clean === 'STUFAP' || clean.includes('FINANCIAL ASSISTANCE')) {
        return 'STUFAP';
    }
    return clean;
}

function getSelectedImportScholarship() {
    if (!selectImportScholarship) {
        selectImportScholarship = document.getElementById('select-import-scholarship');
        customImportScholarshipContainer = document.getElementById('custom-import-scholarship-container');
        customImportScholarshipInput = document.getElementById('custom-import-scholarship-input');
        importScholarshipSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-scholarship-selection-container');
        importScholarshipValidationHint = document.getElementById('import-scholarship-validation-hint');
    }

    if (!selectImportScholarship) {
        return selectedScholarshipProgram || null;
    }

    const val = selectImportScholarship.value;
    let chosen = '';
    if (val === 'custom') {
        chosen = customImportScholarshipInput ? customImportScholarshipInput.value.trim() : '';
    } else if (val) {
        chosen = val.trim();
    }

    if (!chosen) {
        showScholarshipError();
        return null;
    }

    clearScholarshipError();
    selectedScholarshipProgram = chosen;
    try {
        localStorage.setItem('scholardoc_target_scholarship', chosen);
    } catch (_) { }

    updateStep1TargetTermBadge(selectedAcademicYear, selectedSemester, chosen);
    updateStep2TermIndicator(selectedAcademicYear, selectedSemester, chosen);

    return chosen;
}

function showScholarshipError() {
    if (!importScholarshipSelectBox) importScholarshipSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-scholarship-selection-container');
    if (!importScholarshipValidationHint) importScholarshipValidationHint = document.getElementById('import-scholarship-validation-hint');
    if (importScholarshipSelectBox) importScholarshipSelectBox.classList.add('error-state');
    if (importScholarshipValidationHint) importScholarshipValidationHint.classList.remove('hidden');

    if (selectImportScholarship && selectImportScholarship.value === 'custom' && customImportScholarshipInput) {
        customImportScholarshipInput.focus();
    } else if (selectImportScholarship) {
        selectImportScholarship.focus();
    }

    if (window.showToast) {
        window.showToast('Please select a Scholarship Program before importing new grantees.', 'alert-triangle');
    }
}

function clearScholarshipError() {
    if (!importScholarshipSelectBox) importScholarshipSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-scholarship-selection-container');
    if (!importScholarshipValidationHint) importScholarshipValidationHint = document.getElementById('import-scholarship-validation-hint');
    if (importScholarshipValidationHint) importScholarshipValidationHint.classList.add('hidden');
    const bHint = document.getElementById('batch-validation-hint');
    if (importScholarshipSelectBox && (!bHint || bHint.classList.contains('hidden'))) {
        importScholarshipSelectBox.classList.remove('error-state');
    }
}

async function populateImportScholarshipPrograms() {
    if (!selectImportScholarship) {
        selectImportScholarship = document.getElementById('select-import-scholarship');
    }
    if (!selectImportScholarship) return;

    try {
        let programs = ['CHED TES', 'TES', 'TDP', 'STUFAP'];
        if (window.supabaseClient) {
            const { data } = await window.supabaseClient.from('scholarships').select('name, isActive').order('name', { ascending: true });
            if (data && data.length > 0) {
                data.forEach(p => {
                    if (p.name && !programs.some(existing => existing.toUpperCase() === p.name.trim().toUpperCase())) {
                        programs.push(p.name.trim());
                    }
                });
            }
        }

        const currentVal = selectImportScholarship.value || selectedScholarshipProgram || 'CHED TES';
        let html = '<option value="" disabled' + (!currentVal ? ' selected' : '') + '>-- Select Scholarship Program * --</option>';
        programs.forEach(prog => {
            const isSel = currentVal && (currentVal.toUpperCase() === prog.toUpperCase());
            html += `<option value="${prog}" ${isSel ? 'selected' : ''}>${prog}</option>`;
        });
        html += '<option value="custom">+ Enter Custom Scholarship...</option>';
        selectImportScholarship.innerHTML = html;
        if (currentVal) {
            selectImportScholarship.value = currentVal;
            selectedScholarshipProgram = currentVal;
        }
    } catch (e) {
        console.warn('Could not load scholarship programs:', e);
    }
}

// ── Target Term Helpers & Validation ──────────────────────────────────────────
function getSelectedImportTerm() {
    if (!selectImportAy) {
        selectImportAy = document.getElementById('select-import-ay');
        customImportAyContainer = document.getElementById('custom-import-ay-container');
        customImportAyInput = document.getElementById('custom-import-ay-input');
        selectImportSem = document.getElementById('select-import-sem');
        customImportSemContainer = document.getElementById('custom-import-sem-container');
        customImportSemInput = document.getElementById('custom-import-sem-input');
        importTermSelectBox = document.getElementById('import-term-selection-container');
        importTermValidationHint = document.getElementById('import-term-validation-hint');
    }

    if (!selectImportAy || !selectImportSem) {
        return { academicYear: selectedAcademicYear, semester: selectedSemester };
    }

    const ayVal = selectImportAy.value;
    let chosenAy = '';
    if (ayVal === 'custom') {
        chosenAy = customImportAyInput ? customImportAyInput.value.trim() : '';
    } else if (ayVal && ayVal !== 'All') {
        chosenAy = ayVal.trim();
    }

    const semVal = selectImportSem.value;
    let chosenSem = '';
    if (semVal === 'custom') {
        chosenSem = customImportSemInput ? customImportSemInput.value.trim() : '';
    } else if (semVal && semVal !== 'All') {
        chosenSem = semVal.trim();
    }

    if (!chosenAy || !chosenSem) {
        showTermError(!chosenAy ? 'ay' : 'sem');
        return null;
    }

    clearTermError();

    // Auto-register custom entries if any
    if (ayVal === 'custom' && chosenAy) {
        AcademicYearService.addCustomAcademicYear(chosenAy);
    }
    if (semVal === 'custom' && chosenSem) {
        AcademicYearService.addCustomSemester(chosenSem);
    }

    // Save chosen values as system defaults if changed
    if (chosenAy !== selectedAcademicYear || chosenSem !== selectedSemester) {
        AcademicYearService.setDefaultTerm(chosenAy, chosenSem);
    }

    selectedAcademicYear = chosenAy;
    selectedSemester = chosenSem;

    // Synchronize header filter dropdowns and badges
    if (headerFilterAcademicYear && headerFilterAcademicYear.value !== chosenAy) {
        headerFilterAcademicYear.value = chosenAy;
    }
    if (headerFilterSemester && headerFilterSemester.value !== chosenSem) {
        headerFilterSemester.value = chosenSem;
    }
    updateStep1TargetTermBadge(chosenAy, chosenSem);
    updateStep2TermIndicator(chosenAy, chosenSem);

    return { academicYear: chosenAy, semester: chosenSem };
}

function showTermError(missingField = 'ay') {
    if (!importTermSelectBox) importTermSelectBox = document.getElementById('import-term-selection-container');
    if (!importTermValidationHint) importTermValidationHint = document.getElementById('import-term-validation-hint');
    if (importTermSelectBox) importTermSelectBox.classList.add('error-state');
    if (importTermValidationHint) importTermValidationHint.classList.remove('hidden');

    if (missingField === 'ay') {
        if (selectImportAy && selectImportAy.value === 'custom' && customImportAyInput) {
            customImportAyInput.focus();
        } else if (selectImportAy) {
            selectImportAy.focus();
        }
    } else {
        if (selectImportSem && selectImportSem.value === 'custom' && customImportSemInput) {
            customImportSemInput.focus();
        } else if (selectImportSem) {
            selectImportSem.focus();
        }
    }

    if (window.showToast) {
        window.showToast('Please select or enter an Academic Year and Semester before importing new grantees.', 'alert-triangle');
    }
}

function clearTermError() {
    if (!importTermSelectBox) importTermSelectBox = document.getElementById('import-term-selection-container');
    if (!importTermValidationHint) importTermValidationHint = document.getElementById('import-term-validation-hint');
    if (importTermSelectBox) importTermSelectBox.classList.remove('error-state');
    if (importTermValidationHint) importTermValidationHint.classList.add('hidden');
}

// ── Batch Helpers & Persistent Storage ──────────────────────────
function getSelectedImportBatch() {
    if (!selectImportBatch) {
        selectImportBatch = document.getElementById('select-import-batch');
        customBatchContainer = document.getElementById('custom-batch-container');
        customBatchInput = document.getElementById('custom-batch-input');
        batchValidationHint = document.getElementById('batch-validation-hint');
        batchSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-batch-selection-container');
    }
    if (!selectImportBatch) return null;

    const val = selectImportBatch.value;
    let chosen = '';

    if (val === 'custom') {
        chosen = customBatchInput ? customBatchInput.value.trim() : '';
    } else if (val) {
        chosen = val.trim();
    }

    if (!chosen) {
        showBatchError();
        return null;
    }

    clearBatchError();
    return chosen;
}

function showBatchError() {
    if (!batchSelectBox) batchSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-batch-selection-container');
    if (!batchValidationHint) batchValidationHint = document.getElementById('batch-validation-hint');
    if (batchSelectBox) batchSelectBox.classList.add('error-state');
    if (batchValidationHint) batchValidationHint.classList.remove('hidden');
    if (selectImportBatch && selectImportBatch.value !== 'custom') {
        selectImportBatch.focus();
    } else if (customBatchInput && selectImportBatch?.value === 'custom') {
        customBatchInput.focus();
    }
    if (window.showToast) {
        window.showToast('Please select a batch first before uploading or extracting a file.', 'alert-triangle');
    }
}

function clearBatchError() {
    if (!batchSelectBox) batchSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-batch-selection-container');
    if (!batchValidationHint) batchValidationHint = document.getElementById('batch-validation-hint');
    if (batchValidationHint) batchValidationHint.classList.add('hidden');
    const sHint = document.getElementById('import-scholarship-validation-hint');
    if (batchSelectBox && (!sHint || sHint.classList.contains('hidden'))) {
        batchSelectBox.classList.remove('error-state');
    }
}

function cacheGranteeBatches(records) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_batches') || '{}');
        (records || []).forEach(r => {
            let b = r.batch || 'Batch 1.2';
            b = String(b).trim();
            if (b === '1' || b.toLowerCase() === 'batch 1') b = 'Batch 1.1';
            else if (!b.toLowerCase().startsWith('batch')) b = `Batch ${b}`;

            if (r.id) cache[r.id] = b;
            const normKey = normalizeName(r.lastName || r.last_name, r.firstName || r.first_name, r.middleName || r.middle_name);
            if (normKey) cache[normKey] = b;
            const rawName = (r.name || `${r.lastName || r.last_name || ''}, ${r.firstName || r.first_name || ''} ${r.middleName || r.middle_name || ''}`).trim().toLowerCase();
            if (rawName) cache[rawName] = b;
            const sNo = r.studentId || r.student_id || r.student_no || r.studentNo;
            if (sNo) cache[String(sNo).trim()] = b;
        });
        localStorage.setItem('scholardoc_grantee_batches', JSON.stringify(cache));
    } catch (e) {
        console.warn('Error saving grantee batches cache:', e);
    }
}

function getCachedGranteeBatch(record) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_batches') || '{}');
        if (record && record.id && cache[record.id]) return cache[record.id];
        const sNo = record?.studentId || record?.student_id || record?.student_no || record?.studentNo;
        if (sNo && cache[String(sNo).trim()]) return cache[String(sNo).trim()];
        const normKey = normalizeName(record?.lastName || record?.last_name, record?.firstName || record?.first_name, record?.middleName || record?.middle_name);
        if (normKey && cache[normKey]) return cache[normKey];
        const rawName = (record?.name || `${record?.lastName || record?.last_name || ''}, ${record?.firstName || record?.first_name || ''} ${record?.middleName || record?.middle_name || ''}`).trim().toLowerCase();
        if (rawName && cache[rawName]) return cache[rawName];
    } catch (_) { }
    return null;
}

function cacheGranteeTerms(records, ay, sem) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_terms') || '{}');
        (records || []).forEach(r => {
            const termVal = {
                academicYear: r.academicYear || ay || selectedAcademicYear || '2024-2025',
                semester: r.semester || sem || selectedSemester || '1st Semester'
            };
            if (r.id) cache[r.id] = termVal;
            const normKey = normalizeName(r.lastName || r.last_name, r.firstName || r.first_name, r.middleName || r.middle_name);
            if (normKey) cache[normKey] = termVal;
            const rawName = (r.name || `${r.lastName || r.last_name || ''}, ${r.firstName || r.first_name || ''} ${r.middleName || r.middle_name || ''}`).trim().toLowerCase();
            if (rawName) cache[rawName] = termVal;
        });
        localStorage.setItem('scholardoc_grantee_terms', JSON.stringify(cache));
    } catch (e) {
        console.warn('Error saving grantee terms cache:', e);
    }
}

function getCachedGranteeTerm(record) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_terms') || '{}');
        if (record.id && cache[record.id]) return cache[record.id];
        const normKey = normalizeName(record.lastName || record.last_name, record.firstName || record.first_name, record.middleName || record.middle_name);
        if (normKey && cache[normKey]) return cache[normKey];
        const rawName = (record.name || `${record.lastName || record.last_name || ''}, ${record.firstName || record.first_name || ''} ${record.middleName || record.middle_name || ''}`).trim().toLowerCase();
        if (rawName && cache[rawName]) return cache[rawName];
    } catch (_) { }
    return null;
}

function cacheGranteeScholarships(records, scholarship) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_scholarships') || '{}');
        (records || []).forEach(r => {
            const sch = r.scholarshipProgram || scholarship || selectedScholarshipProgram || 'CHED TES';
            if (r.id) cache[r.id] = sch;
            const normKey = normalizeName(r.lastName || r.last_name, r.firstName || r.first_name, r.middleName || r.middle_name);
            if (normKey) cache[normKey] = sch;
            const rawName = (r.name || `${r.lastName || r.last_name || ''}, ${r.firstName || r.first_name || ''} ${r.middleName || r.middle_name || ''}`).trim().toLowerCase();
            if (rawName) cache[rawName] = sch;
            const sNo = r.studentId || r.student_id || r.student_no || r.studentNo;
            if (sNo) cache[String(sNo).trim()] = sch;
        });
        localStorage.setItem('scholardoc_grantee_scholarships', JSON.stringify(cache));
    } catch (e) {
        console.warn('Error saving grantee scholarships cache:', e);
    }
}

function getCachedGranteeScholarship(record) {
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_grantee_scholarships') || '{}');
        if (record && record.id && cache[record.id]) return cache[record.id];
        const sNo = record?.studentId || record?.student_id || record?.student_no || record?.studentNo;
        if (sNo && cache[String(sNo).trim()]) return cache[String(sNo).trim()];
        const normKey = normalizeName(record?.lastName || record?.last_name, record?.firstName || record?.first_name, record?.middleName || record?.middle_name);
        if (normKey && cache[normKey]) return cache[normKey];
        const rawName = (record?.name || `${record?.lastName || record?.last_name || ''}, ${record?.firstName || record?.first_name || ''} ${record?.middleName || record?.middle_name || ''}`).trim().toLowerCase();
        if (rawName && cache[rawName]) return cache[rawName];
    } catch (_) { }
    return null;
}

function updateStep1TargetTermBadge(ay = selectedAcademicYear, sem = selectedSemester, sch = selectedScholarshipProgram) {
    const termBadgeText = document.getElementById('step1-target-term-text');
    if (termBadgeText) {
        const schText = sch ? `${sch} \u2022 ` : '';
        const ayText = (!ay || ay === 'All') ? 'All School Years' : `A.Y. ${ay}`;
        const semText = (!sem || sem === 'All') ? 'All Semesters' : sem;
        termBadgeText.textContent = `${schText}${ayText} \u2022 ${semText}`;
    }
}

function updateStep2TermIndicator(ay = selectedAcademicYear, sem = selectedSemester, sch = selectedScholarshipProgram) {
    const termIndicatorText = document.getElementById('step2-term-text');
    if (termIndicatorText) {
        const schText = sch ? `${sch} \u2022 ` : '';
        const ayText = (!ay || ay === 'All') ? 'All School Years' : `${ay}`;
        const semText = (!sem || sem === 'All') ? 'All Semesters' : sem;
        termIndicatorText.textContent = `Filtered by: ${schText}${ayText} \u2022 ${semText}`;
    }
}

// ── Universal Term Matching Helpers ─────────────────────────────────────
function isSemesterMatch(itemSem, targetSem) {
    if (!targetSem || targetSem === 'All') return true;
    const is = String(itemSem || '').toLowerCase().trim();
    const ts = String(targetSem || '').toLowerCase().trim();
    if (!is) return false;
    if (ts.includes('1st')) return is.includes('1st') && !is.includes('2nd') && !is.includes('summer');
    if (ts.includes('2nd')) return is.includes('2nd') && !is.includes('1st') && !is.includes('summer');
    if (ts.includes('summer')) return is.includes('summer') && !is.includes('1st') && !is.includes('2nd');
    return is === ts || is.includes(ts) || ts.includes(is);
}

function isAcademicYearMatch(itemAy, targetAy) {
    if (!targetAy || targetAy === 'All') return true;
    const ia = String(itemAy || '').toLowerCase().trim();
    const ta = String(targetAy || '').toLowerCase().trim();
    if (!ia) return false;
    const yearMatchT = ta.match(/\d{4}-\d{4}/);
    const filterYear = yearMatchT ? yearMatchT[0] : ta;
    return ia.includes(filterYear);
}

// ── Student Exist & Duplicate Detection Helpers ──────────────────────────
function isTermMatchForExist(item, ay, sem) {
    if (!item) return false;
    const is = String(item.semester || '').toLowerCase().trim();
    const ts = String(sem || '').toLowerCase().trim();
    if (ts && ts !== 'all') {
        if (ts.includes('1st') && (is.includes('2nd') || is.includes('summer'))) return false;
        if (ts.includes('2nd') && (is.includes('1st') || is.includes('summer'))) return false;
        if (ts.includes('summer') && (is.includes('1st') || is.includes('2nd'))) return false;
    }
    if (ay && ay !== 'All') {
        const ia = String(item.academicYear || item.academic_year || '').toLowerCase().trim();
        const ta = String(ay || '').toLowerCase().trim();
        if (ia && !ia.includes(ta) && !ta.includes(ia)) return false;
    }
    return true;
}

function saveStudentExistList(ay = selectedAcademicYear, sem = selectedSemester) {
    try {
        if (!ay || !sem) return;
        const taggedList = (studentExistList || []).map(item => ({
            ...item,
            academicYear: item.academicYear || ay,
            semester: item.semester || sem
        }));
        const termOnly = taggedList.filter(item => isTermMatchForExist(item, ay, sem));
        studentExistList = termOnly;

        if (ay !== 'All' && sem !== 'All') {
            localStorage.setItem(`scholardoc_student_exist_${ay}_${sem}`, JSON.stringify(termOnly));
        }
        if (typeof AnnexSyncService !== 'undefined' && AnnexSyncService.saveStudentExistData) {
            AnnexSyncService.saveStudentExistData(termOnly, ay, sem);
        }
    } catch (e) {
        console.warn('Error saving student exist list:', e);
    }
}

function loadStudentExistList(ay = selectedAcademicYear, sem = selectedSemester) {
    try {
        let list = null;
        if (typeof AnnexSyncService !== 'undefined' && AnnexSyncService.getStudentExistData) {
            list = AnnexSyncService.getStudentExistData(ay, sem);
        }
        if ((!list || list.length === 0) && ay && sem && ay !== 'All' && sem !== 'All') {
            const raw = localStorage.getItem(`scholardoc_student_exist_${ay}_${sem}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) list = parsed;
            }
        }
        if (Array.isArray(list)) {
            studentExistList = list.filter(item => isTermMatchForExist(item, ay, sem));
            return studentExistList;
        }
    } catch (e) {
        console.warn('Error loading student exist list:', e);
    }
    studentExistList = [];
    return studentExistList;
}

// ── Intelligent Duplicate & Name Matching Engine ────────────────────────
let cachedStudentGranteesList = [];

function cleanAlpha(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getComparableName(rec) {
    if (!rec) {
        return {
            id: '',
            last: '',
            first: '',
            mi: '',
            cleanFull: '',
            revCleanFull: '',
            fTokens: [],
            cleanId: '',
            rawName: '',
            batch: 'Batch 1.2',
            scholarship: 'CHED TES',
            record: null
        };
    }

    let l = rec.lastName || rec.last_name || '';
    let f = rec.firstName || rec.first_name || rec.given_name || '';
    let m = rec.middleName || rec.middle_name || rec.middle_initial || '';
    let raw = rec.name || rec.full_name || rec.fullName || '';

    if ((!l || !l.trim()) && raw) {
        const parsed = splitFullName(raw);
        l = parsed.lastName;
        f = parsed.firstName;
        m = parsed.middleName || m;
    }

    if (!raw && (l || f)) {
        raw = `${l}, ${f} ${m}`.trim();
    }

    const cleanL = cleanAlpha(l);
    const cleanF = cleanAlpha(f);

    let mi = '';
    const cleanM = String(m || '').trim();
    if (cleanM) {
        const mLetter = cleanM.replace(/[^a-zA-Z]/g, '').charAt(0);
        if (mLetter) mi = mLetter.toUpperCase();
    }

    const cleanFull = cleanAlpha(raw || `${l} ${f} ${m}`);
    const revCleanFull = cleanAlpha(`${f} ${m} ${l}`);

    const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
    const fTokens = String(f || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !suffixes.has(t));

    const sId = String(rec.studentId || rec.student_id || rec.student_no || rec.student_number || '').trim();
    const cleanId = cleanAlpha(sId);
    const validId = (cleanId.length >= 5 && cleanId !== 'null' && cleanId !== 'undefined' && cleanId !== 'none' && cleanId !== 'unassigned') ? cleanId : '';

    const rawBatch = rec.batch || rec.tes_batch || (rec.documents && rec.documents.batch) || 'Batch 1.2';
    const cleanBatch = String(rawBatch).startsWith('Batch') ? rawBatch : `Batch ${String(rawBatch).replace(/^batch\s*/i, '').trim() || '1.2'}`;

    const rawSch = rec.scholarshipProgram || rec.scholarship_name || rec.scholarship || (rec.documents && rec.documents.scholarshipName) || 'CHED TES';

    return {
        id: String(rec.id || rec.uid || '').trim(),
        last: cleanL,
        first: cleanF,
        mi,
        cleanFull,
        revCleanFull,
        fTokens,
        cleanId: validId,
        rawName: raw,
        batch: cleanBatch,
        scholarship: String(rawSch || 'CHED TES').trim(),
        record: rec
    };
}

function areNamesMatching(cand, exist) {
    if (!cand || !exist) return false;

    // 1. Institutional Student ID check (definitive if both present)
    if (cand.cleanId && exist.cleanId) {
        if (cand.cleanId === exist.cleanId) return true;
        // Strict rejection if both have distinct valid institutional IDs (6+ chars)
        if (cand.cleanId.length >= 6 && exist.cleanId.length >= 6 && cand.cleanId !== exist.cleanId) {
            return false;
        }
    }

    // 2. Exact clean full name check (e.g. "jarioljudeesidorezacarias")
    if (cand.cleanFull && exist.cleanFull && cand.cleanFull.length >= 5) {
        if (cand.cleanFull === exist.cleanFull) return true;
        if (cand.revCleanFull && cand.revCleanFull === exist.cleanFull) return true;
        if (exist.revCleanFull && cand.cleanFull === exist.revCleanFull) return true;
    }

    // 3. Surname + Given Name Match
    if (cand.last && exist.last && cand.first && exist.first) {
        let lastSim = 0;
        if (cand.last === exist.last) {
            lastSim = 1.0;
        } else if (typeof StudentSyncService !== 'undefined' && StudentSyncService.levenshteinSimilarity) {
            lastSim = StudentSyncService.levenshteinSimilarity(cand.last, exist.last);
        }

        const isLastMatching = cand.last === exist.last || lastSim >= 0.88;

        if (isLastMatching) {
            // If BOTH records have explicit, conflicting middle initials, they are different people
            if (cand.mi && exist.mi && cand.mi !== exist.mi) {
                return false;
            }

            // A. Exact first name
            if (cand.first === exist.first) {
                return true;
            }

            // B. First name token overlap (e.g. "Jude Esidore" vs "Jude", "April Joy" vs "April")
            if (cand.fTokens.length > 0 && exist.fTokens.length > 0) {
                const shared = cand.fTokens.filter(t => exist.fTokens.includes(t));
                if (shared.length >= Math.min(cand.fTokens.length, exist.fTokens.length)) {
                    return true;
                }
            }

            // C. First name Levenshtein similarity >= 0.80
            let firstSim = 0;
            if (typeof StudentSyncService !== 'undefined' && StudentSyncService.levenshteinSimilarity) {
                firstSim = StudentSyncService.levenshteinSimilarity(cand.first, exist.first);
            }
            if (firstSim >= 0.80) {
                return true;
            }

            // D. Substring containment for multi-part names
            if (cand.first.length >= 4 && exist.first.length >= 4) {
                if (cand.first.includes(exist.first) || exist.first.includes(cand.first)) {
                    return true;
                }
            }
        }

        // Swapped First & Last name check (e.g. "Jude Esidore" in last name, "Jariol" in first name)
        if (cand.last === exist.first && cand.first === exist.last && cand.last.length >= 3 && cand.first.length >= 3) {
            return true;
        }
    }

    // 4. Fallback to StudentSyncService.isMatch if available
    if (typeof StudentSyncService !== 'undefined' && StudentSyncService.isMatch) {
        if (StudentSyncService.isMatch(cand.record, exist.record)) {
            return true;
        }
    }

    return false;
}

function detectAndMarkMasterlistDuplicates(records) {
    if (!records || records.length === 0) return records;

    loadStudentExistList();
    const studentExistPool = (studentExistList || []).map(e => getComparableName(e));
    const studentGranteesPool = (cachedStudentGranteesList || []).map(s => getComparableName(s));
    const masterPool = (allMasterlistRecords || []).map(m => getComparableName(m));

    const seenInList = [];

    records.forEach(r => {
        // Reset duplicate status unless there is an existing scholarship conflict
        if (!r.hasScholarshipConflict) {
            r.isDuplicate = false;
            r.duplicateReason = '';
        } else {
            r.isDuplicate = true;
            r.duplicateReason = r.conflictReason || `Already registered in ${r.existingScholarship}`;
            return;
        }

        const cand = getComparableName(r);
        const isSavedMasterRecord = Boolean(r.id);

        // 1. Check Student Grantees table (student_grantees, annex_form_2)
        // Skip for records already saved in new_grantees_masterlist (their Student Grantees / Form 2 entry is their own synced record)
        if (!isSavedMasterRecord && studentGranteesPool.length > 0) {
            const sgMatch = studentGranteesPool.find(exist => areNamesMatching(cand, exist));
            if (sgMatch && masterPool.some(m => (!r.id || !m.id || m.id !== r.id) && areNamesMatching(cand, m))) {
                r.isDuplicate = true;
                const matchBatch = sgMatch.batch || r.batch || 'Batch 1.2';
                r.duplicateReason = `Already exists in Student Grantees (${matchBatch})`;
                return;
            }
        }

        // 2. Check Student Exist table
        if (studentExistPool.length > 0) {
            const existMatch = studentExistPool.find(exist => areNamesMatching(cand, exist));
            if (existMatch) {
                r.isDuplicate = true;
                r.duplicateReason = 'Already in Student Exist table';
                return;
            }
        }

        // 3. Check New Grantees Master List (for unsaved uploaded records matching existing masterlist records)
        if (!isSavedMasterRecord && masterPool.length > 0) {
            const mlMatch = masterPool.find(exist => exist.record !== r && (!r.id || !exist.id || exist.id !== r.id) && areNamesMatching(cand, exist));
            if (mlMatch) {
                r.isDuplicate = true;
                const matchBatch = mlMatch.batch || r.batch || 'Batch 1.2';
                r.duplicateReason = `Already exists in Master List (${matchBatch})`;
                return;
            }
        }

        // 4. Check Duplicate entry within this current view list
        const dupMatch = seenInList.find(exist => exist.record !== r && (!r.id || !exist.id || exist.id !== r.id) && areNamesMatching(cand, exist));
        if (dupMatch) {
            r.isDuplicate = true;
            r.duplicateReason = 'Duplicate entry in master list';
            return;
        }

        seenInList.push(cand);
    });

    return records;
}

async function moveRecordToStudentExist(index) {
    const record = extractedRecords[index];
    if (!record) return;

    const studentName = `${record.lastName || ''}, ${record.firstName || ''} ${record.middleName || ''}`.trim();

    const existItem = {
        id: record.id || `exist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        studentId: record.studentId || record.student_id || 'N/A',
        firstName: record.firstName || '',
        middleName: record.middleName || '',
        lastName: record.lastName || '',
        name: studentName,
        course: record.course || 'BSIT',
        batch: record.batch || '1.2',
        academicYear: record.academicYear || selectedAcademicYear,
        semester: record.semester || selectedSemester,
        scholarshipProgram: record.scholarshipProgram || selectedScholarshipProgram || 'CHED TES',
        duplicateReason: record.duplicateReason || 'Duplicate grantee in master list',
        movedAt: new Date().toISOString()
    };

    studentExistList.unshift(existItem);
    saveStudentExistList();

    extractedRecords.splice(index, 1);
    const recCand = getComparableName(record);
    const mIdx = allMasterlistRecords.findIndex(x => (record.id && x.id === record.id) || areNamesMatching(getComparableName(x), recCand));
    if (mIdx !== -1) {
        allMasterlistRecords.splice(mIdx, 1);
    }

    if (record.id && window.supabaseClient) {
        try {
            await window.supabaseClient.from(getTableName()).delete().eq('id', record.id);
        } catch (delErr) {
            console.warn('Could not delete moved grantee from database:', delErr);
        }
    }

    detectAndMarkMasterlistDuplicates(extractedRecords);

    // Ensure this student is removed from Form 3 if present
    const prevF3Len = (verifiedForm3List || []).length;
    verifiedForm3List = (verifiedForm3List || []).filter(f3 => !AnnexSyncService.isSameStudent(existItem, f3));
    if (verifiedForm3List.length !== prevF3Len) {
        AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            studentExistList: studentExistList,
            needsReviewList: needsReviewList,
            updatedBy: 'Super Admin',
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });
        renderAnnexForm3Table(verifiedForm3List);
    }

    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    renderTable();
    renderStudentExistTable();
    updateAnnexKPIs();

    if (window.showToast) {
        window.showToast(`Moved ${studentName || 'grantee'} to Student Exist table`, 'check-circle');
    }
}

async function moveAllDuplicatesToStudentExist() {
    const dups = extractedRecords.filter(r => r.isDuplicate || r.hasScholarshipConflict);
    if (dups.length === 0) {
        if (window.showToast) window.showToast('No duplicate records detected to move.', 'info');
        return;
    }

    const count = dups.length;
    const idsToDelete = [];

    dups.forEach(record => {
        const studentName = `${record.lastName || ''}, ${record.firstName || ''} ${record.middleName || ''}`.trim();
        const existItem = {
            id: record.id || `exist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            studentId: record.studentId || record.student_id || 'N/A',
            firstName: record.firstName || '',
            middleName: record.middleName || '',
            lastName: record.lastName || '',
            name: studentName,
            course: record.course || 'BSIT',
            batch: record.batch || '1.2',
            academicYear: record.academicYear || selectedAcademicYear,
            semester: record.semester || selectedSemester,
            scholarshipProgram: record.scholarshipProgram || selectedScholarshipProgram || 'CHED TES',
            duplicateReason: record.duplicateReason || 'Duplicate grantee in master list',
            movedAt: new Date().toISOString()
        };
        studentExistList.unshift(existItem);
        if (record.id) idsToDelete.push(record.id);
    });

    saveStudentExistList();

    extractedRecords = extractedRecords.filter(r => !r.isDuplicate && !r.hasScholarshipConflict);
    const dupPool = dups.map(d => getComparableName(d));
    allMasterlistRecords = allMasterlistRecords.filter(r => {
        if (r.id && idsToDelete.includes(r.id)) return false;
        const cand = getComparableName(r);
        return !dupPool.some(d => areNamesMatching(cand, d));
    });

    if (idsToDelete.length > 0 && window.supabaseClient) {
        try {
            await window.supabaseClient.from(getTableName()).delete().in('id', idsToDelete);
        } catch (delErr) {
            console.warn('Could not bulk delete moved grantees from database:', delErr);
        }
    }

    detectAndMarkMasterlistDuplicates(extractedRecords);

    // Ensure all moved duplicate students are removed from Form 3 if present
    const prevAllF3Len = (verifiedForm3List || []).length;
    verifiedForm3List = (verifiedForm3List || []).filter(f3 => {
        return !dups.some(d => AnnexSyncService.isSameStudent(d, f3));
    });
    if (verifiedForm3List.length !== prevAllF3Len) {
        AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            studentExistList: studentExistList,
            needsReviewList: needsReviewList,
            updatedBy: 'Super Admin',
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });
        renderAnnexForm3Table(verifiedForm3List);
    }
    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    renderTable();
    renderStudentExistTable();
    updateAnnexKPIs();

    if (window.showToast) {
        window.showToast(`Successfully moved ${count} duplicate record${count > 1 ? 's' : ''} to Student Exist table`, 'check-circle');
    }
}

async function deleteMasterlistRecord(index) {
    const record = extractedRecords[index];
    if (!record) return;

    const studentName = `${record.lastName || ''}, ${record.firstName || ''} ${record.middleName || ''}`.trim();
    if (!confirm(`Are you sure you want to delete "${studentName || 'this student'}" from the masterlist?`)) {
        return;
    }

    extractedRecords.splice(index, 1);
    const recCand = getComparableName(record);
    const mIdx = allMasterlistRecords.findIndex(x => (record.id && x.id === record.id) || areNamesMatching(getComparableName(x), recCand));
    if (mIdx !== -1) {
        allMasterlistRecords.splice(mIdx, 1);
    }

    if (record.id && window.supabaseClient) {
        try {
            await window.supabaseClient.from(getTableName()).delete().eq('id', record.id);
        } catch (delErr) {
            console.warn('Could not delete grantee from database:', delErr);
        }
    }

    detectAndMarkMasterlistDuplicates(extractedRecords);
    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    renderTable();
    updateAnnexKPIs();

    if (window.showToast) {
        window.showToast(`Deleted ${studentName || 'grantee'} from masterlist`, 'trash');
    }
}

function renderStudentExistTable(filterText = '') {
    if (!saTbodyExist) saTbodyExist = document.getElementById('sa-tbody-exist');
    if (!saBadgeExistCount) saBadgeExistCount = document.getElementById('sa-badge-exist-count');
    if (!saStatExistCount) saStatExistCount = document.getElementById('sa-stat-exist-count');

    // Filter strictly to current selected term
    const termList = (studentExistList || []).filter(item => isTermMatchForExist(item, selectedAcademicYear, selectedSemester));
    const totalCount = termList.length;
    if (saBadgeExistCount) saBadgeExistCount.textContent = totalCount;
    if (saStatExistCount) saStatExistCount.textContent = `${totalCount} Duplicate Grantee${totalCount === 1 ? '' : 's'}`;

    if (!saTbodyExist) return;

    let displayList = termList;
    if (filterText && filterText.trim()) {
        const q = filterText.toLowerCase().trim();
        displayList = termList.filter(item => {
            const name = (item.name || `${item.lastName || ''} ${item.firstName || ''}`).toLowerCase();
            const sId = String(item.studentId || '').toLowerCase();
            const reason = String(item.duplicateReason || '').toLowerCase();
            const course = String(item.course || '').toLowerCase();
            return name.includes(q) || sId.includes(q) || reason.includes(q) || course.includes(q);
        });
    }

    if (displayList.length === 0) {
        saTbodyExist.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <i class="icon-user-check" style="font-size: 34px; color: #cbd5e1;"></i>
                        <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">
                            ${filterText ? `No duplicate records matching "${filterText}"` : 'No duplicate records in Student Exist'}
                        </span>
                        <span style="font-size: 12px; color: var(--text-secondary); max-width: 320px; line-height: 1.4;">
                            ${filterText ? 'Try a different keyword or clear the search.' : 'Use the "Move" action in the New Grantees Master List above to place duplicate students here.'}
                        </span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    saTbodyExist.innerHTML = '';
    displayList.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.background = 'rgba(254, 226, 226, 0.2)';
        tr.style.borderLeft = '3px solid #ef4444';

        const fullName = item.name || `${item.lastName || ''}, ${item.firstName || ''} ${item.middleName || ''}`.trim();
        const batchClean = String(item.batch || '1.2').replace(/^batch\s*/i, '').trim();
        const itemId = item.id || `idx_${index}`;

        tr.innerHTML = `
            <td style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #64748b;">${index + 1}</td>
            <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-primary);">${item.studentId || 'N/A'}</td>
            <td style="padding: 10px 12px;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${fullName}</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">${item.scholarshipProgram || 'CHED TES'}</span>
                </div>
            </td>
            <td style="padding: 10px 12px; font-size: 12px; color: var(--text-secondary);">${item.course || 'BSIT'}</td>
            <td style="padding: 10px 12px; white-space: nowrap;">
                <span class="badge-batch-pill" title="Assigned Batch">
                    <i class="icon-layers" style="font-size: 11px;"></i> ${batchClean}
                </span>
            </td>
            <td style="padding: 10px 12px;">
                <span style="background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.35); padding: 3px 8px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="icon-alert-circle" style="font-size: 12px;"></i>
                    ${item.duplicateReason || 'Duplicate Record'}
                </span>
            </td>
            <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 5px; justify-content: center;">
                    <button class="btn-restore-exist" data-id="${itemId}" title="Restore student to New Grantees Master List"
                        style="padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(30,136,229,0.3); background: rgba(30,136,229,0.08); color: #1E88E5; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                        <i class="icon-rotate-ccw" style="font-size: 11px;"></i> Restore
                    </button>
                    <button class="btn-delete-exist" data-id="${itemId}" title="Permanently delete duplicate record from Student Exist"
                        style="padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #dc2626; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                        <i class="icon-trash-2" style="font-size: 11px;"></i> Delete
                    </button>
                </div>
            </td>
        `;
        saTbodyExist.appendChild(tr);
    });

    saTbodyExist.querySelectorAll('.btn-restore-exist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-id');
            const targetItem = displayList.find((it, idx) => (it.id && it.id === targetId) || `idx_${idx}` === targetId);
            if (targetItem) restoreFromStudentExist(targetItem);
        });
    });

    saTbodyExist.querySelectorAll('.btn-delete-exist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-id');
            const targetItem = displayList.find((it, idx) => (it.id && it.id === targetId) || `idx_${idx}` === targetId);
            if (targetItem) deleteFromStudentExist(targetItem);
        });
    });
}

function restoreFromStudentExist(target) {
    let item = null;
    let index = -1;
    if (typeof target === 'number') {
        index = target;
        item = studentExistList[index];
    } else if (target && typeof target === 'object') {
        item = target;
        index = studentExistList.findIndex(x => (target.id && x.id === target.id) || x === target || (x.studentId && x.studentId === target.studentId && x.name === target.name));
    }
    if (!item || index === -1) return;

    studentExistList.splice(index, 1);
    saveStudentExistList();

    const restored = {
        id: item.id && !item.id.startsWith('exist_') ? item.id : null,
        studentId: item.studentId !== 'N/A' ? item.studentId : '',
        firstName: item.firstName || '',
        middleName: item.middleName || '',
        lastName: item.lastName || '',
        course: item.course || 'BSIT',
        batch: item.batch || '1.2',
        academicYear: item.academicYear || selectedAcademicYear,
        semester: item.semester || selectedSemester,
        scholarshipProgram: item.scholarshipProgram || selectedScholarshipProgram || 'CHED TES',
        isDuplicate: false
    };

    extractedRecords.push(restored);
    allMasterlistRecords.push(restored);

    if (window.supabaseClient) {
        window.supabaseClient.from(getTableName()).insert([{
            student_id: restored.studentId,
            first_name: restored.firstName,
            middle_name: restored.middleName,
            last_name: restored.lastName,
            name: `${restored.lastName}, ${restored.firstName} ${restored.middleName}`.trim(),
            course: restored.course,
            batch: restored.batch,
            academic_year: restored.academicYear,
            semester: restored.semester
        }]).select('id').then(res => {
            if (res.data && res.data[0]) restored.id = res.data[0].id;
        }).catch(err => console.warn('Could not re-insert restored grantee to database:', err));
    }

    detectAndMarkMasterlistDuplicates(extractedRecords);
    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    renderTable();
    renderStudentExistTable();
    updateAnnexKPIs();

    if (window.showToast) {
        window.showToast(`Restored ${item.name || 'grantee'} to New Grantees Master List`, 'check-circle');
    }
}

function deleteFromStudentExist(target) {
    let item = null;
    let index = -1;
    if (typeof target === 'number') {
        index = target;
        item = studentExistList[index];
    } else if (target && typeof target === 'object') {
        item = target;
        index = studentExistList.findIndex(x => (target.id && x.id === target.id) || x === target || (x.studentId && x.studentId === target.studentId && x.name === target.name));
    }
    if (!item || index === -1) return;

    if (!confirm(`Permanently remove "${item.name || 'this student'}" from Student Exist?`)) {
        return;
    }

    studentExistList.splice(index, 1);
    saveStudentExistList();
    renderStudentExistTable();
    updateAnnexKPIs();

    if (window.showToast) {
        window.showToast(`Removed from Student Exist`, 'trash');
    }
}

function clearStudentExistList() {
    const termList = (studentExistList || []).filter(item => isTermMatchForExist(item, selectedAcademicYear, selectedSemester));
    if (termList.length === 0) {
        if (window.showToast) window.showToast('Student Exist table is already empty for this semester.', 'info');
        return;
    }
    if (!confirm(`Are you sure you want to clear all ${termList.length} duplicate record(s) from Student Exist for ${selectedSemester} (${selectedAcademicYear})?`)) {
        return;
    }
    studentExistList = (studentExistList || []).filter(item => !isTermMatchForExist(item, selectedAcademicYear, selectedSemester));
    saveStudentExistList();
    renderStudentExistTable();
    updateAnnexKPIs();
    if (window.showToast) {
        window.showToast('Cleared Student Exist records for this semester', 'check-circle');
    }
}

function exportStudentExistToExcel() {
    const termList = (studentExistList || []).filter(item => isTermMatchForExist(item, selectedAcademicYear, selectedSemester));
    if (!termList || termList.length === 0) {
        if (window.showToast) window.showToast('No Student Exist records to export for this semester.', 'info');
        return;
    }

    if (typeof XLSX === 'undefined') {
        if (window.showToast) window.showToast('Excel library (SheetJS) is not loaded.', 'error');
        return;
    }

    const rows = termList.map((item, idx) => ({
        'No.': idx + 1,
        'Student ID': item.studentId || 'N/A',
        'Last Name': item.lastName || '',
        'First Name': item.firstName || '',
        'Middle Name': item.middleName || '',
        'Full Name': item.name || '',
        'Degree Program': item.course || '',
        'Batch': item.batch || '',
        'Scholarship Program': item.scholarshipProgram || 'CHED TES',
        'Academic Year': item.academicYear || selectedAcademicYear,
        'Semester': item.semester || selectedSemester,
        'Duplicate / Exist Reason': item.duplicateReason || '',
        'Date Moved': item.movedAt ? new Date(item.movedAt).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student Exist');
    const termClean = `${selectedAcademicYear || '2026-2027'}_${(selectedSemester || '1st_Sem').replace(/\s+/g, '_')}`;
    XLSX.writeFile(wb, `Student_Exist_Duplicates_${termClean}.xlsx`);

    if (window.showToast) {
        window.showToast(`Exported ${termList.length} Student Exist records to Excel`, 'check-circle');
    }
}

function applyTermFilterToMasterlist(ay = selectedAcademicYear, sem = selectedSemester) {
    if (!allMasterlistRecords) allMasterlistRecords = [];

    // If auto-import pipeline is actively processing, do not let background term loaders interrupt or clobber extractedRecords
    if (isImportingMasterlist) {
        return;
    }

    const matchesCurrentTerm = (!ay || ay === 'All' || ay === selectedAcademicYear) &&
                               (!sem || sem === 'All' || sem === selectedSemester);

    // If an imported file is currently loaded and displayed for the active term, preserve the extracted records (including detected duplicates)
    if (currentFile && extractedRecords && extractedRecords.length > 0 && matchesCurrentTerm) {
        detectAndMarkMasterlistDuplicates(extractedRecords);
        if (badgeToggleGrantees) {
            badgeToggleGrantees.textContent = extractedRecords.length;
        }
        updateStep1TargetTermBadge(ay, sem);
        updateStep2TermIndicator(ay, sem);
        populateBatchFilter();
        renderTable();
        updateClearMasterlistButtonVisibility();
        return;
    }

    // Filter allMasterlistRecords by selected AY and Semester
    extractedRecords = allMasterlistRecords.filter(r => {
        const rAy = r.academicYear || r.academic_year;
        const rSem = r.semester;
        const matchAY = isAcademicYearMatch(rAy, ay);
        const matchSem = isSemesterMatch(rSem, sem);
        return matchAY && matchSem;
    });

    // Detect and flag any duplicates automatically
    detectAndMarkMasterlistDuplicates(extractedRecords);

    if (badgeToggleGrantees) {
        badgeToggleGrantees.textContent = extractedRecords.length;
    }

    updateStep1TargetTermBadge(ay, sem);
    updateStep2TermIndicator(ay, sem);
    populateBatchFilter();
    renderTable();
    updateClearMasterlistButtonVisibility();
}

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


function clearFileState() {
    currentFile = null;
    if (fileInput) fileInput.value = '';
    if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
    if (dropZone) dropZone.classList.remove('hidden');
    if (btnExtract) btnExtract.disabled = true;
    if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
    if (importSummaryCard) importSummaryCard.classList.add('hidden');

    fetchExistingMasterlist();
}

async function handleFile(file, explicitBatch, explicitTerm, explicitScholarship) {
    if (isImportingMasterlist || window.__isImportingMasterlist) {
        return;
    }
    const selectedTerm = explicitTerm || getSelectedImportTerm();
    if (!selectedTerm) {
        if (fileInput) fileInput.value = '';
        return;
    }
    const selectedScholarship = explicitScholarship || getSelectedImportScholarship();
    if (!selectedScholarship) {
        if (fileInput) fileInput.value = '';
        return;
    }
    const selectedBatch = explicitBatch || getSelectedImportBatch();
    if (!selectedBatch) {
        if (fileInput) fileInput.value = '';
        return;
    }

    const validExtensions = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'csv'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
        alert('Please upload a valid masterlist file (PDF, DOCX, XLSX, CSV).');
        if (fileInput) fileInput.value = '';
        return;
    }

    currentFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = formatBytes(file.size);

    if (dropZone) dropZone.classList.add('hidden');
    if (fileInfoContainer) fileInfoContainer.classList.remove('hidden');

    // Expected Flow: Upload File -> Automatically Extract Data -> Display in Table -> Automatically Save to Database
    await executeAutoImportPipeline(file, selectedBatch, selectedTerm, selectedScholarship);
}

async function extractExcelOrCsv(file, selectedBatch) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const rawRecords = [];
                let currentBatch = selectedBatch || 'Batch 1.1';

                let headerRowIdx = -1;
                let colMap = { firstName: -1, middleName: -1, lastName: -1, course: -1, batch: -1, studentId: -1 };

                // 1. Detect header row by looking for name keywords
                for (let r = 0; r < Math.min(10, jsonData.length); r++) {
                    const row = jsonData[r];
                    if (!row || row.length === 0) continue;
                    const normRow = row.map(c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim());

                    const isHeader = normRow.some(c =>
                        c === 'name' || c === 'firstname' || c === 'middlename' || c === 'middleinitial' || c === 'lastname' || c === 'student' || c === 'givenname' || c === 'surname' || c === 'fname' || c === 'lname' || c === 'mname' || c === 'studentname' || c.includes('first') || c.includes('last') || c.includes('middle')
                    );

                    if (isHeader) {
                        headerRowIdx = r;
                        normRow.forEach((col, idx) => {
                            if (col.includes('first') || col.includes('given') || col === 'fname') {
                                colMap.firstName = idx;
                            } else if (col.includes('middle') || col.includes('mi') || col === 'mname') {
                                colMap.middleName = idx;
                            } else if (col.includes('last') || col.includes('surname') || col === 'lname') {
                                colMap.lastName = idx;
                            } else if (col === 'name' || col.includes('student')) {
                                if (colMap.firstName === -1) colMap.firstName = idx;
                            } else if (col.includes('course') || col.includes('program')) {
                                colMap.course = idx;
                            } else if (col.includes('batch')) {
                                colMap.batch = idx;
                            } else if (col.includes('studentno') || col.includes('studentid') || col === 'id') {
                                colMap.studentId = idx;
                            }
                        });
                        break;
                    }
                }

                const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

                for (let r = startRow; r < jsonData.length; r++) {
                    const row = jsonData[r];
                    if (!row || row.length === 0) continue;

                    const rowStr = row.join(' ').toLowerCase();
                    if (!selectedBatch && rowStr.includes('batch')) {
                        const match = rowStr.match(/batch\s*(\d+(?:\.\d+)?|[a-z0-9.]+)/i);
                        if (match) currentBatch = `Batch ${match[1]}`;
                    }

                    const cleanCells = row.map(c => String(c || '').trim()).filter(c => c.length > 0);
                    if (cleanCells.length === 0) continue;

                    let firstName = '';
                    let middleName = '';
                    let lastName = '';
                    let course = 'BSIT';
                    let studentId = '';

                    if (headerRowIdx !== -1 && (colMap.firstName !== -1 || colMap.lastName !== -1)) {
                        firstName = colMap.firstName !== -1 ? String(row[colMap.firstName] || '').trim() : '';
                        middleName = colMap.middleName !== -1 ? String(row[colMap.middleName] || '').trim() : '';
                        lastName = colMap.lastName !== -1 ? String(row[colMap.lastName] || '').trim() : '';
                        if (colMap.course !== -1 && row[colMap.course]) course = String(row[colMap.course]).trim();
                        if (colMap.studentId !== -1 && row[colMap.studentId]) studentId = String(row[colMap.studentId]).trim();

                        if (firstName && !lastName) {
                            const parsed = splitFullName(firstName);
                            firstName = parsed.firstName;
                            middleName = parsed.middleName || middleName;
                            lastName = parsed.lastName;
                        } else if (lastName && !firstName) {
                            const parsed = splitFullName(lastName);
                            firstName = parsed.firstName;
                            middleName = parsed.middleName || middleName;
                            lastName = parsed.lastName;
                        } else if (firstName && firstName.includes(',')) {
                            const parsed = splitFullName(firstName);
                            firstName = parsed.firstName;
                            middleName = parsed.middleName || middleName;
                            lastName = parsed.lastName || lastName;
                        }
                    } else {
                        // Positional Fallback based on Name | Middle Name | Last Name
                        let cellIdx = 0;
                        if (/^\d+$/.test(cleanCells[0]) && cleanCells.length > 1) {
                            cellIdx = 1;
                        }
                        if (cleanCells[cellIdx] && (/^\d{6,15}$/.test(cleanCells[cellIdx]) || /^[0-9-]+$/.test(cleanCells[cellIdx]))) {
                            studentId = cleanCells[cellIdx];
                            cellIdx++;
                        }

                        if (cleanCells.length >= cellIdx + 3) {
                            firstName = cleanCells[cellIdx];
                            middleName = cleanCells[cellIdx + 1];
                            lastName = cleanCells[cellIdx + 2];
                            if (cleanCells[cellIdx + 3]) course = cleanCells[cellIdx + 3];
                        } else if (cleanCells.length >= cellIdx + 2) {
                            firstName = cleanCells[cellIdx];
                            lastName = cleanCells[cellIdx + 1];
                        } else if (cleanCells[cellIdx]) {
                            const parsed = splitFullName(cleanCells[cellIdx]);
                            firstName = parsed.firstName;
                            middleName = parsed.middleName;
                            lastName = parsed.lastName;
                        }
                    }

                    const fClean = (firstName || '').toUpperCase().replace(/[^A-Z]/g, '');
                    const mClean = (middleName || '').toUpperCase().replace(/[^A-Z]/g, '');
                    const lClean = (lastName || '').toUpperCase().replace(/[^A-Z]/g, '');

                    // Skip header row strings if they slipped through as content rows
                    if (fClean === 'FIRSTNAME' || lClean === 'LASTNAME' || fClean === 'FIRST' || lClean === 'LAST' || mClean.includes('MIDDLEINITIAL') || mClean.includes('MIDDLENAME')) {
                        continue;
                    }

                    if (firstName || lastName) {
                        rawRecords.push({
                            firstName: (firstName || '').toUpperCase(),
                            middleName: (middleName || '').toUpperCase(),
                            lastName: (lastName || '').toUpperCase(),
                            batch: currentBatch,
                            studentId: studentId,
                            course: course
                        });
                    }
                }

                resolve(rawRecords);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function extractPdfText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!window.pdfjsLib) {
                    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
                }
                if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                }

                const typedarray = new Uint8Array(e.target.result);
                const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();

                    let pageText = '';
                    for (const item of textContent.items) {
                        pageText += item.str;
                        if (item.hasEOL) {
                            pageText += '\n';
                        }
                    }
                    fullText += pageText + '\n\n';
                }
                resolve(fullText);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function extractDocxText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                resolve(result.value);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function parseDocumentText(text, selectedBatch) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentBatch = selectedBatch || 'Batch 1.2';
    const rawRecords = [];
    let tempNameParts = [];

    for (const line of lines) {
        if (!selectedBatch && line.toLowerCase().includes('batch')) {
            const batchMatch = line.match(/batch\s*(\d+(?:\.\d+)?|[a-z0-9.]+)/i);
            if (batchMatch) {
                currentBatch = `Batch ${batchMatch[1]}`;
                tempNameParts = [];
                continue;
            }
        }

        const lLine = line.toLowerCase();
        if (lLine === 'name' || lLine === 'student' || lLine.includes('last name') || lLine.includes('first name') || lLine.includes('middle name') || lLine === 'no.' || lLine === 'no' || line.length < 2) {
            continue;
        }

        const cleanLine = line.replace(/^[\d\.\-\)\s]+/, '').trim();
        if (cleanLine.length < 2) continue;

        if (cleanLine.includes(',')) {
            const parsed = splitFullName(cleanLine);
            rawRecords.push({
                lastName: parsed.lastName,
                firstName: parsed.firstName,
                middleName: parsed.middleName,
                batch: selectedBatch || currentBatch,
                studentId: '',
                course: 'BSIT'
            });
            tempNameParts = [];
        } else {
            const words = cleanLine.split(/\s+/).filter(Boolean);
            if (words.length >= 2) {
                const parsed = splitFullName(cleanLine);
                rawRecords.push({
                    lastName: parsed.lastName,
                    firstName: parsed.firstName,
                    middleName: parsed.middleName,
                    batch: selectedBatch || currentBatch,
                    studentId: '',
                    course: 'BSIT'
                });
                tempNameParts = [];
            } else if (words.length === 1) {
                tempNameParts.push(cleanLine);
                if (tempNameParts.length === 3) {
                    rawRecords.push({
                        lastName: tempNameParts[2],
                        firstName: tempNameParts[0],
                        middleName: tempNameParts[1],
                        batch: selectedBatch || currentBatch,
                        studentId: '',
                        course: 'BSIT'
                    });
                    tempNameParts = [];
                }
            }
        }
    }

    if (tempNameParts.length > 0) {
        if (tempNameParts.length === 1) {
            const parsed = splitFullName(tempNameParts[0]);
            rawRecords.push({
                lastName: parsed.lastName,
                firstName: parsed.firstName,
                middleName: parsed.middleName,
                batch: selectedBatch || currentBatch,
                studentId: '',
                course: 'BSIT'
            });
        } else if (tempNameParts.length === 2) {
            rawRecords.push({
                firstName: tempNameParts[0],
                middleName: '',
                lastName: tempNameParts[1],
                batch: selectedBatch || currentBatch,
                studentId: '',
                course: 'BSIT'
            });
        } else {
            rawRecords.push({
                firstName: tempNameParts[0],
                middleName: tempNameParts[1],
                lastName: tempNameParts[2],
                batch: selectedBatch || currentBatch,
                studentId: '',
                course: 'BSIT'
            });
        }
    }

    if (rawRecords.length === 0) {
        alert('No grantee names could be clearly extracted from this document.');
        return [];
    }

    return rawRecords;
}

async function checkAndFlagDuplicates(records, selectedBatch, selectedScholarship) {
    const targetScholarship = selectedScholarship || getSelectedImportScholarship() || selectedScholarshipProgram || 'CHED TES';
    const normTargetSch = normalizeScholarshipName(targetScholarship);
    const targetBatch = selectedBatch || 'Batch 1.2';

    let masterDbRows = [];
    let sgRows = [];
    let f2Rows = [];

    try {
        const [masterRes, sgRes, f2Res] = await Promise.all([
            window.supabaseClient
                .from(getTableName())
                .select('*'),
            window.supabaseClient
                .from('student_grantees')
                .select('id, full_name, student_no, studentId, documents, academic_year, semester, scholarship_name, scholarshipProgram, last_name, first_name, middle_name'),
            window.supabaseClient
                .from('annex_form_2')
                .select('id, student_number, last_name, given_name, middle_initial, tes_batch, scholarship_name')
        ]);

        masterDbRows = masterRes?.data || [];
        sgRows = sgRes?.data || [];
        f2Rows = f2Res?.data || [];
    } catch (e) {
        console.warn('Could not query databases for duplicate & scholarship conflict check:', e);
    }

    // Refresh cachedStudentGranteesList with comprehensive records
    const combinedSg = [
        ...sgRows,
        ...f2Rows.map(f2 => ({
            id: f2.id,
            studentId: f2.student_number,
            lastName: f2.last_name,
            firstName: f2.given_name,
            middleName: f2.middle_initial,
            name: `${f2.last_name}, ${f2.given_name} ${f2.middle_initial || ''}`.trim(),
            batch: f2.tes_batch || 'Batch 1.2',
            scholarshipProgram: f2.scholarship_name || 'CHED TES',
            source: 'annex_form_2'
        }))
    ];

    if (typeof StudentSyncService !== 'undefined' && StudentSyncService.getAllStudents) {
        try {
            const syncList = StudentSyncService.getAllStudents();
            if (Array.isArray(syncList)) {
                syncList.forEach(s => combinedSg.push(s));
            }
        } catch (_) { }
    }

    if (cachedStudentGranteesList && cachedStudentGranteesList.length > 0) {
        cachedStudentGranteesList.forEach(c => {
            if (!combinedSg.some(x => x.id && c.id && x.id === c.id)) {
                combinedSg.push(c);
            }
        });
    }
    cachedStudentGranteesList = combinedSg;

    // Build comparable pools
    const studentGranteesPool = (cachedStudentGranteesList || []).map(s => getComparableName(s));

    const combinedMaster = [...masterDbRows];
    (allMasterlistRecords || []).forEach(m => {
        if (!combinedMaster.some(x => x.id && m.id && x.id === m.id)) {
            combinedMaster.push(m);
        }
    });
    const masterPool = combinedMaster.map(m => getComparableName(m));

    loadStudentExistList();
    const studentExistPool = (studentExistList || []).map(e => getComparableName(e));

    const seenInFile = [];
    let skippedCount = 0;
    let importedCount = 0;
    let conflictCount = 0;

    extractedRecords = (records || []).map((r, rIdx) => {
        const recordBatch = r.batch || targetBatch;
        const cand = getComparableName({ ...r, batch: recordBatch, scholarship: targetScholarship });

        let hasScholarshipConflict = false;
        let existingScholarship = '';
        let conflictReason = '';
        let isDuplicate = false;
        let duplicateReason = '';

        if (!cand.last && !cand.first && !cand.cleanFull) {
            isDuplicate = true;
            duplicateReason = 'Empty grantee name';
        }

        // 1. Check duplicate within the uploaded document
        if (!isDuplicate) {
            const fileMatch = seenInFile.find(exist => areNamesMatching(cand, exist));
            if (fileMatch) {
                isDuplicate = true;
                duplicateReason = 'Duplicate entry in uploaded document';
            }
        }

        // 2. Check Student Grantees table (student_grantees & annex_form_2)
        if (!isDuplicate) {
            const sgMatch = studentGranteesPool.find(exist => areNamesMatching(cand, exist));
            if (sgMatch) {
                const regSchNorm = normalizeScholarshipName(sgMatch.scholarship);
                if (regSchNorm && normTargetSch && regSchNorm !== normTargetSch) {
                    hasScholarshipConflict = true;
                    existingScholarship = sgMatch.scholarship || 'Another Scholarship';
                    conflictReason = `Already registered under ${existingScholarship}`;
                    isDuplicate = true;
                    duplicateReason = conflictReason;
                } else if (!r.id) {
                    const existsInMaster = masterPool.some(exist => (!r.id || !exist.id || exist.id !== r.id) && areNamesMatching(cand, exist));
                    if (existsInMaster) {
                        isDuplicate = true;
                        const mBatch = sgMatch.batch || recordBatch;
                        duplicateReason = `Already exists in Student Grantees (${mBatch})`;
                    }
                }
            }
        }

        // 3. Check New Grantees Master List (new_grantees_masterlist & allMasterlistRecords)
        if (!isDuplicate && !r.id) {
            const mlMatch = masterPool.find(exist => (!r.id || !exist.id || exist.id !== r.id) && areNamesMatching(cand, exist));
            if (mlMatch) {
                isDuplicate = true;
                const mBatch = mlMatch.batch || recordBatch;
                duplicateReason = `Already exists in Master List (${mBatch})`;
            }
        }

        // 4. Check Student Exist table
        if (!isDuplicate) {
            const existMatch = studentExistPool.find(exist => areNamesMatching(cand, exist));
            if (existMatch) {
                isDuplicate = true;
                duplicateReason = 'Already in Student Exist table';
            }
        }

        if (hasScholarshipConflict) {
            conflictCount++;
        } else if (isDuplicate) {
            skippedCount++;
        } else {
            importedCount++;
            seenInFile.push(cand);
        }

        return {
            ...r,
            batch: recordBatch,
            scholarshipProgram: targetScholarship,
            academicYear: selectedAcademicYear,
            semester: selectedSemester,
            hasScholarshipConflict,
            existingScholarship,
            conflictReason,
            isDuplicate,
            duplicateReason
        };
    });

    if (summaryExtracted) summaryExtracted.textContent = extractedRecords.length;
    if (summaryImported) summaryImported.textContent = importedCount;
    if (summarySkipped) summarySkipped.textContent = skippedCount;
    if (!summaryConflicts) summaryConflicts = document.getElementById('summary-conflicts');
    if (summaryConflicts) summaryConflicts.textContent = conflictCount;
    if (summaryErrors) summaryErrors.textContent = 0;
    if (importSummaryCard) importSummaryCard.classList.remove('hidden');

    const conflictContainer = document.getElementById('summary-conflicts-container');
    if (conflictContainer) {
        conflictContainer.style.display = conflictCount > 0 ? 'block' : 'none';
    }

    if (!importConflictAlert) importConflictAlert = document.getElementById('import-conflict-alert');
    if (!importConflictAlertText) importConflictAlertText = document.getElementById('import-conflict-alert-text');
    if (importConflictAlert) {
        if (conflictCount > 0) {
            importConflictAlert.classList.remove('hidden');
            const conflictPrograms = [...new Set(extractedRecords.filter(r => r.hasScholarshipConflict).map(r => r.existingScholarship))];
            if (importConflictAlertText) {
                importConflictAlertText.textContent = `Warning: ${conflictCount} student${conflictCount > 1 ? 's are' : ' is'} already registered under another scholarship program (${conflictPrograms.join(', ')}). Conflicting records will be excluded from import.`;
            }
        } else {
            importConflictAlert.classList.add('hidden');
        }
    }

    populateBatchFilter();
    renderTable();

    return { skippedCount, importedCount, conflictCount };
}

// â”€â”€ Fully Automatic Pipeline: Extract -> Display in Table -> Save to Database â”€â”€
async function executeAutoImportPipeline(file, explicitBatch, explicitTerm, explicitScholarship) {
    if (!file) return;
    if (isImportingMasterlist || window.__isImportingMasterlist) return;

    isImportingMasterlist = true;
    window.__isImportingMasterlist = true;
    try {
        const selectedTerm = explicitTerm || getSelectedImportTerm();
        if (!selectedTerm) {
            return;
        }

        const selectedScholarship = explicitScholarship || getSelectedImportScholarship();
        if (!selectedScholarship) {
            return;
        }

        const selectedBatch = explicitBatch || getSelectedImportBatch();
        if (!selectedBatch) {
            return;
        }

        if (btnExtract) {
            btnExtract.disabled = true;
            btnExtract.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Auto-Extracting...';
        }
        if (ocrProgressContainer) ocrProgressContainer.classList.remove('hidden');
        if (ocrStatusText) ocrStatusText.textContent = `Extracting grantee data for ${selectedScholarship} • ${selectedBatch} (${selectedTerm.academicYear} • ${selectedTerm.semester})...`;
        if (ocrProgressBar) {
            ocrProgressBar.style.width = '35%';
            ocrProgressBar.style.animation = 'pulse 1.5s infinite';
        }

        extractedRecords = [];
        if (importSummaryCard) importSummaryCard.classList.add('hidden');
        populateBatchFilter();
        renderTable();

        const ext = file.name.split('.').pop().toLowerCase();
        let rawRecords = [];

        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            rawRecords = await extractExcelOrCsv(file, selectedBatch);
        } else if (ext === 'pdf') {
            const text = await extractPdfText(file);
            rawRecords = await parseDocumentText(text, selectedBatch);
        } else if (ext === 'docx' || ext === 'doc') {
            const text = await extractDocxText(file);
            rawRecords = await parseDocumentText(text, selectedBatch);
        }

        if (!rawRecords || rawRecords.length === 0) {
            alert('No grantee records could be clearly extracted from this file.');
            if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
            if (btnExtract) {
                btnExtract.disabled = false;
                btnExtract.innerHTML = '<i class="icon-settings"></i> Extract Grantees Data';
            }
            return;
        }

        // Guarantee batch and scholarship program are assigned to every single record
        rawRecords.forEach(r => {
            r.batch = selectedBatch;
            r.scholarshipProgram = selectedScholarship;
        });

        // Step 2: Validate & Flag duplicates and scholarship conflicts, immediately display in table
        if (ocrStatusText) ocrStatusText.textContent = `Validating records & checking scholarship conflicts for ${selectedScholarship} (${selectedBatch})...`;
        if (ocrProgressBar) ocrProgressBar.style.width = '65%';

        const { skippedCount, importedCount, conflictCount } = await checkAndFlagDuplicates(rawRecords, selectedBatch, selectedScholarship);

        // Step 3: Automatically Save unique, non-conflicting records to database
        const validToInsert = extractedRecords.filter(r => !r.isDuplicate && !r.hasScholarshipConflict);

        if (validToInsert.length > 0) {
            if (ocrStatusText) ocrStatusText.textContent = `Auto-saving ${validToInsert.length} new grantees (${selectedScholarship} • ${selectedBatch}) to database...`;
            if (ocrProgressBar) ocrProgressBar.style.width = '85%';

            const tableName = getTableName();
            const toInsert = validToInsert.map(r => ({
                last_name: r.lastName,
                first_name: r.firstName,
                middle_name: r.middleName || '',
                name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim(),
                batch: r.batch || selectedBatch,
                academic_year: selectedTerm.academicYear,
                semester: selectedTerm.semester
            }));

            let insertedData = null;
            let { data: resData, error: insertErr } = await window.supabaseClient
                .from(tableName)
                .insert(toInsert)
                .select();

            if (insertErr) {
                // If academic_year, semester, or batch column not present, fallback with batch only or base columns
                console.warn("Table insert fallback: Trying without term columns or batch if not existing.", insertErr);
                const toInsertFallback = validToInsert.map(r => ({
                    last_name: r.lastName,
                    first_name: r.firstName,
                    middle_name: r.middleName || '',
                    name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim(),
                    batch: r.batch || selectedBatch
                }));
                const { data: fbData, error: fbErr } = await window.supabaseClient
                    .from(tableName)
                    .insert(toInsertFallback)
                    .select();
                if (fbErr) {
                    const toInsertFallbackNoBatch = validToInsert.map(r => ({
                        last_name: r.lastName,
                        first_name: r.firstName,
                        middle_name: r.middleName || '',
                        name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim()
                    }));
                    const { data: noBatchData, error: noBatchErr } = await window.supabaseClient
                        .from(tableName)
                        .insert(toInsertFallbackNoBatch)
                        .select();
                    if (noBatchErr) throw noBatchErr;
                    insertedData = noBatchData;
                } else {
                    insertedData = fbData;
                }
            } else {
                insertedData = resData;
            }

            // Link returned Supabase database IDs back to in-memory records
            if (insertedData && insertedData.length > 0) {
                let insIdx = 0;
                extractedRecords.forEach(r => {
                    if (!r.isDuplicate && !r.hasScholarshipConflict && insIdx < insertedData.length) {
                        r.id = insertedData[insIdx].id;
                        insIdx++;
                    }
                });
            }
        }

        // Merge newly saved unique records into allMasterlistRecords master state
        validToInsert.forEach(r => {
            const cand = getComparableName(r);
            const existing = allMasterlistRecords.find(x =>
                (x.id && r.id && x.id === r.id) ||
                areNamesMatching(getComparableName(x), cand)
            );
            if (existing) {
                existing.batch = selectedBatch;
                existing.scholarshipProgram = selectedScholarship;
                existing.academicYear = selectedTerm.academicYear;
                existing.semester = selectedTerm.semester;
                if (r.id && !existing.id) existing.id = r.id;
            } else {
                allMasterlistRecords.push({
                    ...r,
                    batch: selectedBatch,
                    scholarshipProgram: selectedScholarship,
                    academicYear: selectedTerm.academicYear,
                    semester: selectedTerm.semester
                });
            }
        });

        // Cache grantee batches, terms, and scholarships locally
        cacheGranteeBatches(allMasterlistRecords);
        cacheGranteeTerms(allMasterlistRecords, selectedTerm.academicYear, selectedTerm.semester);
        cacheGranteeScholarships(validToInsert, selectedScholarship);

        const cleanBatch = String(selectedBatch).replace(/^batch\s*/i, '').trim();

        // Update student_grantees records in database ONLY for non-conflicting records
        try {
            const { data: existingSgList } = await window.supabaseClient
                .from('student_grantees')
                .select('*');

            const toUpdateSg = [];
            (validToInsert || []).forEach(importedR => {
                const impLast = (importedR.lastName || importedR.last_name || '').toLowerCase().trim();
                const impFirst = (importedR.firstName || importedR.first_name || '').toLowerCase().trim();
                const impId = String(importedR.studentId || importedR.student_id || '').trim();

                const matchedSg = (existingSgList || []).find(sg => {
                    const sgId = String(sg.student_no || sg.studentId || '').trim();
                    if (impId && sgId && impId === sgId) return true;
                    const sgLast = (sg.last_name || '').toLowerCase().trim();
                    const sgFirst = (sg.first_name || sg.given_name || '').toLowerCase().trim();
                    if (impLast && sgLast && impLast === sgLast) {
                        if (!impFirst || !sgFirst || impFirst === sgFirst || impFirst.includes(sgFirst) || sgFirst.includes(impFirst)) return true;
                    }
                    const sgName = String(sg.full_name || sg.fullName || '').toLowerCase().trim();
                    return impLast && sgName.includes(impLast);
                });

                if (matchedSg) {
                    const updatedDocs = {
                        ...(matchedSg.documents || {}),
                        batch: selectedBatch,
                        scholarshipName: selectedScholarship
                    };
                    toUpdateSg.push(window.supabaseClient
                        .from('student_grantees')
                        .update({
                            scholarship_name: selectedScholarship,
                            academic_year: selectedTerm.academicYear,
                            academicYear: selectedTerm.academicYear,
                            semester: selectedTerm.semester,
                            documents: updatedDocs,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', matchedSg.id));
                }
            });

            if (toUpdateSg.length > 0) {
                await Promise.all(toUpdateSg);
                console.log(`Assigned scholarship ${selectedScholarship}, A.Y. ${selectedTerm.academicYear} (${selectedTerm.semester}) & ${selectedBatch} to ${toUpdateSg.length} student_grantees.`);
            }
        } catch (sgErr) {
            console.warn('Error assigning batch & scholarship to student_grantees:', sgErr);
        }

        // If target scholarship is TES or CHED TES, update annex_form_2
        if (normalizeScholarshipName(selectedScholarship) === 'CHED TES') {
            try {
                const { data: existingF2List } = await window.supabaseClient
                    .from('annex_form_2')
                    .select('*');

                if (existingF2List && existingF2List.length > 0) {
                    const toUpdateF2 = [];
                    (validToInsert || []).forEach(importedR => {
                        const impLast = (importedR.lastName || importedR.last_name || '').toLowerCase().trim();
                        const impFirst = (importedR.firstName || importedR.first_name || '').toLowerCase().trim();
                        const impId = String(importedR.studentId || importedR.student_id || '').trim();

                        const matchedF2 = existingF2List.find(f2 => {
                            const f2No = String(f2.student_number || '').trim();
                            if (impId && f2No && impId === f2No) return true;
                            const f2Last = (f2.last_name || '').toLowerCase().trim();
                            const f2First = (f2.given_name || '').toLowerCase().trim();
                            if (impLast && f2Last && impLast === f2Last) {
                                if (!impFirst || !f2First || impFirst === f2First || impFirst.includes(f2First) || f2First.includes(impFirst)) return true;
                            }
                            return false;
                        });

                        if (matchedF2) {
                            toUpdateF2.push(window.supabaseClient
                                .from('annex_form_2')
                                .update({
                                    tes_batch: cleanBatch,
                                    academic_year: selectedTerm.academicYear,
                                    semester: selectedTerm.semester,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', matchedF2.id));
                        }
                    });

                    if (toUpdateF2.length > 0) {
                        await Promise.all(toUpdateF2);
                        console.log(`Updated tes_batch: ${cleanBatch} on ${toUpdateF2.length} annex_form_2 records.`);
                    }
                }
            } catch (f2Err) {
                console.warn('Error updating annex_form_2 batch:', f2Err);
            }
        }

        // Update in-memory verifiedForm2List
        if (Array.isArray(verifiedForm2List)) {
            verifiedForm2List.forEach(f2Item => {
                const g = f2Item.grantee || {};
                const s = f2Item.matchedStudent || {};
                const gLast = (g.last_name || s.lastName || s.last_name || '').toLowerCase().trim();
                const gFirst = (g.first_name || s.firstName || s.first_name || '').toLowerCase().trim();
                const gId = String(g.student_id || s.studentId || s.student_no || '').trim();

                const matchesImport = (validToInsert || []).some(imp => {
                    const impLast = (imp.lastName || imp.last_name || '').toLowerCase().trim();
                    const impFirst = (imp.firstName || imp.first_name || '').toLowerCase().trim();
                    const impId = String(imp.studentId || imp.student_id || '').trim();
                    if (gId && impId && gId === impId) return true;
                    if (gLast && impLast && gLast === impLast) {
                        if (!gFirst || !impFirst || gFirst === impFirst || gFirst.includes(impFirst) || impFirst.includes(gFirst)) return true;
                    }
                    return false;
                });

                if (matchesImport) {
                    if (f2Item.grantee) f2Item.grantee.batch = cleanBatch;
                    if (f2Item.matchedStudent) {
                        f2Item.matchedStudent.batch = selectedBatch;
                        if (f2Item.matchedStudent.documents) f2Item.matchedStudent.documents.batch = selectedBatch;
                    }
                }
            });
            updateAnnexKPIs();
            renderAnnexForm2Table(verifiedForm2List);
        }

        let conflictMsg = conflictCount > 0 ? ` (${conflictCount} conflict${conflictCount > 1 ? 's' : ''} excluded)` : '';
        let dupMsg = skippedCount > 0 ? ` (${skippedCount} duplicate${skippedCount > 1 ? 's' : ''} skipped)` : '';

        if (validToInsert.length > 0) {
            if (ocrStatusText) ocrStatusText.textContent = `Complete: Auto-saved ${validToInsert.length} grantees (${selectedScholarship} • ${selectedBatch}) to database!`;
            if (ocrProgressBar) ocrProgressBar.style.width = '100%';

            if (window.showToast) {
                window.showToast(`Auto-saved ${validToInsert.length} grantees (${selectedScholarship} • ${selectedTerm.academicYear} • ${selectedTerm.semester} • ${selectedBatch})!${conflictMsg}${dupMsg}`, 'check-circle');
            }

            // Notify Registrar of newly imported grantees ready for review
            try {
                await window.supabaseClient.from('notifications').insert([{
                    studentId: 'admin',
                    title: `Record Update: New Grantees Uploaded (${selectedScholarship})`,
                    message: `Super Admin uploaded and saved ${validToInsert.length} new scholarship grantees (${selectedScholarship} • ${selectedTerm.academicYear} • ${selectedTerm.semester} • ${selectedBatch || 'Batch 1.2'}). Records are ready for Registrar review.`,
                    type: 'success',
                    isRead: false,
                    timestamp: new Date().toISOString()
                }]);
            } catch (_) { }

            // Log activity notification for Super Admin
            try {
                if (window.SuperAdminNotificationService) {
                    await window.SuperAdminNotificationService.notifySubmission({
                        title: `New Grantees Masterlist Uploaded (${selectedScholarship})`,
                        message: `Successfully uploaded and saved ${validToInsert.length} new scholarship grantees (${selectedScholarship} • ${selectedTerm.academicYear} • ${selectedTerm.semester} • ${selectedBatch || 'Batch 1.2'}).`,
                        type: 'success',
                        metadata: { count: validToInsert.length, scholarship: selectedScholarship, academicYear: selectedTerm.academicYear, semester: selectedTerm.semester, batch: selectedBatch }
                    });
                }
            } catch (_) { }
        } else {
            if (conflictCount > 0 && skippedCount === 0) {
                if (ocrStatusText) ocrStatusText.textContent = `Completed: ${conflictCount} student${conflictCount > 1 ? 's were' : ' was'} excluded due to conflicts with existing scholarship programs. 0 duplicate records created.`;
                if (ocrProgressBar) ocrProgressBar.style.width = '100%';
                if (window.showToast) {
                    window.showToast(`${conflictCount} student${conflictCount > 1 ? 's were' : ' was'} excluded due to existing scholarship registrations.${dupMsg}`, 'alert-triangle');
                }
            } else if (skippedCount > 0) {
                if (ocrStatusText) ocrStatusText.textContent = `Completed: All ${extractedRecords.length} records already exist in Student Grantees / Master List. Flagged in red (0 duplicates saved).`;
                if (ocrProgressBar) ocrProgressBar.style.width = '100%';
                if (window.showToast) {
                    window.showToast(`All ${extractedRecords.length} student(s) already exist in Student Grantees / Master List. Flagged in red (0 duplicate records saved).`, 'alert-circle');
                }
            } else {
                if (ocrStatusText) ocrStatusText.textContent = `Completed: No new unique records to import.`;
                if (ocrProgressBar) ocrProgressBar.style.width = '100%';
            }
        }

        // Render extracted records with duplicate indicators and update badges
        if (selectedTerm.academicYear) selectedAcademicYear = selectedTerm.academicYear;
        if (selectedTerm.semester) selectedSemester = selectedTerm.semester;
        if (selectedScholarship) selectedScholarshipProgram = selectedScholarship;
        updateStep1TargetTermBadge(selectedTerm.academicYear, selectedTerm.semester);
        updateStep2TermIndicator(selectedTerm.academicYear, selectedTerm.semester);
        populateBatchFilter();
        renderTable();
        updateClearMasterlistButtonVisibility();

        // Sync with Annex 5 and verification for active term grantees (only truly new, non-duplicate grantees)
        const validGrantees = (extractedRecords || []).filter(r => !r.isDuplicate && !r.hasScholarshipConflict);
        const granteesForVerification = validGrantees.map(m => ({
            id: m.id,
            name: m.name || `${m.lastName || m.last_name || ''}, ${m.firstName || m.first_name || ''} ${m.middleName || m.middle_name || ''}`.trim(),
            last_name: m.lastName || m.last_name,
            first_name: m.firstName || m.first_name,
            middle_name: m.middleName || m.middle_name,
            batch: m.batch || selectedBatch,
            student_id: m.studentId || m.student_id || '',
            course: m.course || 'BSIT',
            year: '1',
            academic_year: selectedTerm.academicYear,
            semester: selectedTerm.semester,
            scholarship_type: selectedScholarship
        }));
        await loadSchoolStudentsAndVerify(granteesForVerification);

        // Ensure all verified Form 2 students are immediately synced to Student Grantees
        if (StudentSyncService && typeof StudentSyncService.loadAndSyncStudents === 'function') {
            await StudentSyncService.loadAndSyncStudents();
        }

        if (btnExtract) {
            btnExtract.disabled = true;
            btnExtract.innerHTML = '<i class="icon-check" style="font-size: 16px;"></i> File Processed Automatically';
        }

    } catch (err) {
        console.error('Auto-import pipeline error:', err);
        alert(`Auto-import error: ${err.message || 'Check console'}`);
        if (summaryErrors) summaryErrors.textContent = 1;
        if (ocrStatusText) ocrStatusText.textContent = `Error: ${err.message}`;
        if (btnExtract) {
            btnExtract.disabled = false;
            btnExtract.innerHTML = '<i class="icon-refresh-cw" style="font-size: 16px;"></i> Retry Import';
        }
    } finally {
        isImportingMasterlist = false;
        window.__isImportingMasterlist = false;
        setTimeout(() => {
            if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
        }, 3000);
        if (window.lucide) window.lucide.createIcons();
    }
}

function populateBatchFilter() {
    if (extractedRecords.length === 0) {
        if (filterBatch) filterBatch.classList.add('hidden');
        return;
    }

    if (!filterBatch) return;

    const currentFilter = filterBatch.value || 'All Batches';
    const batches = [...new Set(extractedRecords.map(r => {
        const raw = r.batch || '1.2';
        return String(raw).replace(/^batch\s*/i, '').trim() || '1.2';
    }))].sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    filterBatch.innerHTML = '<option value="All Batches">All Batches</option>';
    batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = `Batch ${b}`;
        if (b === currentFilter || `Batch ${b}` === currentFilter) opt.selected = true;
        filterBatch.appendChild(opt);
    });

    filterBatch.classList.remove('hidden');
}

function updateClearMasterlistButtonVisibility() {
    if (btnClearMasterlist) {
        if (extractedRecords && extractedRecords.length > 0) {
            btnClearMasterlist.classList.remove('hidden');
            btnClearMasterlist.style.display = 'inline-flex';
        } else {
            btnClearMasterlist.classList.add('hidden');
            btnClearMasterlist.style.display = 'none';
        }
    }
}

function renderTable() {
    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    if (!extractedTableBody) return;
    updateClearMasterlistButtonVisibility();

    // Update duplicate detection badge and Move All button
    const dupCount = (extractedRecords || []).filter(r => r.isDuplicate || r.hasScholarshipConflict).length;
    if (!badgeMasterlistDuplicates) badgeMasterlistDuplicates = document.getElementById('badge-masterlist-duplicates');
    if (!countMasterlistDuplicates) countMasterlistDuplicates = document.getElementById('count-masterlist-duplicates');
    if (!btnMoveAllDuplicates) btnMoveAllDuplicates = document.getElementById('btn-move-all-duplicates');

    if (badgeMasterlistDuplicates) {
        if (dupCount > 0) {
            badgeMasterlistDuplicates.classList.remove('hidden');
            badgeMasterlistDuplicates.style.display = 'inline-flex';
            if (countMasterlistDuplicates) countMasterlistDuplicates.textContent = dupCount;
        } else {
            badgeMasterlistDuplicates.classList.add('hidden');
            badgeMasterlistDuplicates.style.display = 'none';
        }
    }
    if (btnMoveAllDuplicates) {
        if (dupCount > 0) {
            btnMoveAllDuplicates.classList.remove('hidden');
            btnMoveAllDuplicates.style.display = 'inline-flex';
            btnMoveAllDuplicates.innerHTML = `<i class="icon-arrow-right" style="font-size: 12px;"></i> Move All Duplicates (${dupCount}) to Student Exist`;
        } else {
            btnMoveAllDuplicates.classList.add('hidden');
            btnMoveAllDuplicates.style.display = 'none';
        }
    }

    if (extractedRecords.length === 0) {
        const hasFilter = (selectedAcademicYear && selectedAcademicYear !== 'All') || (selectedSemester && selectedSemester !== 'All');
        const termLabel = (selectedAcademicYear !== 'All' ? `A.Y. ${selectedAcademicYear}` : 'All School Years') +
            (selectedSemester !== 'All' ? ` (${selectedSemester})` : '');
        extractedTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 60px 20px; color: var(--text-secondary); font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <div style="position: relative;">
                            <i class="icon-file-search" style="font-size: 44px; color: #cbd5e1; opacity: 0.6;"></i>
                            <i class="icon-filter" style="font-size: 18px; color: var(--primary-color); position: absolute; bottom: -2px; right: -4px;"></i>
                        </div>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${hasFilter ? `No grantees found for ${termLabel}` : 'No grantees in masterlist'}</span>
                        <span style="font-size: 12px; max-width: 340px; line-height: 1.5; color: var(--text-secondary);">${hasFilter ? 'Select another school year / semester above, or upload a document in Step 1 to import new grantees for this term.' : 'Upload a document and extract data in Step 1 to see new grantees listed here.'}</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    const filterValue = (filterBatch && filterBatch.value && filterBatch.value.trim() !== '') ? filterBatch.value.trim() : 'All Batches';

    const displayRecords = extractedRecords.map((record, index) => ({ record, index }))
        .filter(item => {
            if (filterValue === 'All Batches') return true;
            const recB = String(item.record.batch || '1.2').trim();
            const fVal = String(filterValue).trim();
            const recClean = recB.replace(/^batch\s*/i, '');
            const fClean = fVal.replace(/^batch\s*/i, '');
            return recB.toLowerCase() === fVal.toLowerCase() || recClean === fClean;
        });

    if (displayRecords.length === 0) {
        extractedTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 60px 20px; color: var(--text-secondary); font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="icon-filter" style="font-size: 38px; color: #cbd5e1;"></i>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">No records match batch "${filterValue}"</span>
                        <span style="font-size: 12px; color: var(--text-secondary);">Try selecting "All Batches" to see all grantees for this term.</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    extractedTableBody.innerHTML = '';
    displayRecords.forEach(({ record, index }) => {
        const tr = document.createElement('tr');

        let statusBadge = '';
        if (record.hasScholarshipConflict) {
            tr.style.background = 'rgba(254, 226, 226, 0.45)';
            tr.style.borderLeft = '4px solid #ef4444';
            statusBadge = `<span class="badge-scholarship-conflict" title="${record.conflictReason || `Already registered in ${record.existingScholarship}`}" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1.5px solid rgba(239, 68, 68, 0.38); padding: 3px 8px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; white-space: nowrap;">
                <i class="icon-alert-triangle" style="font-size: 13px; color: #ef4444;"></i>
                Registered in: ${record.existingScholarship}
            </span>`;
        } else if (record.isDuplicate) {
            tr.style.background = 'rgba(254, 226, 226, 0.45)';
            tr.style.borderLeft = '4px solid #ef4444';
            statusBadge = `<span class="badge-duplicate-indicator" title="${record.duplicateReason || 'Duplicate student already exists in masterlist'}" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1.5px solid rgba(239, 68, 68, 0.38); padding: 3px 8px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; white-space: nowrap;">
                <i class="icon-alert-circle" style="font-size: 13px; color: #ef4444;"></i>
                ${record.duplicateReason || 'Already Exists'}
            </span>`;
        }

        tr.innerHTML = `
            <td style="padding: 6px 12px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <input type="text" class="input-clean edit-first-name" data-index="${index}" value="${record.firstName || ''}" style="flex: 1; min-width: 120px;">
                    ${statusBadge}
                </div>
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-middle-name" data-index="${index}" value="${record.middleName || ''}">
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-last-name" data-index="${index}" value="${record.lastName || ''}">
            </td>
            <td style="padding: 6px 12px; white-space: nowrap;">
                <span class="badge-batch-pill" title="Assigned Batch">
                    <i class="icon-layers" style="font-size: 11px;"></i>
                    ${String(record.batch || '1.2').replace(/^batch\s*/i, '').trim()}
                </span>
            </td>
            <td style="padding: 6px 12px; text-align: center; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: center;">
                    <button type="button" class="btn-action-move" data-index="${index}" title="Move to Student Exist table"
                        style="padding: 5px 10px; border-radius: 8px; border: 1px solid ${record.isDuplicate || record.hasScholarshipConflict ? '#fca5a5' : '#cbd5e1'}; background: ${record.isDuplicate || record.hasScholarshipConflict ? 'rgba(239, 68, 68, 0.12)' : 'rgba(241, 245, 249, 0.8)'}; color: ${record.isDuplicate || record.hasScholarshipConflict ? '#dc2626' : '#475569'}; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
                        <i class="icon-arrow-right" style="font-size: 11px;"></i> Move
                    </button>
                    <button type="button" class="btn-action-delete" data-index="${index}" title="Delete record from masterlist"
                        style="padding: 5px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: rgba(241, 245, 249, 0.8); color: #64748b; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
                        <i class="icon-trash-2" style="font-size: 11px;"></i> Delete
                    </button>
                </div>
            </td>
        `;
        extractedTableBody.appendChild(tr);
    });

    // Wire listeners for Move & Delete actions
    extractedTableBody.querySelectorAll('.btn-action-move').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            moveRecordToStudentExist(idx);
        });
    });

    extractedTableBody.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            deleteMasterlistRecord(idx);
        });
    });

    // Listeners for inline edits
    document.querySelectorAll('.edit-first-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            if (extractedRecords[idx]) {
                extractedRecords[idx].firstName = val;
                const mRec = allMasterlistRecords.find(x => x.id && x.id === extractedRecords[idx].id);
                if (mRec) mRec.firstName = val;
                if (extractedRecords[idx].id) {
                    try {
                        await window.supabaseClient.from(getTableName()).update({
                            first_name: val,
                            name: `${extractedRecords[idx].lastName || ''}, ${val} ${extractedRecords[idx].middleName || ''}`.trim()
                        }).eq('id', extractedRecords[idx].id);
                    } catch (err) {
                        console.warn('Error updating first name:', err);
                    }
                }
            }
        });
    });

    document.querySelectorAll('.edit-middle-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            if (extractedRecords[idx]) {
                extractedRecords[idx].middleName = val;
                const mRec = allMasterlistRecords.find(x => x.id && x.id === extractedRecords[idx].id);
                if (mRec) mRec.middleName = val;
                if (extractedRecords[idx].id) {
                    try {
                        await window.supabaseClient.from(getTableName()).update({
                            middle_name: val,
                            name: `${extractedRecords[idx].lastName || ''}, ${extractedRecords[idx].firstName || ''} ${val}`.trim()
                        }).eq('id', extractedRecords[idx].id);
                    } catch (err) {
                        console.warn('Error updating middle name:', err);
                    }
                }
            }
        });
    });

    document.querySelectorAll('.edit-last-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            if (extractedRecords[idx]) {
                extractedRecords[idx].lastName = val;
                const mRec = allMasterlistRecords.find(x => x.id && x.id === extractedRecords[idx].id);
                if (mRec) mRec.lastName = val;
                if (extractedRecords[idx].id) {
                    try {
                        await window.supabaseClient.from(getTableName()).update({
                            last_name: val,
                            name: `${val}, ${extractedRecords[idx].firstName || ''} ${extractedRecords[idx].middleName || ''}`.trim()
                        }).eq('id', extractedRecords[idx].id);
                    } catch (err) {
                        console.warn('Error updating last name:', err);
                    }
                }
            }
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

async function saveRecordsToDatabase() {
    const validToInsert = extractedRecords.filter(r => !r.isDuplicate && !r.hasScholarshipConflict);

    if (validToInsert.length === 0) {
        if (extractedRecords.some(r => r.hasScholarshipConflict)) {
            alert('Cannot save: All records either have scholarship conflicts or are duplicates.');
        } else {
            alert('No new unique grantee records to save.');
        }
        return;
    }

    const originalText = btnSaveRecords ? btnSaveRecords.innerHTML : '';
    if (btnSaveRecords) {
        btnSaveRecords.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';
        btnSaveRecords.disabled = true;
    }

    try {
        const tableName = getTableName();
        const toInsert = validToInsert.map(r => ({
            last_name: r.lastName,
            first_name: r.firstName,
            middle_name: r.middleName || '',
            name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim(),
            batch: r.batch || 'Batch 1.1'
        }));

        let insertedData = null;
        const { data: resData, error } = await window.supabaseClient
            .from(tableName)
            .insert(toInsert)
            .select();

        if (error) {
            if (error.code === 'PGRST204' || error.code === '42703' || String(error.message || '').includes('batch')) {
                console.warn("Table does not have 'batch' column in schema yet. Inserting without batch column and caching batch locally.", error);
                const toInsertFallback = validToInsert.map(r => ({
                    last_name: r.lastName,
                    first_name: r.firstName,
                    middle_name: r.middleName || '',
                    name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim()
                }));
                const { data: fbData, error: fbErr } = await window.supabaseClient
                    .from(tableName)
                    .insert(toInsertFallback)
                    .select();
                if (fbErr) throw fbErr;
                insertedData = fbData;
            } else {
                throw error;
            }
        } else {
            insertedData = resData;
        }

        cacheGranteeBatches(validToInsert);

        if (btnSaveRecords) {
            btnSaveRecords.innerHTML = `<i class="icon-check" style="color: white;"></i> Saved ${validToInsert.length} Grantees to Masterlist`;
            btnSaveRecords.classList.remove('btn-gradient-save');
            btnSaveRecords.style.background = '#10b981';
        }

        // 1. Notify Registrar of newly imported grantees ready for Annex 5 TES Billing
        try {
            await window.supabaseClient.from('notifications').insert([{
                studentId: 'admin',
                title: 'Record Update: New Grantees Masterlist Uploaded',
                message: `Super Admin uploaded and saved ${validToInsert.length} new scholarship grantees (${selectedAcademicYear || 'A.Y. 2024-2025'} \u2022 ${selectedSemester || '1st Sem'}). Records are ready for Registrar Annex 5 TES Billing review.`,
                type: 'success',
                isRead: false,
                timestamp: new Date().toISOString()
            }]);
        } catch (_) { }

        // 2. Log activity notification for Super Admin
        try {
            if (window.SuperAdminNotificationService) {
                await window.SuperAdminNotificationService.notifySubmission({
                    title: 'New Grantees Masterlist Uploaded',
                    message: `Successfully uploaded and saved ${validToInsert.length} new scholarship grantees (${selectedAcademicYear || 'A.Y. 2024-2025'} \u2022 ${selectedSemester || '1st Sem'}). Registrar notified for Annex 5 review.`,
                    type: 'success',
                    metadata: { count: validToInsert.length, academicYear: selectedAcademicYear, semester: selectedSemester }
                });
            }
        } catch (_) { }

        await fetchExistingMasterlist();

    } catch (err) {
        console.error('Error saving masterlist:', err);
        alert(`Failed to save records: ${err.message || 'Check console'}`);
        if (btnSaveRecords) {
            btnSaveRecords.innerHTML = originalText;
            btnSaveRecords.disabled = false;
        }
    }
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

    // 4. MM/DD/YYYY or DD/MM/YYYY or MM/DD/YY
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
            d = String(p1).padStart(2, '0');
            m = String(p2).padStart(2, '0');
        } else {
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

// Helper: Map School Student Record to standard shape
function mapSchoolStudentRecord(s, studentProfileMap = new Map()) {
    const sNo = String(s.student_no || s.studentId || s.studentNo || '').trim();
    const sName = String(s.full_name || s.fullName || s.name || '').trim().toLowerCase();
    const matchedSt = studentProfileMap.get(sNo) || studentProfileMap.get(sName);
    const scholarship = s.scholarship_name || s.scholarship || (matchedSt ? (matchedSt.scholarship_name || matchedSt.scholarshipProgram || matchedSt.scholarshipName) : null) || 'TES';

    const rawDob = s.date_of_birth || s.dateOfBirth || s.birthdate || s.dob || '';
    const formattedDob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : '';
    let ageVal = s.age;
    if (!ageVal || ageVal === 'N/A' || isNaN(ageVal)) {
        ageVal = formattedDob ? calculateAge(formattedDob) : '';
    }

    const fatherFullName = (s.father_full_name || s.fatherFullName || s.fatherName || '').trim();
    const fatherOccupation = (s.father_occupation || s.fatherOccupation || s.fatherEduStatus || '').trim();
    const motherFullName = (s.mother_full_name || s.motherFullName || s.motherName || '').trim();
    const motherOccupation = (s.mother_occupation || s.motherOccupation || s.motherEduStatus || '').trim();

    // Extract authentic student-submitted SA number ('N/A' by default until submitted by student)
    const resolvedSa = matchedSt ? AnnexSyncService.extractAuthenticSaNumber(matchedSt) : 'N/A';

    return {
        id: s.id,
        uid: s.student_no || s.studentNo || s.studentId || s.id || Math.random().toString(36).substring(2),
        studentNo: s.student_no || s.studentNo || s.studentId || '',
        studentId: s.student_no || s.studentNo || s.studentId || '',
        saNumber: resolvedSa,
        sa_number: resolvedSa,
        tes_application_number: resolvedSa,
        fullName: s.full_name || s.fullName || s.name || '',
        name: s.full_name || s.fullName || s.name || '',
        programName: s.program_name || s.programName || s.course || '',
        course: s.program_name || s.programName || s.course || '',
        yearLevel: s.year_level || s.yearLevel || s.year || '',
        year: s.year_level || s.yearLevel || s.year || '',
        dateOfBirth: formattedDob,
        birthdate: formattedDob,
        dob: formattedDob,
        age: ageVal,
        gender: (s.gender || s.sex || '').trim(),
        civilStatus: (s.civil_status || s.civilStatus || '').trim() || 'Single',
        religion: (s.religion || '').trim(),
        mobileNumber: (s.mobile_number || s.mobileNumber || s.phone || '').trim(),
        phone: (s.mobile_number || s.mobileNumber || s.phone || '').trim(),
        emailAddress: (s.email_address || s.emailAddress || s.email || '').trim(),
        email: (s.email_address || s.emailAddress || s.email || '').trim(),
        authEmail: (s.email_address || s.emailAddress || s.email || '').trim(),
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
            religion: (s.religion || '').trim(),
            civilStatus: (s.civil_status || s.civilStatus || '').trim() || 'Single'
        },
        scholarship: scholarship,
        scholarshipName: scholarship,
        status: (matchedSt && matchedSt.status) || 'Enrolled'
    };
}

// â”€â”€ Render School Student Records Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderSchoolStudentsTable(students) {
    const tbody = document.getElementById('tbody-school-students');
    const countEl = document.getElementById('school-students-count');
    if (countEl) countEl.textContent = (students || []).length;
    if (badgeToggleSchool) badgeToggleSchool.textContent = (students || []).length;
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
        const uid = s.uid || s.studentNo || s.studentId || s.student_no || s.id || Math.random().toString(36).substring(2);
        const isChecked = selectedSchoolStudentIds.has(uid) ? 'checked' : '';

        const studentNo = s.studentNo || s.studentId || s.student_no || 'N/A';
        let fullName = s.fullName || s.name || '';
        if (!fullName) {
            fullName = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ') || 'N/A';
        }

        const programName = s.programName || s.course || s.program || 'N/A';
        const yearLevel = s.yearLevel || s.year || 'N/A';
        const rawDob = s.dateOfBirth || s.birthdate || s.dob || '';
        const dob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : 'N/A';
        let age = s.age;
        if (!age || age === 'N/A' || isNaN(age)) {
            age = calculateAge(dob !== 'N/A' ? dob : rawDob);
        }

        const gender = (s.gender || s.sex || '').trim() || 'N/A';
        const civilStatus = (s.civilStatus || s.civil_status || family.civilStatus || '').trim() || 'Single';
        const religion = (s.religion || family.religion || '').trim() || 'N/A';
        const mobileNumber = (s.mobileNumber || s.mobile_number || s.phone || '').trim() || 'N/A';
        const emailAddress = (s.emailAddress || s.email_address || s.email || '').trim() || 'N/A';
        const fatherFullName = (s.fatherFullName || s.father_full_name || family.fatherFullName || '').trim() || 'N/A';
        const fatherOccupation = (s.fatherOccupation || s.father_occupation || family.fatherOccupation || '').trim() || 'N/A';
        const motherFullName = (s.motherFullName || s.mother_full_name || family.motherFullName || '').trim() || 'N/A';
        const motherOccupation = (s.motherOccupation || s.mother_occupation || family.motherOccupation || '').trim() || 'N/A';

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
            updateSchoolExportButtonText();
        });
    });
    updateSchoolExportButtonText();
}

// Search filter for School Students Table
function filterSchoolStudents() {
    const searchInput = document.getElementById('search-school-students');
    const q = (searchInput?.value || '').toLowerCase().trim();
    if (!q) {
        renderSchoolStudentsTable(schoolStudents);
        return;
    }
    const filtered = schoolStudents.filter(s => {
        const family = s.familyDetails || {};
        const studentNo = (s.studentNo || s.studentId || s.student_no || '').toLowerCase();
        const name = (s.fullName || s.name || '').toLowerCase();
        const prog = (s.programName || s.course || '').toLowerCase();
        const email = (s.emailAddress || s.email || '').toLowerCase();
        const father = (s.fatherFullName || family.fatherFullName || '').toLowerCase();
        const mother = (s.motherFullName || family.motherFullName || '').toLowerCase();
        const religion = (s.religion || family.religion || '').toLowerCase();
        const dob = (s.dateOfBirth || s.birthdate || '').toLowerCase();
        return studentNo.includes(q) || name.includes(q) || prog.includes(q) || email.includes(q) || father.includes(q) || mother.includes(q) || religion.includes(q) || dob.includes(q);
    });
    renderSchoolStudentsTable(filtered);
}

// â”€â”€ Export School Student Records as CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateSchoolExportButtonText() {
    const btnText = document.getElementById('text-export-school-csv');
    if (!btnText) return;
    if (selectedSchoolStudentIds && selectedSchoolStudentIds.size > 0) {
        btnText.textContent = `Export Selected (${selectedSchoolStudentIds.size})`;
    } else {
        btnText.textContent = 'Export CSV';
    }
}

function getSchoolStudentsForExport() {
    if (selectedSchoolStudentIds && selectedSchoolStudentIds.size > 0) {
        const selected = schoolStudents.filter(s => {
            const uid = s.uid || s.studentNo || s.studentId || s.student_no || s.id;
            return selectedSchoolStudentIds.has(uid);
        });
        if (selected.length > 0) return selected;
    }

    const searchInput = document.getElementById('search-school-students');
    const q = (searchInput?.value || '').toLowerCase().trim();
    if (q) {
        return schoolStudents.filter(s => {
            const family = s.familyDetails || {};
            const studentNo = (s.studentNo || s.studentId || s.student_no || '').toLowerCase();
            const name = (s.fullName || s.name || '').toLowerCase();
            const prog = (s.programName || s.course || '').toLowerCase();
            const email = (s.emailAddress || s.email || '').toLowerCase();
            const father = (s.fatherFullName || family.fatherFullName || '').toLowerCase();
            const mother = (s.motherFullName || family.motherFullName || '').toLowerCase();
            const religion = (s.religion || family.religion || '').toLowerCase();
            const dob = (s.dateOfBirth || s.birthdate || '').toLowerCase();
            return studentNo.includes(q) || name.includes(q) || prog.includes(q) || email.includes(q) || father.includes(q) || mother.includes(q) || religion.includes(q) || dob.includes(q);
        });
    }

    return schoolStudents;
}

function exportSchoolStudentsCSV() {
    const listToExport = getSchoolStudentsForExport();

    if (!listToExport || listToExport.length === 0) {
        if (typeof window.showToast === 'function') {
            window.showToast('No school student records found to export.', 'alert-triangle');
        } else {
            alert('No school student records found to export.');
        }
        return;
    }

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
        "Father's Full Name",
        "Father's Occupation",
        "Mother's Full Name",
        "Mother's Occupation",
        'Status'
    ];

    const rows = listToExport.map(s => {
        const family = s.familyDetails || {};
        const studentNo = s.studentNo || s.studentId || s.student_no || '';
        let fullName = s.fullName || s.name || '';
        if (!fullName) {
            fullName = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ');
        }
        const scholarship = s.scholarship || s.scholarshipName || 'TES';
        const programName = s.programName || s.course || s.program || '';
        const yearLevel = s.yearLevel || s.year || '';
        const rawDob = s.dateOfBirth || s.birthdate || s.dob || '';
        const dob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : '';
        let age = s.age;
        if (!age || age === 'N/A' || isNaN(age)) {
            age = calculateAge(dob || rawDob);
        }
        if (age === 'N/A' || isNaN(age)) age = '';
        const gender = (s.gender || s.sex || '').trim();
        const civilStatus = (s.civilStatus || s.civil_status || family.civilStatus || '').trim() || 'Single';
        const religion = (s.religion || family.religion || '').trim();
        const mobileNumber = (s.mobileNumber || s.mobile_number || s.phone || '').trim();
        const emailAddress = (s.emailAddress || s.email_address || s.email || '').trim();
        const fatherFullName = (s.fatherFullName || s.father_full_name || family.fatherFullName || family.fatherName || '').trim();
        const fatherOccupation = (s.fatherOccupation || s.father_occupation || family.fatherOccupation || family.fatherEduStatus || '').trim();
        const motherFullName = (s.motherFullName || s.mother_full_name || family.motherFullName || family.motherName || '').trim();
        const motherOccupation = (s.motherOccupation || s.mother_occupation || family.motherOccupation || family.motherEduStatus || '').trim();
        const status = s.status || 'Enrolled';

        const rowValues = [
            studentNo,
            fullName,
            scholarship,
            programName,
            yearLevel,
            dob,
            age,
            gender,
            civilStatus,
            religion,
            mobileNumber,
            emailAddress,
            fatherFullName,
            fatherOccupation,
            motherFullName,
            motherOccupation,
            status
        ];

        return rowValues.map(val => {
            const str = (val === null || val === undefined) ? '' : String(val);
            return `"${str.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
        }).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    const isSelected = selectedSchoolStudentIds && selectedSchoolStudentIds.size > 0;
    const filename = isSelected
        ? `School_Student_Records_Selected_${listToExport.length}_${today}.csv`
        : `School_Student_Records_${today}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window.showToast === 'function') {
        window.showToast(`Exported ${listToExport.length} School Student Records to CSV!`, 'download');
    }
}
window.exportSchoolStudentsCSV = exportSchoolStudentsCSV;

// Download School Student Records Excel Template
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
        "Father's Full Name",
        "Father's Occupation",
        "Mother's Full Name",
        "Mother's Occupation"
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
        { wch: 15 },
        { wch: 28 },
        { wch: 15 },
        { wch: 35 },
        { wch: 12 },
        { wch: 15 },
        { wch: 8 },
        { wch: 10 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 28 },
        { wch: 24 },
        { wch: 22 },
        { wch: 24 },
        { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'School Student Records');
    XLSX.writeFile(wb, 'School_Student_Records_Template.xlsx');
    if (typeof window.showToast === 'function') {
        window.showToast('School Student Records template downloaded!', 'download');
    }
}

// Helper: Parse School Students from Excel or CSV
async function parseSchoolExcelOrCsv(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
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

                            if (col.includes('father') || col.includes('tatay') || col.includes('ama')) {
                                if (col.includes('occ') || col.includes('work') || col.includes('job') || col.includes('profess') || col.includes('edu') || col.includes('status')) {
                                    colMap.fatherOccupation = idx;
                                } else {
                                    colMap.fatherFullName = idx;
                                }
                            } else if (col.includes('mother') || col.includes('nanay') || col.includes('ina')) {
                                if (col.includes('occ') || col.includes('work') || col.includes('job') || col.includes('profess') || col.includes('edu') || col.includes('status')) {
                                    colMap.motherOccupation = idx;
                                } else {
                                    colMap.motherFullName = idx;
                                }
                            } else if (col.includes('student no') || col.includes('student id') || col.includes('student number') || col.includes('id number') || col.includes('control no') || col === 'id' || col === 'student_no' || col === 'student_id') {
                                colMap.studentNo = idx;
                            } else if (col.includes('full name') || col.includes('student name') || col === 'name' || col === 'student' || col === 'student_name') {
                                colMap.fullName = idx;
                            } else if (col.includes('last name') || col.includes('lastname') || col.includes('surname') || col === 'lname') {
                                colMap.lastName = idx;
                            } else if (col.includes('first name') || col.includes('firstname') || col.includes('given name') || col === 'fname') {
                                colMap.firstName = idx;
                            } else if (col.includes('middle name') || col.includes('middlename') || col.includes('middle initial') || col.includes('m i') || col === 'mi' || col === 'mname') {
                                colMap.middleName = idx;
                            } else if (col.includes('program') || col.includes('course') || col.includes('degree') || col.includes('curriculum')) {
                                colMap.programName = idx;
                            } else if (col.includes('year level') || col.includes('year') || col.includes('level') || col === 'yr' || col.includes('yr level') || col.startsWith('yr')) {
                                colMap.yearLevel = idx;
                            } else if (col.includes('date of birth') || col.includes('birth date') || col.includes('birthdate') || col.includes('dob') || col.includes('birthday') || col === 'bday') {
                                colMap.dateOfBirth = idx;
                            } else if (col === 'age' || col.startsWith('age ') || col.endsWith(' age') || col.includes('years old')) {
                                colMap.age = idx;
                            } else if (col.includes('gender') || col.includes('sex')) {
                                colMap.gender = idx;
                            } else if (col.includes('civil status') || col.includes('marital status') || col === 'civil_status' || col === 'marital_status' || col.includes('civil')) {
                                colMap.civilStatus = idx;
                            } else if (col.includes('religion') || col.includes('faith') || col.includes('sect')) {
                                colMap.religion = idx;
                            } else if (col.includes('mobile') || col.includes('contact') || col.includes('phone') || col.includes('cellphone') || col.includes('tel')) {
                                colMap.mobileNumber = idx;
                            } else if (col.includes('email') || col.includes('e mail') || col.includes('mail')) {
                                colMap.emailAddress = idx;
                            } else if (col.includes('status') || col.includes('enrollment') || col.includes('remarks')) {
                                colMap.status = idx;
                            } else if (col.includes('scholarship') || col.includes('grant') || col === 'scholar' || col === 'scholarship_name') {
                                colMap.scholarship = idx;
                            }
                        });
                        break;
                    }
                }

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

                const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
                for (let r = startRow; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    const rowStr = row.join(' ').toLowerCase();
                    if (rowStr.includes('control no') || rowStr.includes('student no') || (rowStr.includes('last name') && rowStr.includes('first name')) || (rowStr.includes('student no') && rowStr.includes('full name'))) {
                        continue;
                    }

                    if (colMap.studentNo !== undefined || colMap.fullName !== undefined || colMap.lastName !== undefined) {
                        let studentNo = colMap.studentNo !== undefined ? String(row[colMap.studentNo] || '').trim() : '';
                        let fullName = colMap.fullName !== undefined ? String(row[colMap.fullName] || '').trim() : '';
                        let lastName = colMap.lastName !== undefined ? String(row[colMap.lastName] || '').trim() : '';
                        let firstName = colMap.firstName !== undefined ? String(row[colMap.firstName] || '').trim() : '';
                        let mi = colMap.middleName !== undefined ? String(row[colMap.middleName] || '').trim() : '';
                        let programName = colMap.programName !== undefined ? String(row[colMap.programName] || 'BSIT').trim() : 'BSIT';
                        let yearLevel = colMap.yearLevel !== undefined ? String(row[colMap.yearLevel] || '1').trim() : '1';

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
                        // Heuristic Fallback
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

// Upload & Process School Students File (Disabled for Super Admin - View-Only Access)
async function handleSchoolFile(file) {
    console.warn('Super Admin has view-only access to School Student Records. Upload and import is restricted to School Admin.');
    if (window.showToast) {
        window.showToast('Super Admin has view-only access. School student records can only be uploaded by the School Admin.', 'alert-triangle');
    }
    alert('Super Admin has view-only access to School Student Records. Only the Admin has permission to upload or import these records.');
    return;
}

async function fetchAllSchoolStudents(supabaseClient) {
    let allStudents = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        try {
            const { data, error } = await supabaseClient
                .from('school_students')
                .select('*')
                .order('student_no', { ascending: true })
                .range(from, to);

            if (error || !data || data.length === 0) {
                hasMore = false;
            } else {
                allStudents = allStudents.concat(data);
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
    return allStudents;
}

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
            return;
        }

        let termMap = {};
        let registry = {};
        try { termMap = JSON.parse(localStorage.getItem('scholardoc_school_term_students') || '{}'); } catch (_) { }
        try { registry = JSON.parse(localStorage.getItem('scholardoc_school_terms_registry') || '{}'); } catch (_) { }

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
            const { data: logs, error: logErr } = await window.supabaseClient
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
            const { data: notifs, error: notifErr } = await window.supabaseClient
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
                    needSave = true;
                }
            }
        }

        if (validLoggedTerms.size === 1) {
            const onlyTermKey = Array.from(validLoggedTerms)[0];
            if (!termMap[onlyTermKey] || termMap[onlyTermKey].length === 0) {
                termMap[onlyTermKey] = allDbStudents.map(s => String(s.student_no || s.studentNo || s.studentId || '').trim()).filter(Boolean);
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

function isSchoolStudentInTerm(s, targetAy, targetSem, studentProfileMap = new Map()) {
    if (!s) return false;
    if ((!targetAy || targetAy === 'All') && (!targetSem || targetSem === 'All')) {
        return true;
    }

    const sNo = String(s.student_no || s.studentNo || s.studentId || '').trim();
    const sName = String(s.full_name || s.fullName || s.name || '').toLowerCase().trim();
    const sId = s.id ? String(s.id).trim() : null;
    const termKey = `${targetAy}_${targetSem}`;

    // 1. Direct lookup in term-students mapping if populated in localStorage
    try {
        const termStudentsMap = (typeof getSchoolTermStudentsMap === 'function') 
            ? getSchoolTermStudentsMap() 
            : JSON.parse(localStorage.getItem('scholardoc_school_term_students') || '{}');

        if (targetAy && targetAy !== 'All' && targetSem && targetSem !== 'All') {
            if (termStudentsMap && Array.isArray(termStudentsMap[termKey])) {
                const studentSet = new Set(termStudentsMap[termKey]);
                if (sNo && studentSet.has(sNo)) return true;
                if (sName && studentSet.has(sName)) return true;
                if (sId && studentSet.has(sId)) return true;
                return false;
            }
        }
    } catch (_) { }

    // 2. Multi-term list check in scholardoc_school_student_terms
    try {
        const cache = JSON.parse(localStorage.getItem('scholardoc_school_student_terms') || '{}');
        const entry = (sNo && cache[sNo]) || (sId && cache[sId]) || (sName && cache[sName]);
        if (Array.isArray(entry) && entry.length > 0) {
            return entry.some(t => isAcademicYearMatch(t.academicYear, targetAy) && isSemesterMatch(t.semester, targetSem));
        } else if (entry && (entry.academicYear || entry.semester)) {
            return isAcademicYearMatch(entry.academicYear, targetAy) && isSemesterMatch(entry.semester, targetSem);
        }
    } catch (_) { }

    // 3. Database column checks on the record itself
    const objAy = s.academic_year || s.academicYear;
    const objSem = s.semester;
    if (objAy || objSem) {
        return isAcademicYearMatch(objAy, targetAy) && isSemesterMatch(objSem, targetSem);
    }

    // 4. Matched profile in student_grantees
    const matchedSt = studentProfileMap.get(sNo) || studentProfileMap.get(sName);
    if (matchedSt) {
        const ay = matchedSt.academic_year || matchedSt.academicYear;
        const sem = matchedSt.semester;
        if (ay || sem) {
            return isAcademicYearMatch(ay, targetAy) && isSemesterMatch(sem, targetSem);
        }
    }

    // If target term is specified (concrete AY and Semester) and no record matched this term, return false
    if (targetAy && targetAy !== 'All' && targetSem && targetSem !== 'All') {
        return false;
    }

    return true;
}

function getSchoolStudentTerm(s, studentProfileMap = new Map(), targetAy = selectedAcademicYear, targetSem = selectedSemester) {
    if (targetAy && targetSem && targetAy !== 'All' && targetSem !== 'All') {
        if (isSchoolStudentInTerm(s, targetAy, targetSem, studentProfileMap)) {
            return { academicYear: targetAy, semester: targetSem };
        }
    }

    const sNo = String(s.student_no || s.studentNo || s.studentId || '').trim();
    const sName = String(s.full_name || s.fullName || s.name || '').toLowerCase().trim();
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

async function loadSchoolStudentsAndVerify(grantees) {
    try {
        let dbStudents = await fetchAllSchoolStudents(window.supabaseClient);
        await autoHealSchoolStudentTerms(dbStudents);

        let { data: fallbackStudents } = await window.supabaseClient
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
            const filteredSchool = dbStudents.filter(s => {
                return isSchoolStudentInTerm(s, selectedAcademicYear, selectedSemester, studentProfileMap);
            });
            schoolStudents = filteredSchool.map(s => {
                const mapped = mapSchoolStudentRecord(s, studentProfileMap);
                mapped.academicYear = selectedAcademicYear !== 'All' ? selectedAcademicYear : (s.academic_year || '2026-2027');
                mapped.semester = selectedSemester !== 'All' ? selectedSemester : (s.semester || '1st Semester');
                return mapped;
            });
        } else if (fallbackStudents && fallbackStudents.length > 0) {
            const filteredSchool = fallbackStudents.filter(s => {
                return isSchoolStudentInTerm(s, selectedAcademicYear, selectedSemester, studentProfileMap);
            });
            schoolStudents = filteredSchool.map(s => {
                const mapped = mapSchoolStudentRecord(s, studentProfileMap);
                mapped.academicYear = selectedAcademicYear !== 'All' ? selectedAcademicYear : (s.academic_year || '2026-2027');
                mapped.semester = selectedSemester !== 'All' ? selectedSemester : (s.semester || '1st Semester');
                return mapped;
            });
        } else {
            schoolStudents = [];
        }

        renderSchoolStudentsTable(schoolStudents);

        if (grantees === undefined || grantees === null) {
            const valid = (extractedRecords || []).filter(r => !r.isDuplicate && !r.hasScholarshipConflict);
            if (valid.length > 0) {
                grantees = valid.map(m => ({
                    id: m.id,
                    name: m.name || `${m.last_name || m.lastName || ''}, ${m.first_name || m.firstName || ''} ${m.middle_name || m.middleName || ''}`.trim(),
                    last_name: m.last_name || m.lastName,
                    first_name: m.first_name || m.firstName,
                    middle_name: m.middle_name || m.middleName,
                    batch: m.batch || 'Batch 1',
                    student_id: m.student_id || m.studentId || '',
                    course: m.course || 'BSIT',
                    year: m.year || '1',
                    academic_year: m.academic_year || m.academicYear || selectedAcademicYear,
                    semester: m.semester || selectedSemester,
                    scholarship_type: m.scholarship_type || m.scholarshipType || selectedScholarshipProgram || 'TES'
                }));
            } else {
                grantees = [];
            }
        }

        // 1. Strict Isolation: First check if authentic records already exist in Supabase for this active term
        const dbSync = await AnnexSyncService.loadFromSupabase({
            academicYear: selectedAcademicYear,
            semester: selectedSemester,
            fallbackToLatest: false
        });

        if (dbSync && dbSync.fromDb && (dbSync.form2List.length > 0 || dbSync.form3List.length > 0)) {
            const dbItems = [...(dbSync.form2List || []), ...(dbSync.form3List || [])];
            const hasUnverifiedGrantees = (grantees || []).some(g => !dbItems.some(d => AnnexSyncService.isSameStudent(d, g)));
            if (!hasUnverifiedGrantees) {
                verifiedForm2List = dbSync.form2List || [];
                const existPool = (studentExistList || []).map(e => getComparableName(e));
                verifiedForm3List = (dbSync.form3List || []).filter(item => {
                    const r = item?.matchedStudent?.remarks || item?.remarks || item?.specialStatusReason || '';
                    if (String(r).includes('Categorized from Student Exist')) return false;
                    if ((studentExistList || []).some(ex => AnnexSyncService.isSameStudent(ex, item))) return false;
                    const cand = getComparableName(item.grantee || item.matchedStudent || item);
                    if (existPool.some(e => areNamesMatching(cand, e))) return false;
                    return true;
                });
                needsReviewList = [];
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                renderAnnexForm3Table(verifiedForm3List);
                renderAnnexReviewQueue(needsReviewList);
                if (StudentSyncService && typeof StudentSyncService.loadAndSyncStudents === 'function') {
                    StudentSyncService.loadAndSyncStudents().catch(() => {});
                }
                return;
            }
        }

        // 2. Check if verified data is in Supabase (or local storage only when offline/unreachable)
        const savedSync = (dbSync && dbSync.fromDb)
            ? dbSync
            : AnnexSyncService.getVerifiedData(selectedAcademicYear, selectedSemester);
        if (savedSync && (savedSync.form2List.length > 0 || savedSync.form3List.length > 0)) {
            if (grantees && grantees.length > 0) {
                const resolvedForm2Map = new Map(savedSync.form2List.map(item => [AnnexSyncService.getUniqueKey(item), item]));
                const resolvedForm3Map = new Map(savedSync.form3List.map(item => [AnnexSyncService.getUniqueKey(item), item]));

                const batchResult = VerificationService.runBatchVerification(grantees, schoolStudents);
                const allItems = [...batchResult.form2List, ...batchResult.form3List, ...batchResult.needsReviewList];

                const combinedForm2 = [];
                const combinedForm3 = [];
                const remainingReview = [];
                const processedKeys = new Set();

                for (const item of allItems) {
                    const key = AnnexSyncService.getUniqueKey(item);
                    if (processedKeys.has(key) || combinedForm2.some(c => AnnexSyncService.isSameStudent(c, item)) || combinedForm3.some(c => AnnexSyncService.isSameStudent(c, item))) continue;
                    processedKeys.add(key);

                    const savedF2 = resolvedForm2Map.get(key) || savedSync.form2List.find(s => AnnexSyncService.isSameStudent(s, item));
                    const savedF3 = resolvedForm3Map.get(key) || savedSync.form3List.find(s => AnnexSyncService.isSameStudent(s, item));

                    if (savedF2) {
                        processedKeys.add(AnnexSyncService.getUniqueKey(savedF2));
                        const gL = (item.grantee?.last_name || item.grantee?.lastName || '').trim().toLowerCase();
                        const sL = (savedF2.matchedStudent?.lastName || savedF2.matchedStudent?.last_name || '').trim().toLowerCase();
                        const isValid = !sL || !gL || gL === sL || gL.includes(sL) || sL.includes(gL) || (VerificationService.levenshteinSimilarity && VerificationService.levenshteinSimilarity(gL, sL) >= 0.75);
                        if (isValid) {
                            combinedForm2.push({ ...item, ...savedF2, classification: 'MATCHED_FORM2', isEnrolled: true });
                        } else {
                            if (item.classification === 'MATCHED_FORM2') combinedForm2.push(item);
                            else if (item.classification === 'INACTIVE_FORM3') combinedForm3.push(item);
                            else remainingReview.push(item);
                        }
                    } else if (savedF3) {
                        processedKeys.add(AnnexSyncService.getUniqueKey(savedF3));
                        combinedForm3.push({ ...item, ...savedF3, classification: 'INACTIVE_FORM3', isEnrolled: false });
                    } else if (item.classification === 'MATCHED_FORM2') {
                        combinedForm2.push(item);
                    } else if (item.classification === 'INACTIVE_FORM3') {
                        combinedForm3.push(item);
                    } else {
                        remainingReview.push(item);
                    }
                }

                // Preserve any manually approved records from savedSync that were not already merged
                for (const savedItem of (savedSync.form2List || [])) {
                    const key = AnnexSyncService.getUniqueKey(savedItem);
                    const alreadyInF2 = combinedForm2.some(c => AnnexSyncService.isSameStudent(c, savedItem));
                    const alreadyInF3 = combinedForm3.some(c => AnnexSyncService.isSameStudent(c, savedItem));
                    if (!processedKeys.has(key) && !alreadyInF2 && !alreadyInF3) {
                        processedKeys.add(key);
                        const gL = (savedItem.grantee?.last_name || savedItem.grantee?.lastName || '').trim().toLowerCase();
                        const sL = (savedItem.matchedStudent?.lastName || savedItem.matchedStudent?.last_name || '').trim().toLowerCase();
                        const isValid = !sL || !gL || gL === sL || gL.includes(sL) || sL.includes(gL) || (VerificationService.levenshteinSimilarity && VerificationService.levenshteinSimilarity(gL, sL) >= 0.75);
                        if (isValid) {
                            combinedForm2.push(savedItem);
                        }
                    }
                }
                for (const savedItem of (savedSync.form3List || [])) {
                    const key = AnnexSyncService.getUniqueKey(savedItem);
                    const alreadyInF2 = combinedForm2.some(c => AnnexSyncService.isSameStudent(c, savedItem));
                    const alreadyInF3 = combinedForm3.some(c => AnnexSyncService.isSameStudent(c, savedItem));
                    if (!processedKeys.has(key) && !alreadyInF2 && !alreadyInF3) {
                        processedKeys.add(key);
                        combinedForm3.push(savedItem);
                    }
                }

                const deduped = AnnexSyncService.deduplicateLists(combinedForm2, combinedForm3, remainingReview, studentExistList);
                verifiedForm2List = deduped.form2List;
                verifiedForm3List = deduped.form3List;
                needsReviewList = deduped.needsReviewList;
            } else {
                verifiedForm2List = savedSync.form2List;
                verifiedForm3List = savedSync.form3List;
                needsReviewList = savedSync.needsReviewList;
            }
        } else {
            const result = VerificationService.runBatchVerification(grantees || [], schoolStudents);
            const deduped = AnnexSyncService.deduplicateLists(result.form2List, result.form3List, result.needsReviewList, studentExistList);
            verifiedForm2List = deduped.form2List;
            verifiedForm3List = deduped.form3List;
            needsReviewList = deduped.needsReviewList;
        }

        // Strictly exclude any student who already exists (in Student Exist, or flagged duplicate/conflict) from Form 3
        const currentExist = studentExistList || loadStudentExistList(selectedAcademicYear, selectedSemester) || [];
        const existPool = currentExist.map(e => getComparableName(e));
        const dupPool = (extractedRecords || []).filter(r => r.isDuplicate || r.hasScholarshipConflict).map(d => getComparableName(d));
        const allExcludePool = [...existPool, ...dupPool];

        verifiedForm3List = (verifiedForm3List || []).filter(f3 => {
            if (!f3) return false;
            if (f3.isDuplicate || f3.grantee?.isDuplicate || f3.matchedStudent?.isDuplicate) return false;
            if (currentExist.some(ex => AnnexSyncService.isSameStudent(ex, f3))) return false;
            const cand = getComparableName(f3.grantee || f3.matchedStudent || f3);
            if (allExcludePool.some(ex => areNamesMatching(cand, ex))) return false;
            return true;
        });

        const hasVerifiedRecords = (verifiedForm2List && verifiedForm2List.length > 0) || (verifiedForm3List && verifiedForm3List.length > 0);
        AnnexSyncService.saveVerifiedData({
            form2List: verifiedForm2List,
            form3List: verifiedForm3List,
            studentExistList: currentExist,
            needsReviewList: needsReviewList,
            updatedBy: 'Super Admin (Verification Sync)',
            syncToDb: false,
            academicYear: selectedAcademicYear,
            semester: selectedSemester
        });

        if (hasVerifiedRecords) {
            await AnnexSyncService.saveToSupabase(
                verifiedForm2List,
                verifiedForm3List,
                'Super Admin (Verification Sync)',
                selectedAcademicYear,
                selectedSemester
            );
            if (StudentSyncService && typeof StudentSyncService.loadAndSyncStudents === 'function') {
                await StudentSyncService.loadAndSyncStudents();
            }
        }

        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
        renderAnnexForm3Table(verifiedForm3List);
        renderAnnexReviewQueue(needsReviewList);

        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            syncBadge.style.display = 'inline-flex';
        }

    } catch (err) {
        console.warn('Error verifying Annex 5 tables in masterlist_import:', err);
    }
}

let activeSAResolutionItem = null;

function openSuperAdminResolutionModal(reviewIndex) {
    activeSAResolutionItem = reviewIndex;
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    const modal = document.getElementById('sa-resolution-modal');
    const nameEl = document.getElementById('sa-modal-grantee-name');
    const targetForm = document.getElementById('sa-modal-target-form');
    const reasonGroup = document.getElementById('sa-modal-form3-reason-group');
    const reasonSel = document.getElementById('sa-modal-form3-reason');
    const remarksInput = document.getElementById('sa-modal-remarks');

    if (nameEl) nameEl.textContent = item.grantee?.name || 'Scholar Grantee';
    if (targetForm) targetForm.value = 'form3';
    if (reasonGroup) reasonGroup.style.display = 'block';
    if (reasonSel) reasonSel.value = item.specialStatusReason || 'Not enrolled';
    if (remarksInput) remarksInput.value = '';

    if (modal) modal.style.display = 'flex';
}

function closeSuperAdminResolutionModal() {
    activeSAResolutionItem = null;
    const modal = document.getElementById('sa-resolution-modal');
    if (modal) modal.style.display = 'none';
}

function resolveSuperAdminReviewItem(reviewIndex, targetForm, specialReason = 'Not enrolled', remarks = '') {
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
        if (window.showToast) window.showToast(`Approved ${item.grantee?.name || 'Grantee'} to Form 2 (Enrolled)`, 'check-circle');
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
        if (window.showToast) window.showToast(`Categorized ${item.grantee?.name || 'Grantee'} to Form 3 (${specialReason})`, 'tag');
    }

    const synced = AnnexSyncService.saveVerifiedData({
        form2List: verifiedForm2List,
        form3List: verifiedForm3List,
        needsReviewList: needsReviewList,
        updatedBy: 'Super Admin',
        academicYear: selectedAcademicYear,
        semester: selectedSemester
    });
    if (synced) {
        verifiedForm2List = synced.form2List;
        verifiedForm3List = synced.form3List;
        needsReviewList = synced.needsReviewList;
    }

    try {
        const granteeName = item.grantee?.name || `${item.grantee?.last_name || ''}, ${item.grantee?.first_name || ''}`.trim();
        window.supabaseClient.from('audit_logs').insert([{
            userName: 'Super Admin',
            role: 'Super Admin',
            action: `Reports Review: Categorized ${granteeName} to ${targetForm === 'form2' ? 'Form 2 (Enrolled)' : `Form 3 (${specialReason})`}`,
            studentId: item.grantee?.student_id || item.matchedStudent?.studentId || 'N/A'
        }]).then(() => { }).catch(e => console.warn(e));
    } catch (_) { }

    updateAnnexKPIs();
    renderAnnexForm2Table(verifiedForm2List);
    renderAnnexForm3Table(verifiedForm3List);
    renderAnnexReviewQueue(needsReviewList);
}

function updateAnnexKPIs() {
    const f2Count = verifiedForm2List.length;
    const f3Count = verifiedForm3List.length;
    const existCount = (studentExistList || []).length;
    const revCount = needsReviewList.length;
    const totalBilling = f2Count * 10000;

    const b2 = document.getElementById('sa-badge-form2-count');
    const b3 = document.getElementById('sa-badge-form3-count');
    const bExist = document.getElementById('sa-badge-exist-count');
    const bRev = document.getElementById('sa-badge-review-count');

    if (b2) b2.textContent = f2Count;
    if (b3) b3.textContent = f3Count;
    if (bExist) bExist.textContent = existCount;
    if (bRev) bRev.textContent = revCount;

    const countF2 = document.getElementById('sa-stat-form2-count');
    const amtF2 = document.getElementById('sa-stat-form2-amount');
    const countF3 = document.getElementById('sa-stat-form3-count');
    const countExist = document.getElementById('sa-stat-exist-count');

    if (countF2) countF2.textContent = `${f2Count} Enrolled Grantees`;
    if (amtF2) amtF2.textContent = `\u20B1${totalBilling.toLocaleString('en-US', { minimumFractionDigits: 2 })} Total Billing`;
    if (countF3) countF3.textContent = `${f3Count} Not Included`;
    if (countExist) countExist.textContent = `${existCount} Duplicate Grantee${existCount === 1 ? '' : 's'}`;
}

function renderAnnexForm2Table(items) {
    const tbody = document.getElementById('sa-tbody-form2');
    if (!tbody) return;

    if (items.length === 0) {
        const termLabel = `${selectedSemester !== 'All' ? selectedSemester : 'All Semesters'} (${selectedAcademicYear !== 'All' ? 'AY ' + selectedAcademicYear : 'All School Years'})`;
        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 42px 20px; color: var(--text-secondary);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <i class="icon-calendar-x" style="font-size: 32px; color: #94a3b8; opacity: 0.7;"></i>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No verified enrolled grantees found for ${termLabel}.</div>
                <div style="font-size: 12px; color: #94a3b8;">Switch academic year/semester above or import a new grantee list.</div>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee;
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

        const batchVal = String(grantee.batch || grantee.tes_batch || student.batch || student.documents?.batch || '1.2').replace(/^batch\s*/i, '').trim() || '1.2';

        return `
            <tr>
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
                <td style="text-align: center;">${batchVal}</td>
                <td style="font-weight: 600; color: #2E7D32;">\u20B110,000.00</td>
                <td style="text-align: center; color: var(--text-secondary);">\u20B10.00</td>
                <td style="font-weight: 700; color: #2E7D32;">\u20B110,000.00</td>
            </tr>
        `;
    }).join('');
}

function renderAnnexForm3Table(items) {
    const tbody = document.getElementById('sa-tbody-form3');
    if (!tbody) return;

    // Filter out any student who exists in Student Exist or is marked as duplicate/conflict
    const currentExist = studentExistList || [];
    const dupPool = (extractedRecords || []).filter(r => r.isDuplicate || r.hasScholarshipConflict).map(d => getComparableName(d));
    const existPool = currentExist.map(e => getComparableName(e));
    const allExclude = [...existPool, ...dupPool];

    const cleanItems = (items || []).filter(item => {
        if (!item) return false;
        if (item.isDuplicate || item.grantee?.isDuplicate || item.matchedStudent?.isDuplicate) return false;
        if (currentExist.some(ex => AnnexSyncService.isSameStudent(ex, item))) return false;
        const cand = getComparableName(item.grantee || item.matchedStudent || item);
        return !allExclude.some(ex => areNamesMatching(cand, ex));
    });

    if (cleanItems.length === 0) {
        const termLabel = `${selectedSemester !== 'All' ? selectedSemester : 'All Semesters'} (${selectedAcademicYear !== 'All' ? 'AY ' + selectedAcademicYear : 'All School Years'})`;
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 42px 20px; color: var(--text-secondary);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <i class="icon-user-x" style="font-size: 32px; color: #94a3b8; opacity: 0.7;"></i>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No Form 3 special status records found for ${termLabel}.</div>
                <div style="font-size: 12px; color: #94a3b8;">Switch academic year/semester above or import a new grantee list.</div>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = cleanItems.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee;
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

        // Specialized badge styling for all CHED Form 3 special status reasons
        let badgeStyle = 'background: rgba(245,158,11,0.12); color: #D97706; border: 1px solid rgba(245,158,11,0.25);';
        if (reason === 'Dropped' || reason === 'Waived') {
            badgeStyle = 'background: rgba(244,67,54,0.12); color: #D32F2F; border: 1px solid rgba(244,67,54,0.25);';
        } else if (reason === 'Graduated') {
            badgeStyle = 'background: rgba(46,125,50,0.12); color: #2E7D32; border: 1px solid rgba(46,125,50,0.25);';
        } else if (reason.includes('LOA') || reason.includes('Leave')) {
            badgeStyle = 'background: rgba(147,51,234,0.12); color: #7E22CE; border: 1px solid rgba(147,51,234,0.25);';
        } else if (reason.includes('Transfer') || reason === 'Transferee') {
            badgeStyle = 'background: rgba(2,132,199,0.12); color: #0369A1; border: 1px solid rgba(2,132,199,0.25);';
        }

        return `
            <tr>
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
}

function renderAnnexReviewQueue(items) {
    const container = document.getElementById('sa-review-items-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 36px; background: rgba(16,185,129,0.04); border: 1.5px dashed rgba(16,185,129,0.3); border-radius: 16px;">
                <i class="icon-check-circle-2" style="font-size: 32px; color: #10b981; margin-bottom: 6px;"></i>
                <h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 700; color: #065f46;">All Records Categorized & Verified</h4>
                <p style="margin: 0; font-size: 12px; color: #047857;">All scholarship grantees have been verified into Form 2 or Form 3.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        const grantee = item.grantee;
        const student = item.matchedStudent;
        const confidence = item.confidence || 0;
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
        const granteeProg = grantee.course || grantee.program || grantee.program_name || 'BSIT';

        return `
            <div class="card" style="padding: 16px 20px; border-left: 4px solid #E53935; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary);">${granteeName}</h4>
                        <p style="margin: 2px 0 0; font-size: 11px; color: var(--text-secondary);">
                            ID: <strong>${granteeId}</strong> \u2022 Program: <strong>${granteeProg}</strong> \u2022 Batch: <strong>${grantee.batch || '1'}</strong>
                        </p>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: rgba(229,57,53,0.1); color: #D32F2F;">
                        ${confidence > 0 ? `Match Confidence: ${confidence}%` : '<i class="icon-x-circle" style="font-size: 11px; margin-right: 3px;"></i> Unmatched Record (0%)'}
                    </span>
                </div>

                <!-- Comparison Row -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.02); padding: 10px 14px; border-radius: 8px; font-size: 11px;">
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">Super Admin Grantee List:</span>
                        <div>Name: <strong>${granteeName}</strong></div>
                        <div>Program: <strong>${granteeProg}</strong></div>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">School Student Masterlist:</span>
                        <div style="${!student ? 'color: #b91c1c; font-style: italic;' : ''}">Name: <strong>${studentName}</strong></div>
                        <div>Status: <span style="font-weight: 700; color: ${item.isEnrolled ? '#2E7D32' : '#E65100'};">${student ? (student.status || student.enrollmentStatus || 'Active') : 'Not in School File'}</span></div>
                    </div>
                </div>

                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${discrepancies.map(d => `
                        <span style="padding: 2px 8px; border-radius: 6px; background: rgba(229,57,53,0.08); color: #C62828; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="icon-alert-circle" style="font-size: 11px;"></i> ${d}
                        </span>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button class="sa-btn-review-approve" data-index="${idx}" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="icon-check"></i> Approve to Form 2 (Enrolled)
                    </button>
                    <button class="sa-btn-review-categorize" data-index="${idx}" style="background: linear-gradient(135deg, #FF8F00, #F57C00); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="icon-tag"></i> Categorize to Form 3
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.sa-btn-review-approve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            resolveSuperAdminReviewItem(idx, 'form2');
        });
    });

    container.querySelectorAll('.sa-btn-review-categorize').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            openSuperAdminResolutionModal(idx);
        });
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function switchSourceSection(section) {
    if (!toggleBtnGrantees) toggleBtnGrantees = document.getElementById('toggle-source-grantees');
    if (!toggleBtnSchool) toggleBtnSchool = document.getElementById('toggle-source-school');
    if (!sectionNewGrantees) sectionNewGrantees = document.getElementById('section-new-grantees');
    if (!cardSourceSchool) cardSourceSchool = document.getElementById('card-source-school');
    if (!sourceActiveLabel) sourceActiveLabel = document.getElementById('source-active-label');

    if (section === 'grantees') {
        if (toggleBtnGrantees) toggleBtnGrantees.classList.add('active');
        if (toggleBtnSchool) toggleBtnSchool.classList.remove('active');
        if (sectionNewGrantees) sectionNewGrantees.style.display = 'flex';
        if (cardSourceSchool) cardSourceSchool.style.display = 'none';
        if (sourceActiveLabel) {
            sourceActiveLabel.textContent = 'New Grantees Masterlist';
            sourceActiveLabel.style.color = 'var(--primary-color)';
        }
    } else if (section === 'school') {
        if (toggleBtnSchool) toggleBtnSchool.classList.add('active');
        if (toggleBtnGrantees) toggleBtnGrantees.classList.remove('active');
        if (sectionNewGrantees) sectionNewGrantees.style.display = 'none';
        if (cardSourceSchool) cardSourceSchool.style.display = 'flex';
        if (sourceActiveLabel) {
            sourceActiveLabel.textContent = 'School Student Records (View-Only)';
            sourceActiveLabel.style.color = '#1E88E5';
        }
        loadSchoolStudentsAndVerify(extractedRecords);
    }
}
window.switchSourceSection = switchSourceSection;
window.activateSATab = activateSATab;

function activateSATab(activeBtn, activePane) {
    [saTabBtn2, saTabBtn3, saTabBtnRev, saTabBtnExist].forEach(b => b && b.classList.remove('active'));
    [saTabPane2, saTabPane3, saTabPaneRev, saTabPaneExist].forEach(p => p && (p.style.display = 'none'));

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.style.display = 'block';
}

// Fetch existing masterlist
async function fetchExistingMasterlist() {
    try {
        const tableName = getTableName();
        const [masterRes, f2Res, f3Res, sgRes] = await Promise.all([
            window.supabaseClient
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('annex_form_2')
                .select('id, last_name, given_name, middle_initial, academic_year, semester, tes_batch, student_number'),
            window.supabaseClient
                .from('annex_form_3')
                .select('id, last_name, given_name, middle_initial, academic_year, semester'),
            window.supabaseClient
                .from('student_grantees')
                .select('id, full_name, student_no, studentId, documents, academic_year, semester, scholarship_name')
        ]);

        const data = masterRes.data;
        if (masterRes.error) {
            console.warn('Error fetching scholar_masterlist:', masterRes.error);
            return;
        }

        const f2Rows = Array.isArray(f2Res?.data) ? f2Res.data : [];
        const f3Rows = Array.isArray(f3Res?.data) ? f3Res.data : [];
        const sgRows = Array.isArray(sgRes?.data) ? sgRes.data : [];

        // Refresh cachedStudentGranteesList
        cachedStudentGranteesList = [
            ...sgRows.map(sg => {
                const parsed = splitFullName(sg.full_name || sg.fullName || '');
                return {
                    id: sg.id,
                    studentId: sg.student_no || sg.studentId || '',
                    lastName: parsed.lastName,
                    firstName: parsed.firstName,
                    middleName: parsed.middleName,
                    name: sg.full_name || sg.fullName || '',
                    batch: (sg.documents && sg.documents.batch) || 'Batch 1.2',
                    scholarshipProgram: sg.scholarship_name || 'CHED TES',
                    source: 'student_grantees'
                };
            }),
            ...f2Rows.map(f2 => ({
                id: f2.id,
                studentId: f2.student_number,
                lastName: f2.last_name,
                firstName: f2.given_name,
                middleName: f2.middle_initial,
                name: `${f2.last_name}, ${f2.given_name} ${f2.middle_initial || ''}`.trim(),
                batch: f2.tes_batch || 'Batch 1.2',
                scholarshipProgram: 'CHED TES',
                source: 'annex_form_2'
            }))
        ];

        if (typeof StudentSyncService !== 'undefined' && StudentSyncService.getAllStudents) {
            try {
                const syncList = StudentSyncService.getAllStudents();
                if (Array.isArray(syncList)) {
                    syncList.forEach(s => cachedStudentGranteesList.push(s));
                }
            } catch (_) { }
        }

        // Build term lookup maps from Annex Form 2, Form 3, and student_grantees
        const f2Lookup = new Map();
        f2Rows.forEach(row => {
            const k = normalizeName(row.last_name, row.given_name, row.middle_initial);
            if (k) f2Lookup.set(k, row);
            const l = String(row.last_name || '').trim().toLowerCase();
            const f = String(row.given_name || '').trim().toLowerCase();
            if (l && f) f2Lookup.set(`${l}|${f}`, row);
        });

        const f3Lookup = new Map();
        f3Rows.forEach(row => {
            const k = normalizeName(row.last_name, row.given_name, row.middle_initial);
            if (k) f3Lookup.set(k, row);
            const l = String(row.last_name || '').trim().toLowerCase();
            const f = String(row.given_name || '').trim().toLowerCase();
            if (l && f) f3Lookup.set(`${l}|${f}`, row);
        });

        const sgLookup = new Map();
        sgRows.forEach(sg => {
            const n = String(sg.full_name || sg.fullName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (n) sgLookup.set(n, sg);
            const sNo = String(sg.student_no || sg.studentId || '').trim();
            if (sNo) sgLookup.set(sNo, sg);
        });

        if (data && data.length > 0) {
            // Auto-clean any header text rows stored previously in database
            const headerDbRows = data.filter(row => {
                const f = String(row.first_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                const l = String(row.last_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                const m = String(row.middle_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                return f === 'FIRSTNAME' || l === 'LASTNAME' || m.includes('MIDDLEINITIAL') || f === 'FIRST' || l === 'LAST';
            });

            if (headerDbRows.length > 0) {
                const idsToDelete = headerDbRows.map(r => r.id);
                window.supabaseClient.from(tableName).delete().in('id', idsToDelete).then(() => { });
            }

            const validData = data.filter(row => {
                const f = String(row.first_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                const l = String(row.last_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                const m = String(row.middle_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                return f !== 'FIRSTNAME' && l !== 'LASTNAME' && !m.includes('MIDDLEINITIAL') && f !== 'FIRST' && l !== 'LAST';
            });

            const rowsToHeal = [];

            allMasterlistRecords = validData.map(row => {
                let fn = row.first_name || '';
                let mn = row.middle_name || '';
                let ln = row.last_name || '';

                if (fn && (!ln || !ln.trim())) {
                    const parsed = splitFullName(fn);
                    fn = parsed.firstName;
                    mn = parsed.middleName || mn;
                    ln = parsed.lastName;
                    rowsToHeal.push({
                        id: row.id,
                        first_name: fn,
                        middle_name: mn,
                        last_name: ln,
                        name: `${ln}, ${fn} ${mn}`.trim()
                    });
                }

                const normKey = normalizeName(ln, fn, mn);
                const nameKey = `${String(ln).trim().toLowerCase()}|${String(fn).trim().toLowerCase()}`;
                const rawNameKey = `${ln}, ${fn} ${mn}`.toLowerCase().replace(/[^a-z0-9]/g, '');
                const matchedF2 = f2Lookup.get(normKey) || f2Lookup.get(nameKey);
                const matchedF3 = f3Lookup.get(normKey) || f3Lookup.get(nameKey);
                const matchedSg = sgLookup.get(rawNameKey) || (row.student_id ? sgLookup.get(String(row.student_id).trim()) : null);
                const cachedTerm = getCachedGranteeTerm({ id: row.id, last_name: ln, first_name: fn, middle_name: mn, name: row.name });

                let ay = row.academic_year || (matchedF2 ? matchedF2.academic_year : null) || (matchedF3 ? matchedF3.academic_year : null) || (matchedSg ? (matchedSg.academic_year || matchedSg.academicYear) : null) || (cachedTerm ? cachedTerm.academicYear : null) || selectedAcademicYear || '2026-2027';
                let sem = row.semester || (matchedF2 ? matchedF2.semester : null) || (matchedF3 ? matchedF3.semester : null) || (matchedSg ? matchedSg.semester : null) || (cachedTerm ? cachedTerm.semester : null) || '1st Semester';

                // Prioritize authentic database records (Form 2 tes_batch, student_grantees documents.batch) over stale local cache!
                const dbBatch = (matchedF2 ? matchedF2.tes_batch : null) ||
                    (matchedSg?.documents?.batch ? String(matchedSg.documents.batch).replace(/^batch\s*/i, '').trim() : null) ||
                    (row.batch ? String(row.batch).replace(/^batch\s*/i, '').trim() : null);

                const cachedBatch = getCachedGranteeBatch({
                    id: row.id,
                    last_name: ln,
                    first_name: fn,
                    middle_name: mn,
                    name: row.name,
                    studentId: row.student_id
                });
                const cleanCached = cachedBatch ? String(cachedBatch).replace(/^batch\s*/i, '').trim() : null;

                const assignedBatch = dbBatch || cleanCached || '1.2';

                return {
                    id: row.id,
                    studentId: row.student_id || '',
                    lastName: ln,
                    firstName: fn,
                    middleName: mn,
                    course: row.course || 'BSIT',
                    batch: assignedBatch,
                    academicYear: ay,
                    semester: sem,
                    isDuplicate: false
                };
            });

            // Deduplicate allMasterlistRecords per term and delete any duplicate rows from Supabase
            if (allMasterlistRecords.length > 1) {
                const uniqueMasterlist = [];
                const duplicateIdsToDelete = [];
                for (const rec of allMasterlistRecords) {
                    const cand = getComparableName(rec);
                    const isDup = uniqueMasterlist.some(exist =>
                        exist.academicYear === rec.academicYear &&
                        exist.semester === rec.semester &&
                        areNamesMatching(cand, getComparableName(exist))
                    );
                    if (isDup) {
                        if (rec.id) duplicateIdsToDelete.push(rec.id);
                    } else {
                        uniqueMasterlist.push(rec);
                    }
                }
                if (duplicateIdsToDelete.length > 0) {
                    allMasterlistRecords = uniqueMasterlist;
                    window.supabaseClient.from(tableName).delete().in('id', duplicateIdsToDelete).then(() => { }).catch(() => { });
                }
            }

            // Cache retrieved batches and terms
            cacheGranteeBatches(allMasterlistRecords);
            cacheGranteeTerms(allMasterlistRecords);

            if (rowsToHeal.length > 0) {
                Promise.all(rowsToHeal.map(r =>
                    window.supabaseClient.from(tableName).update({
                        first_name: r.first_name,
                        middle_name: r.middle_name,
                        last_name: r.last_name,
                        name: r.name
                    }).eq('id', r.id)
                )).catch(e => console.warn('Background masterlist healing error:', e));
            }

            if (importSummaryCard) importSummaryCard.classList.add('hidden');

            // Apply term filter to Step 2 table and badges
            applyTermFilterToMasterlist(selectedAcademicYear, selectedSemester);

            const granteesForVerification = extractedRecords.map(m => ({
                id: m.id,
                name: `${m.lastName || ''}, ${m.firstName || ''} ${m.middleName || ''}`.trim(),
                last_name: m.lastName,
                first_name: m.firstName,
                middle_name: m.middleName,
                batch: m.batch || '1.2',
                student_id: m.studentId || '',
                course: m.course || 'BSIT',
                year: '1'
            }));
            loadSchoolStudentsAndVerify(granteesForVerification).catch(e => console.warn('School students background verify error:', e));

        } else {
            allMasterlistRecords = [];
            if (!currentFile) {
                extractedRecords = [];
                if (importSummaryCard) importSummaryCard.classList.add('hidden');
            }
            applyTermFilterToMasterlist(selectedAcademicYear, selectedSemester);
            if (!currentFile) {
                loadSchoolStudentsAndVerify([]).catch(e => console.warn('School students background verify error:', e));
            }
        }
    } catch (err) {
        console.error('Error fetching existing masterlist:', err);
    }
}

// â”€â”€ Exported Initialization Function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function initMasterlistImport() {
    dropZone = document.getElementById('drop-zone');
    fileInput = document.getElementById('file-input');
    fileInfoContainer = document.getElementById('file-info-container');
    fileNameDisplay = document.getElementById('file-name-display');
    fileSizeDisplay = document.getElementById('file-size-display');
    btnClearFile = document.getElementById('btn-clear-file');
    btnExtract = document.getElementById('btn-extract');
    ocrProgressContainer = document.getElementById('ocr-progress-container');
    ocrStatusText = document.getElementById('ocr-status-text');
    ocrProgressBar = document.getElementById('ocr-progress-bar');
    extractedTableBody = document.getElementById('extracted-table-body');
    btnSaveRecords = document.getElementById('btn-save-records');
    filterBatch = document.getElementById('filter-batch');
    btnClearMasterlist = document.getElementById('btn-clear-masterlist');

    // Duplicate Management Elements (Step 2 Header)
    badgeMasterlistDuplicates = document.getElementById('badge-masterlist-duplicates');
    countMasterlistDuplicates = document.getElementById('count-masterlist-duplicates');
    btnMoveAllDuplicates = document.getElementById('btn-move-all-duplicates');
    if (btnMoveAllDuplicates) {
        btnMoveAllDuplicates.addEventListener('click', moveAllDuplicatesToStudentExist);
    }

    // Student Exist Elements (Step 3 Dual Container)
    saTabBtnExist = document.getElementById('sa-tab-btn-exist');
    saBadgeExistCount = document.getElementById('sa-badge-exist-count');
    saStatExistCount = document.getElementById('sa-stat-exist-count');
    saSearchExist = document.getElementById('sa-search-exist');
    saTbodyExist = document.getElementById('sa-tbody-exist');
    saBtnExportExist = document.getElementById('sa-btn-export-exist-top');
    saBtnClearExist = document.getElementById('sa-btn-clear-exist');

    // Initial load of Student Exist data
    studentExistList = loadStudentExistList(selectedAcademicYear, selectedSemester);
    renderStudentExistTable();

    // Target Scholarship Elements (Required before import)
    selectImportScholarship = document.getElementById('select-import-scholarship');
    customImportScholarshipContainer = document.getElementById('custom-import-scholarship-container');
    customImportScholarshipInput = document.getElementById('custom-import-scholarship-input');
    importScholarshipSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-scholarship-selection-container');
    importScholarshipValidationHint = document.getElementById('import-scholarship-validation-hint');
    summaryConflicts = document.getElementById('summary-conflicts');
    importConflictAlert = document.getElementById('import-conflict-alert');
    importConflictAlertText = document.getElementById('import-conflict-alert-text');

    populateImportScholarshipPrograms();

    if (selectImportScholarship) {
        selectImportScholarship.addEventListener('change', async () => {
            const val = selectImportScholarship.value;
            if (val === 'custom') {
                if (customImportScholarshipContainer) {
                    customImportScholarshipContainer.classList.remove('hidden');
                    customImportScholarshipContainer.style.display = 'block';
                }
                if (customImportScholarshipInput) customImportScholarshipInput.focus();
            } else {
                if (customImportScholarshipContainer) {
                    customImportScholarshipContainer.classList.add('hidden');
                    customImportScholarshipContainer.style.display = 'none';
                }
                if (val) {
                    selectedScholarshipProgram = val;
                    try { localStorage.setItem('scholardoc_target_scholarship', val); } catch (_) { }
                    updateStep1TargetTermBadge(selectedAcademicYear, selectedSemester, val);
                    updateStep2TermIndicator(selectedAcademicYear, selectedSemester, val);
                    if (currentFile && extractedRecords && extractedRecords.some(r => !r.id)) {
                        await checkAndFlagDuplicates(extractedRecords, getSelectedImportBatch() || 'Batch 1.2', val);
                    }
                }
            }
            clearScholarshipError();
        });

        if (selectImportScholarship.value === 'custom' && customImportScholarshipContainer) {
            customImportScholarshipContainer.classList.remove('hidden');
            customImportScholarshipContainer.style.display = 'block';
        }
    }

    if (customImportScholarshipInput) {
        customImportScholarshipInput.addEventListener('input', () => {
            clearScholarshipError();
        });
        const commitImportScholarship = async () => {
            const val = customImportScholarshipInput.value.trim();
            if (val) {
                selectedScholarshipProgram = val;
                try { localStorage.setItem('scholardoc_target_scholarship', val); } catch (_) { }
                updateStep1TargetTermBadge(selectedAcademicYear, selectedSemester, val);
                updateStep2TermIndicator(selectedAcademicYear, selectedSemester, val);
                if (currentFile && extractedRecords && extractedRecords.some(r => !r.id)) {
                    await checkAndFlagDuplicates(extractedRecords, getSelectedImportBatch() || 'Batch 1.2', val);
                }
            }
        };
        customImportScholarshipInput.addEventListener('blur', commitImportScholarship);
        customImportScholarshipInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitImportScholarship();
            }
        });
    }

    // Target Academic Period Elements (Required before import)
    selectImportAy = document.getElementById('select-import-ay');
    customImportAyContainer = document.getElementById('custom-import-ay-container');
    customImportAyInput = document.getElementById('custom-import-ay-input');
    selectImportSem = document.getElementById('select-import-sem');
    customImportSemContainer = document.getElementById('custom-import-sem-container');
    customImportSemInput = document.getElementById('custom-import-sem-input');
    importTermSelectBox = document.getElementById('import-term-selection-container');
    importTermValidationHint = document.getElementById('import-term-validation-hint');

    if (selectImportAy) {
        selectImportAy.addEventListener('change', () => {
            const val = selectImportAy.value;
            if (val === 'custom') {
                if (customImportAyContainer) {
                    customImportAyContainer.classList.remove('hidden');
                    customImportAyContainer.style.display = 'block';
                }
                if (customImportAyInput) customImportAyInput.focus();
            } else {
                if (customImportAyContainer) {
                    customImportAyContainer.classList.add('hidden');
                    customImportAyContainer.style.display = 'none';
                }
                if (val && val !== 'All') {
                    handleTermChange(val, undefined);
                }
            }
            clearTermError();
        });

        if (selectImportAy.value === 'custom' && customImportAyContainer) {
            customImportAyContainer.classList.remove('hidden');
            customImportAyContainer.style.display = 'block';
        }
    }

    if (customImportAyInput) {
        customImportAyInput.addEventListener('input', () => {
            clearTermError();
        });
        const commitImportAy = () => {
            const val = customImportAyInput.value.trim();
            if (val) {
                AcademicYearService.addCustomAcademicYear(val);
                if (selectImportAy) {
                    let hasOpt = Array.from(selectImportAy.options).some(o => o.value === val);
                    if (!hasOpt) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        const customOpt = selectImportAy.querySelector('option[value="custom"]');
                        selectImportAy.insertBefore(opt, customOpt || null);
                    }
                }
                handleTermChange(val, undefined);
            }
        };
        customImportAyInput.addEventListener('blur', commitImportAy);
        customImportAyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitImportAy();
                if (selectImportSem && selectImportSem.value === 'custom' && customImportSemInput) {
                    customImportSemInput.focus();
                }
            }
        });
    }

    if (selectImportSem) {
        selectImportSem.addEventListener('change', () => {
            const val = selectImportSem.value;
            if (val === 'custom') {
                if (customImportSemContainer) {
                    customImportSemContainer.classList.remove('hidden');
                    customImportSemContainer.style.display = 'block';
                }
                if (customImportSemInput) customImportSemInput.focus();
            } else {
                if (customImportSemContainer) {
                    customImportSemContainer.classList.add('hidden');
                    customImportSemContainer.style.display = 'none';
                }
                if (val && val !== 'All') {
                    handleTermChange(undefined, val);
                }
            }
            clearTermError();
        });

        if (selectImportSem.value === 'custom' && customImportSemContainer) {
            customImportSemContainer.classList.remove('hidden');
            customImportSemContainer.style.display = 'block';
        }
    }

    if (customImportSemInput) {
        customImportSemInput.addEventListener('input', () => {
            clearTermError();
        });
        const commitImportSem = () => {
            const val = customImportSemInput.value.trim();
            if (val) {
                AcademicYearService.addCustomSemester(val);
                if (selectImportSem) {
                    let hasOpt = Array.from(selectImportSem.options).some(o => o.value === val);
                    if (!hasOpt) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        const customOpt = selectImportSem.querySelector('option[value="custom"]');
                        selectImportSem.insertBefore(opt, customOpt || null);
                    }
                }
                handleTermChange(undefined, val);
            }
        };
        customImportSemInput.addEventListener('blur', commitImportSem);
        customImportSemInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitImportSem();
            }
        });
    }

    // Batch Selection Elements
    selectImportBatch = document.getElementById('select-import-batch');
    customBatchContainer = document.getElementById('custom-batch-container');
    customBatchInput = document.getElementById('custom-batch-input');
    batchValidationHint = document.getElementById('batch-validation-hint');
    batchSelectBox = document.getElementById('import-scholarship-batch-container') || document.getElementById('import-batch-selection-container');

    if (selectImportBatch) {
        if (!selectImportBatch.value || selectImportBatch.value === '') {
            selectImportBatch.value = 'Batch 1.2';
        }
        selectImportBatch.addEventListener('change', () => {
            const val = selectImportBatch.value;
            if (val === 'custom') {
                if (customBatchContainer) customBatchContainer.classList.remove('hidden');
                if (customBatchInput) customBatchInput.focus();
            } else {
                if (customBatchContainer) customBatchContainer.classList.add('hidden');
            }
            clearBatchError();
        });
    }

    if (customBatchInput) {
        customBatchInput.addEventListener('input', () => {
            clearBatchError();
        });
    }

    // Source Toggle Elements & Listeners
    toggleBtnGrantees = document.getElementById('toggle-source-grantees');
    toggleBtnSchool = document.getElementById('toggle-source-school');
    sectionNewGrantees = document.getElementById('section-new-grantees');
    cardSourceSchool = document.getElementById('card-source-school');
    badgeToggleGrantees = document.getElementById('badge-toggle-grantees');
    badgeToggleSchool = document.getElementById('badge-toggle-school');
    sourceActiveLabel = document.getElementById('source-active-label');

    if (toggleBtnGrantees) {
        toggleBtnGrantees.addEventListener('click', () => switchSourceSection('grantees'));
    }
    if (toggleBtnSchool) {
        toggleBtnSchool.addEventListener('click', () => switchSourceSection('school'));
    }

    if (badgeToggleGrantees) badgeToggleGrantees.textContent = extractedRecords.length;
    if (badgeToggleSchool) badgeToggleSchool.textContent = schoolStudents.length;

    // Check if source section or tab requested via notification navigation
    if (window.requestedMasterlistSource) {
        const reqSrc = window.requestedMasterlistSource;
        window.requestedMasterlistSource = null;
        switchSourceSection(reqSrc);
        if (reqSrc === 'school') {
            setTimeout(() => {
                const schoolCard = document.getElementById('card-source-school');
                if (schoolCard) {
                    schoolCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    schoolCard.style.outline = '3px solid #1E88E5';
                    schoolCard.style.outlineOffset = '2px';
                    setTimeout(() => {
                        schoolCard.style.transition = 'outline 0.8s ease';
                        schoolCard.style.outline = '3px solid transparent';
                    }, 1500);
                }
            }, 200);
        }
    }

    if (window.requestedSATab) {
        const reqTab = window.requestedSATab;
        window.requestedSATab = null;
        if (reqTab === 'form2' && saTabBtn2 && saTabPane2) activateSATab(saTabBtn2, saTabPane2);
        else if (reqTab === 'form3' && saTabBtn3 && saTabPane3) activateSATab(saTabBtn3, saTabPane3);
        else if (reqTab === 'review' && saTabBtnRev && saTabPaneRev) activateSATab(saTabBtnRev, saTabPaneRev);
        else if (reqTab === 'exist' && saTabBtnExist && saTabPaneExist) activateSATab(saTabBtnExist, saTabPaneExist);
    }

    // School Students DOM Elements
    elSchoolCount = document.getElementById('school-students-count');
    btnDownloadSchoolTemplate = document.getElementById('btn-download-school-template');
    btnToggleSchoolExpand = document.getElementById('btn-toggle-school-expand');
    iconSchoolExpand = document.getElementById('icon-school-expand');
    textSchoolExpand = document.getElementById('text-school-expand');
    btnExportSchoolCsv = document.getElementById('btn-export-school-csv');
    textExportSchoolCsv = document.getElementById('text-export-school-csv');
    schoolDropzone = document.getElementById('school-file-dropzone');
    schoolFileInput = document.getElementById('school-file-input');
    schoolUploadPrompt = document.getElementById('school-upload-prompt');
    schoolFileInfo = document.getElementById('school-file-info');
    schoolFileNameDisplay = document.getElementById('school-file-name');
    schoolFileSizeDisplay = document.getElementById('school-file-size');
    btnClearSchoolFile = document.getElementById('btn-clear-school-file');
    searchSchoolStudentsInput = document.getElementById('search-school-students');
    wrapSchoolStudents = document.getElementById('wrap-school-students');
    selectAllSchoolCb = document.getElementById('school-select-all');

    if (btnDownloadSchoolTemplate) {
        btnDownloadSchoolTemplate.addEventListener('click', () => {
            downloadSchoolStudentTemplate();
        });
    }

    if (btnExportSchoolCsv) {
        btnExportSchoolCsv.addEventListener('click', () => {
            exportSchoolStudentsCSV();
        });
    }

    if (btnToggleSchoolExpand && wrapSchoolStudents) {
        btnToggleSchoolExpand.addEventListener('click', () => {
            isSchoolTableExpanded = !isSchoolTableExpanded;
            if (isSchoolTableExpanded) {
                wrapSchoolStudents.style.maxHeight = '500px';
                if (iconSchoolExpand) iconSchoolExpand.className = 'icon-minimize-2';
                if (textSchoolExpand) textSchoolExpand.textContent = 'Collapse';
            } else {
                wrapSchoolStudents.style.maxHeight = '200px';
                if (iconSchoolExpand) iconSchoolExpand.className = 'icon-maximize-2';
                if (textSchoolExpand) textSchoolExpand.textContent = 'Expand';
            }
        });
    }

    if (searchSchoolStudentsInput) {
        searchSchoolStudentsInput.addEventListener('input', () => {
            filterSchoolStudents();
        });
    }

    if (selectAllSchoolCb) {
        selectAllSchoolCb.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.school-row-checkbox').forEach(cb => {
                cb.checked = isChecked;
                const uid = cb.dataset.uid;
                if (isChecked && uid) selectedSchoolStudentIds.add(uid);
                else if (uid) selectedSchoolStudentIds.delete(uid);
            });
            updateSchoolExportButtonText();
        });
    }

    if (schoolDropzone && schoolFileInput) {
        schoolDropzone.addEventListener('click', (e) => {
            if (e.target !== btnClearSchoolFile && !btnClearSchoolFile?.contains(e.target)) {
                schoolFileInput.click();
            }
        });

        schoolDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            schoolDropzone.style.borderColor = '#1E88E5';
            schoolDropzone.style.background = 'rgba(30,136,229,0.06)';
        });

        schoolDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            schoolDropzone.style.borderColor = 'rgba(30,136,229,0.3)';
            schoolDropzone.style.background = 'rgba(30,136,229,0.02)';
        });

        schoolDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            schoolDropzone.style.borderColor = 'rgba(30,136,229,0.3)';
            schoolDropzone.style.background = 'rgba(30,136,229,0.02)';
            if (e.dataTransfer.files.length > 0) {
                handleSchoolFile(e.dataTransfer.files[0]);
            }
        });

        schoolFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleSchoolFile(e.target.files[0]);
            }
        });
    }

    if (btnClearSchoolFile) {
        btnClearSchoolFile.addEventListener('click', async (e) => {
            e.stopPropagation();
            uploadedSchoolFile = null;
            if (schoolFileInput) schoolFileInput.value = '';
            if (schoolUploadPrompt) schoolUploadPrompt.style.display = 'flex';
            if (schoolFileInfo) schoolFileInfo.style.display = 'none';

            await loadSchoolStudentsAndVerify(extractedRecords);
            if (window.showToast) window.showToast('Reverted to default school database records.', 'info');
        });
    }

    importSummaryCard = document.getElementById('import-summary-card');
    summaryExtracted = document.getElementById('summary-extracted');
    summaryImported = document.getElementById('summary-imported');
    summarySkipped = document.getElementById('summary-skipped');
    summaryErrors = document.getElementById('summary-errors');

    saTabBtn2 = document.getElementById('sa-tab-btn-form2');
    saTabBtn3 = document.getElementById('sa-tab-btn-form3');
    saTabBtnRev = document.getElementById('sa-tab-btn-review');

    saTabPane2 = document.getElementById('sa-tab-pane-form2');
    saTabPane3 = document.getElementById('sa-tab-pane-form3');
    saTabPaneRev = document.getElementById('sa-tab-pane-review');
    saTabPaneExist = document.getElementById('sa-tab-pane-exist');

    btnExportAnnexExcel = document.getElementById('sa-btn-export-annex-excel');
    btnExportF2 = document.getElementById('sa-btn-export-form2-top');
    btnExportF3 = document.getElementById('sa-btn-export-form3-top');
    saSearchF2 = document.getElementById('sa-search-form2');
    saSearchF3 = document.getElementById('sa-search-form3');
    btnAutoResolveAll = document.getElementById('sa-btn-auto-resolve-all');

    filterAcademicYear = document.getElementById('sa-filter-ay');
    filterSemester = document.getElementById('sa-filter-sem');
    headerFilterAcademicYear = document.getElementById('sa-header-filter-ay');
    headerFilterSemester = document.getElementById('sa-header-filter-sem');
    btnRefreshTerm = document.getElementById('sa-btn-refresh-term');
    iconRefreshTerm = document.getElementById('sa-icon-refresh-term');

    const handleTermChange = async (newAY, newSem) => {
        if (newAY === 'custom') {
            openSuperAdminCustomTermModal('ay');
            if (headerFilterAcademicYear) headerFilterAcademicYear.value = selectedAcademicYear;
            if (filterAcademicYear) filterAcademicYear.value = selectedAcademicYear;
            return;
        }
        if (newSem === 'custom') {
            openSuperAdminCustomTermModal('sem');
            if (headerFilterSemester) headerFilterSemester.value = selectedSemester;
            if (filterSemester) filterSemester.value = selectedSemester;
            return;
        }

        const termChanged = (newAY !== undefined && newAY !== selectedAcademicYear) ||
                            (newSem !== undefined && newSem !== selectedSemester);

        // Before updating selectedAcademicYear and selectedSemester, save current term's Student Exist data so it is never lost
        if (termChanged && selectedAcademicYear && selectedSemester) {
            saveStudentExistList(selectedAcademicYear, selectedSemester);
        }

        if (newAY !== undefined) selectedAcademicYear = newAY;
        if (newSem !== undefined) selectedSemester = newSem;

        // If switching to a different term, clear uploaded file belonging to the prior term
        if (termChanged && currentFile) {
            currentFile = null;
            if (fileInput) fileInput.value = '';
            if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
            if (dropZone) dropZone.classList.remove('hidden');
            if (btnExtract) btnExtract.disabled = true;
            if (importSummaryCard) importSummaryCard.classList.add('hidden');
        }

        if (filterAcademicYear && filterAcademicYear.value !== selectedAcademicYear) filterAcademicYear.value = selectedAcademicYear;
        if (headerFilterAcademicYear && headerFilterAcademicYear.value !== selectedAcademicYear) headerFilterAcademicYear.value = selectedAcademicYear;
        if (filterSemester && filterSemester.value !== selectedSemester) filterSemester.value = selectedSemester;
        if (headerFilterSemester && headerFilterSemester.value !== selectedSemester) headerFilterSemester.value = selectedSemester;

        if (selectImportAy && selectImportAy.value !== selectedAcademicYear && selectedAcademicYear !== 'All') {
            selectImportAy.value = selectedAcademicYear;
        }
        if (selectImportSem && selectImportSem.value !== selectedSemester && selectedSemester !== 'All') {
            selectImportSem.value = selectedSemester;
        }

        updateStep1TargetTermBadge(selectedAcademicYear, selectedSemester);
        updateStep2TermIndicator(selectedAcademicYear, selectedSemester);

        // Save system default term!
        if (selectedAcademicYear && selectedAcademicYear !== 'All' && selectedSemester && selectedSemester !== 'All') {
            AcademicYearService.setDefaultTerm(selectedAcademicYear, selectedSemester);
        }

        await loadTermData(selectedAcademicYear, selectedSemester);
    };

    const modalCustomTerm = document.getElementById('sa-custom-term-modal');
    const btnCustomTerm = document.getElementById('sa-btn-custom-term');
    const btnCloseCustomTerm = document.getElementById('sa-btn-close-custom-term');
    const btnCancelCustomTerm = document.getElementById('sa-btn-cancel-custom-term');
    const btnSaveCustomTerm = document.getElementById('sa-btn-save-custom-term');
    const inputCustomAy = document.getElementById('sa-input-custom-ay');
    const inputCustomSem = document.getElementById('sa-input-custom-sem');

    const openSuperAdminCustomTermModal = (defaultFocus = 'ay') => {
        if (!modalCustomTerm) return;
        if (inputCustomAy) inputCustomAy.value = '';
        if (inputCustomSem) inputCustomSem.value = '';
        modalCustomTerm.classList.remove('hidden');
        modalCustomTerm.style.display = 'flex';
        setTimeout(() => {
            if (defaultFocus === 'sem' && inputCustomSem) {
                inputCustomSem.focus();
            } else if (inputCustomAy) {
                inputCustomAy.focus();
            }
        }, 50);
    };

    const closeSuperAdminCustomTermModal = () => {
        if (modalCustomTerm) {
            modalCustomTerm.classList.add('hidden');
            modalCustomTerm.style.display = 'none';
        }
    };

    if (modalCustomTerm) {
        modalCustomTerm.addEventListener('click', (e) => {
            if (e.target === modalCustomTerm) {
                closeSuperAdminCustomTermModal();
            }
        });
    }

    [inputCustomAy, inputCustomSem].forEach(inp => {
        if (inp) {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (btnSaveCustomTerm) btnSaveCustomTerm.click();
                } else if (e.key === 'Escape') {
                    closeSuperAdminCustomTermModal();
                }
            });
        }
    });

    if (btnCustomTerm) {
        btnCustomTerm.addEventListener('click', () => openSuperAdminCustomTermModal('ay'));
    }
    if (btnCloseCustomTerm) {
        btnCloseCustomTerm.addEventListener('click', closeSuperAdminCustomTermModal);
    }
    if (btnCancelCustomTerm) {
        btnCancelCustomTerm.addEventListener('click', closeSuperAdminCustomTermModal);
    }
    if (btnSaveCustomTerm) {
        btnSaveCustomTerm.addEventListener('click', async () => {
            const ayVal = (inputCustomAy ? inputCustomAy.value : '').trim();
            const semVal = (inputCustomSem ? inputCustomSem.value : '').trim();

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

            closeSuperAdminCustomTermModal();
            await populateDistinctAcademicYears();

            if (headerFilterAcademicYear && selectedAcademicYear) headerFilterAcademicYear.value = selectedAcademicYear;
            if (filterAcademicYear && selectedAcademicYear) filterAcademicYear.value = selectedAcademicYear;
            if (headerFilterSemester && selectedSemester) headerFilterSemester.value = selectedSemester;
            if (filterSemester && selectedSemester) filterSemester.value = selectedSemester;

            if (window.showToast) {
                window.showToast(`Custom term saved: ${selectedAcademicYear} • ${selectedSemester}`, 'check-circle');
            }
            await handleTermChange(selectedAcademicYear, selectedSemester);
        });
    }

    AcademicYearService.onTermsUpdated(async () => {
        await populateDistinctAcademicYears();
    });

    if (filterAcademicYear) {
        filterAcademicYear.addEventListener('change', (e) => handleTermChange(e.target.value, undefined));
    }
    if (headerFilterAcademicYear) {
        headerFilterAcademicYear.addEventListener('change', (e) => handleTermChange(e.target.value, undefined));
    }
    if (filterSemester) {
        filterSemester.addEventListener('change', (e) => handleTermChange(undefined, e.target.value));
    }
    if (headerFilterSemester) {
        headerFilterSemester.addEventListener('change', (e) => handleTermChange(undefined, e.target.value));
    }
    if (btnRefreshTerm) {
        btnRefreshTerm.addEventListener('click', async () => {
            if (iconRefreshTerm) iconRefreshTerm.classList.add('sync-spin');
            try {
                if (currentFile) {
                    currentFile = null;
                    if (fileInput) fileInput.value = '';
                    if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
                    if (dropZone) dropZone.classList.remove('hidden');
                    if (btnExtract) btnExtract.disabled = true;
                    if (importSummaryCard) importSummaryCard.classList.add('hidden');
                }
                if (selectedAcademicYear && selectedAcademicYear !== 'All' && selectedSemester && selectedSemester !== 'All') {
                    fetch('/api/academic-term/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ academicYear: selectedAcademicYear, semester: selectedSemester })
                    }).catch(() => { });
                }
                await fetchExistingMasterlist();
                await loadTermData(selectedAcademicYear, selectedSemester);
                if (window.showToast) {
                    window.showToast(`Synchronized database for ${selectedAcademicYear} (${selectedSemester})`, 'check-circle');
                }
            } finally {
                if (iconRefreshTerm) iconRefreshTerm.classList.remove('sync-spin');
            }
        });
    }

    const populateDistinctAcademicYears = async () => {
        try {
            const [years, semesters] = await Promise.all([
                AcademicYearService.getAcademicYears(),
                AcademicYearService.getSemesters()
            ]);

            const ayHtml = years.map(y => `<option value="${y}" ${y === selectedAcademicYear ? 'selected' : ''}>${y}</option>`).join('') +
                `<option value="All" ${selectedAcademicYear === 'All' ? 'selected' : ''}>All School Years</option>` +
                `<option value="custom">+ Custom A.Y....</option>`;

            if (filterAcademicYear) {
                filterAcademicYear.innerHTML = ayHtml;
                filterAcademicYear.value = selectedAcademicYear;
            }
            if (headerFilterAcademicYear) {
                headerFilterAcademicYear.innerHTML = ayHtml;
                headerFilterAcademicYear.value = selectedAcademicYear;
            }

            const semHtml = semesters.map(s => `<option value="${s}" ${s === selectedSemester ? 'selected' : ''}>${s}</option>`).join('') +
                `<option value="All" ${selectedSemester === 'All' ? 'selected' : ''}>All Semesters</option>` +
                `<option value="custom">+ Custom Semester...</option>`;

            if (filterSemester) {
                filterSemester.innerHTML = semHtml;
                filterSemester.value = selectedSemester;
            }
            if (headerFilterSemester) {
                headerFilterSemester.innerHTML = semHtml;
                headerFilterSemester.value = selectedSemester;
            }

            if (!selectImportAy) selectImportAy = document.getElementById('select-import-ay');
            if (!selectImportSem) selectImportSem = document.getElementById('select-import-sem');

            if (selectImportAy) {
                let sAyHtml = `<option value="" disabled ${!selectedAcademicYear ? 'selected' : ''}>-- Select Academic Year * --</option>`;
                sAyHtml += years.map(y => `<option value="${y}" ${y === selectedAcademicYear ? 'selected' : ''}>${y}</option>`).join('');
                sAyHtml += `<option value="custom">+ Enter Custom A.Y....</option>`;
                selectImportAy.innerHTML = sAyHtml;
                if (selectedAcademicYear && selectedAcademicYear !== 'All') {
                    selectImportAy.value = selectedAcademicYear;
                }
            }

            if (selectImportSem) {
                let sSemHtml = `<option value="" disabled ${!selectedSemester ? 'selected' : ''}>-- Select Semester * --</option>`;
                sSemHtml += semesters.map(s => `<option value="${s}" ${s === selectedSemester ? 'selected' : ''}>${s}</option>`).join('');
                sSemHtml += `<option value="custom">+ Enter Custom Semester...</option>`;
                selectImportSem.innerHTML = sSemHtml;
                if (selectedSemester && selectedSemester !== 'All') {
                    selectImportSem.value = selectedSemester;
                }
            }
        } catch (e) {
            console.warn('Could not query distinct terms in Super Admin:', e);
        }
    };

    // Real-time synchronization when system default academic term is updated across interfaces
    AcademicYearService.onDefaultTermUpdated(async (newTerm) => {
        if (newTerm?.academicYear === selectedAcademicYear && newTerm?.semester === selectedSemester) {
            return;
        }
        if (isImportingMasterlist) {
            return;
        }
        if (newTerm?.academicYear) selectedAcademicYear = newTerm.academicYear;
        if (newTerm?.semester) selectedSemester = newTerm.semester;
        if (currentFile) {
            currentFile = null;
            if (fileInput) fileInput.value = '';
            if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
            if (dropZone) dropZone.classList.remove('hidden');
            if (btnExtract) btnExtract.disabled = true;
            if (importSummaryCard) importSummaryCard.classList.add('hidden');
        }
        await populateDistinctAcademicYears();
        updateStep1TargetTermBadge(selectedAcademicYear, selectedSemester);
        updateStep2TermIndicator(selectedAcademicYear, selectedSemester);
        await loadTermData(selectedAcademicYear, selectedSemester);
    });

    const loadTermData = async (ay, sem) => {
        if (iconRefreshTerm) iconRefreshTerm.classList.add('sync-spin');
        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            syncBadge.innerHTML = `<i class="icon-refresh-cw sync-spin" style="font-size: 13px;"></i> Loading ${sem} (${ay})...`;
            syncBadge.style.display = 'inline-flex';
        }

        try {
            const dbSync = await AnnexSyncService.loadFromSupabase({
                academicYear: ay,
                semester: sem,
                fallbackToLatest: false
            });

            // Load and render Student Exist table for the active term
            studentExistList = loadStudentExistList(ay, sem);
            renderStudentExistTable();

            if (dbSync && dbSync.fromDb && ((dbSync.form2List && dbSync.form2List.length > 0) || (dbSync.form3List && dbSync.form3List.length > 0))) {
                verifiedForm2List = (dbSync.form2List || []).filter(item => {
                    const iAy = item.academic_year || item.grantee?.academic_year || item.matchedStudent?.academic_year;
                    const iSem = item.semester || item.grantee?.semester || item.matchedStudent?.semester;
                    return isAcademicYearMatch(iAy, ay) && isSemesterMatch(iSem, sem);
                });
                const existPool = (studentExistList || []).map(e => getComparableName(e));
                verifiedForm3List = (dbSync.form3List || []).filter(item => {
                    const iAy = item.academic_year || item.grantee?.academic_year || item.matchedStudent?.academic_year;
                    const iSem = item.semester || item.grantee?.semester || item.matchedStudent?.semester;
                    if (!isAcademicYearMatch(iAy, ay) || !isSemesterMatch(iSem, sem)) return false;
                    const r = item?.matchedStudent?.remarks || item?.remarks || item?.specialStatusReason || '';
                    if (String(r).includes('Categorized from Student Exist')) return false;
                    if ((studentExistList || []).some(ex => AnnexSyncService.isSameStudent(ex, item))) return false;
                    const cand = getComparableName(item.grantee || item.matchedStudent || item);
                    if (existPool.some(e => areNamesMatching(cand, e))) return false;
                    return true;
                });
                needsReviewList = [];
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                renderAnnexForm3Table(verifiedForm3List);
                renderAnnexReviewQueue(needsReviewList);

                AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    studentExistList: studentExistList,
                    needsReviewList: [],
                    updatedBy: `Term Filter (${ay} ${sem})`,
                    syncToDb: false,
                    academicYear: ay,
                    semester: sem
                });
            } else {
                // Supabase returned empty for this term — clear stale local cache so deleted records do not reappear
                verifiedForm2List = [];
                verifiedForm3List = [];
                needsReviewList = [];
                AnnexSyncService.saveVerifiedData({
                    form2List: [],
                    form3List: [],
                    studentExistList: studentExistList,
                    needsReviewList: [],
                    updatedBy: `Term Filter (${ay} ${sem})`,
                    syncToDb: false,
                    academicYear: ay,
                    semester: sem
                });
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                renderAnnexForm3Table(verifiedForm3List);
                renderAnnexReviewQueue(needsReviewList);
            }

            // Synchronize the masterlist table and top badge for this term
            applyTermFilterToMasterlist(ay, sem);

            // Synchronize school students table for this term
            await loadSchoolStudentsAndVerify(extractedRecords);

            if (syncBadge) {
                const gCount = extractedRecords.length;
                const f2Count = verifiedForm2List.length;
                const f3Count = verifiedForm3List.length;
                if (gCount > 0 || f2Count > 0 || f3Count > 0) {
                    syncBadge.innerHTML = `<i class="icon-database" style="font-size: 13px;"></i> ${ay} ${sem} (${gCount} Grantees: ${f2Count} Form 2, ${f3Count} Form 3)`;
                } else {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> 0 Records for ${ay} ${sem}`;
                }
                syncBadge.style.display = 'inline-flex';
            }
        } catch (err) {
            console.error('Error loading term data:', err);
            if (window.showToast) window.showToast('Failed to load records for term: ' + (err.message || err), 'error');
        } finally {
            if (iconRefreshTerm) iconRefreshTerm.classList.remove('sync-spin');
        }
    };

    // Drag and drop events
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary-color)';
            dropZone.style.background = 'rgba(var(--primary-rgb), 0.05)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = 'rgba(0,0,0,0.01)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = 'rgba(0,0,0,0.01)';

            const selectedTerm = getSelectedImportTerm();
            if (!selectedTerm) {
                return;
            }

            const selectedScholarship = getSelectedImportScholarship();
            if (!selectedScholarship) {
                return;
            }

            const selectedBatch = getSelectedImportBatch();
            if (!selectedBatch) {
                return;
            }

            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0], selectedBatch, selectedTerm, selectedScholarship);
            }
        });

        dropZone.addEventListener('click', () => {
            const selectedTerm = getSelectedImportTerm();
            if (!selectedTerm) {
                return;
            }

            const selectedScholarship = getSelectedImportScholarship();
            if (!selectedScholarship) {
                return;
            }

            const selectedBatch = getSelectedImportBatch();
            if (!selectedBatch) {
                return;
            }
            if (fileInput) fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const selectedTerm = getSelectedImportTerm();
            if (!selectedTerm) {
                fileInput.value = '';
                return;
            }

            const selectedScholarship = getSelectedImportScholarship();
            if (!selectedScholarship) {
                fileInput.value = '';
                return;
            }

            const selectedBatch = getSelectedImportBatch();
            if (!selectedBatch) {
                fileInput.value = '';
                return;
            }
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0], selectedBatch, selectedTerm, selectedScholarship);
            }
        });
    }

    if (btnClearFile) {
        btnClearFile.addEventListener('click', clearFileState);
    }

    if (btnExtract) {
        btnExtract.addEventListener('click', async () => {
            if (!currentFile) return;
            const selectedTerm = getSelectedImportTerm();
            if (!selectedTerm) return;
            const selectedScholarship = getSelectedImportScholarship();
            if (!selectedScholarship) return;
            const selectedBatch = getSelectedImportBatch();
            if (!selectedBatch) return;
            await executeAutoImportPipeline(currentFile, selectedBatch, selectedTerm, selectedScholarship);
        });
    }

    if (filterBatch) {
        filterBatch.addEventListener('change', () => {
            renderTable();
        });
    }

    if (btnSaveRecords) {
        btnSaveRecords.addEventListener('click', saveRecordsToDatabase);
    }

    if (btnClearMasterlist) {
        btnClearMasterlist.addEventListener('click', async () => {
            if (!extractedRecords || extractedRecords.length === 0) {
                alert('The masterlist is already empty for the selected term.');
                return;
            }

            const hasSpecificTerm = (selectedAcademicYear && selectedAcademicYear !== 'All') || (selectedSemester && selectedSemester !== 'All');
            const termLabel = (selectedAcademicYear !== 'All' ? `A.Y. ${selectedAcademicYear}` : 'All School Years') +
                (selectedSemester !== 'All' ? ` (${selectedSemester})` : '');

            const confirmed = confirm(
                `Are you sure you want to permanently delete ALL ${extractedRecords.length} records from the New Grantees Masterlist for ${termLabel}?\n\nThis will remove them from the database and cannot be undone.`
            );
            if (!confirmed) return;

            const origHtml = btnClearMasterlist.innerHTML;
            btnClearMasterlist.disabled = true;
            btnClearMasterlist.innerHTML = '<i class="icon-loader" style="font-size: 13px; animation: spin 1s linear infinite; display: inline-block;"></i> Clearing...';

            try {
                const idsToDelete = extractedRecords.map(r => r.id).filter(Boolean);
                let query = window.supabaseClient.from(getTableName()).delete();
                if (idsToDelete.length > 0 && hasSpecificTerm) {
                    query = query.in('id', idsToDelete);
                } else {
                    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
                }

                const { data, error } = await query.select();

                if (error) {
                    console.error('Error clearing masterlist:', error);
                    alert(`Failed to clear masterlist from database: ${error.message}`);
                    return;
                }

                if (data && data.length === 0 && idsToDelete.length > 0) {
                    alert(
                        'Notice: Records could not be deleted from Supabase because Row Level Security (RLS) is active without a DELETE policy.\n\n' +
                        'Please run the "scratch/fix_new_grantees_rls.sql" script in your Supabase SQL Editor to grant DELETE permissions.'
                    );
                }

                // Remove deleted records from in-memory allMasterlistRecords
                const idSet = new Set(idsToDelete);
                if (hasSpecificTerm && idsToDelete.length > 0) {
                    allMasterlistRecords = allMasterlistRecords.filter(r => !idSet.has(r.id));
                } else {
                    allMasterlistRecords = [];
                }

                extractedRecords = [];
                currentFile = null;
                if (fileInput) fileInput.value = '';
                if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
                if (dropZone) dropZone.classList.remove('hidden');
                if (btnExtract) btnExtract.disabled = true;
                if (summaryExtracted) summaryExtracted.textContent = '0';
                if (summaryImported) summaryImported.textContent = '0';
                if (summarySkipped) summarySkipped.textContent = '0';
                if (btnSaveRecords) btnSaveRecords.classList.add('hidden');
                if (importSummaryCard) importSummaryCard.classList.add('hidden');

                applyTermFilterToMasterlist(selectedAcademicYear, selectedSemester);

                if (typeof window.showToast === 'function') {
                    window.showToast(`Grantees removed for ${termLabel}.`, 'trash-2');
                }
            } catch (err) {
                console.error('Error in clear masterlist:', err);
                alert('An unexpected error occurred: ' + (err.message || err));
            } finally {
                btnClearMasterlist.disabled = false;
                btnClearMasterlist.innerHTML = origHtml;
                updateClearMasterlistButtonVisibility();
            }
        });
    }

    // Annex Tab Switching
    if (saTabBtn2) saTabBtn2.addEventListener('click', () => activateSATab(saTabBtn2, saTabPane2));
    if (saTabBtn3) saTabBtn3.addEventListener('click', () => activateSATab(saTabBtn3, saTabPane3));
    if (saTabBtnExist) saTabBtnExist.addEventListener('click', () => activateSATab(saTabBtnExist, saTabPaneExist));
    if (saTabBtnRev) saTabBtnRev.addEventListener('click', () => activateSATab(saTabBtnRev, saTabPaneRev));

    // Student Exist search, export, and clear listeners
    if (saSearchExist) {
        saSearchExist.addEventListener('input', (e) => renderStudentExistTable(e.target.value));
    }
    if (saBtnExportExist) {
        saBtnExportExist.addEventListener('click', exportStudentExistToExcel);
    }
    if (saBtnClearExist) {
        saBtnClearExist.addEventListener('click', clearStudentExistList);
    }

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

    // Annex Auto-Fill Excel Exports
    const mapStudentsForForm2 = (list) => {
        return list.map(item => {
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
                batch: grantee.batch || matched.batch || '1',
                gender: matched.gender || grantee.gender || 'M',
                birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                course: matched.course || grantee.course || grantee.program || '',
                year: matched.year || grantee.year || '1',
                email: matched.email || matched.authEmail || grantee.email || '',
                contactNumber: matched.contactNumber || matched.phone || grantee.contactNumber || grantee.phone || ''
            };
        });
    };

    const mapStudentsForForm3 = (list) => {
        return list.map(item => {
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
                batch: grantee.batch || matched.batch || '1',
                gender: matched.gender || grantee.gender || 'M',
                birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                course: matched.course || grantee.course || grantee.program || '',
                year: matched.year || grantee.year || '1',
                status: specialReason,
                remarks: item.remarks || (specialReason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${specialReason}`)
            };
        });
    };

    const resolveExportBatch = (list) => {
        if (filterBatch && filterBatch.value && filterBatch.value !== 'All Batches') {
            return filterBatch.value;
        }
        if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
                const b = item.batch || item.grantee?.batch || item.matchedStudent?.batch;
                if (b && String(b).trim() && String(b).trim() !== 'null' && String(b).trim() !== 'undefined') {
                    return String(b).trim();
                }
            }
        }
        if (selectImportBatch && selectImportBatch.value && selectImportBatch.value !== 'custom') {
            return selectImportBatch.value;
        }
        if (customBatchInput && customBatchInput.value && customBatchInput.value.trim()) {
            return customBatchInput.value.trim();
        }
        return '1.2';
    };

    const resolveExportTerm = () => {
        let ay = selectedAcademicYear;
        if (!ay || ay === 'All' || !ay.includes('-')) {
            ay = AcademicYearService.getDefaultTerm()?.academicYear || '2026-2027';
        }
        let sem = selectedSemester;
        if (!sem || sem === 'All') {
            sem = '1st Semester';
        }
        return { academicYear: ay, semester: sem };
    };

    const exportConsolidatedAnnex = async (triggerBtn) => {
        const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
        try {
            if (triggerBtn) {
                triggerBtn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
                triggerBtn.disabled = true;
            }

            // Fetch template
            let resp = await fetch('/assets/0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) resp = await fetch('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) resp = await fetch('../assets/0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) resp = await fetch('superadmin_web/assets/0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) resp = await fetch('/superadmin_web/assets/0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) resp = await fetch('0_Annex_5_TES_New_Billing_Form.xlsx');
            if (!resp.ok) {
                throw new Error('Could not load Annex 5 template (0_Annex_5_TES_New_Billing_Form.xlsx)');
            }
            const blob = await resp.blob();

            const studentsForm2 = mapStudentsForForm2(verifiedForm2List);
            const studentsForm3 = mapStudentsForForm3(verifiedForm3List);
            const currentBatch = resolveExportBatch(studentsForm2.length > 0 ? studentsForm2 : studentsForm3);
            const term = resolveExportTerm();

            const metadata = {
                academicYear: term.academicYear,
                semester: term.semester,
                batch: currentBatch,
                regionalCode: '10',
                heiCode: 'USTP',
                heiName: 'University of Science and Technology of Southern Philippines',
                heiAddress: 'Oroquieta Campus, Mobod, Oroquieta City, Misamis Occidental',
                regionalOffice: 'CHED - Regional Office 10',
                regionalAddress: 'Zone 6, Bayabas, Cagayan de Oro City'
            };

            const result = await BillingService.fillConsolidatedAnnex5(blob, studentsForm2, studentsForm3, metadata);
            const semClean = term.semester.replace(/[^a-zA-Z0-9]/g, '_');
            const ayClean = term.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Annex_5_TES_Consolidated_${ayClean}_${semClean}_${Date.now()}.xlsx`;

            downloadBlob(result.blob, fileName);

            if (typeof window.showToast === 'function') {
                window.showToast(`Exported Consolidated Annex 5 (${result.form2Count} Form 2, ${result.form3Count} Form 3 records)!`, 'check-circle');
            }
        } catch (err) {
            console.error('Consolidated Annex 5 export error:', err);
            alert('Failed to generate Consolidated Annex 5: ' + err.message);
        } finally {
            if (triggerBtn) {
                triggerBtn.innerHTML = originalHtml;
                triggerBtn.disabled = false;
            }
        }
    };

    const exportForm2Only = async (triggerBtn) => {
        const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
        try {
            if (triggerBtn) {
                triggerBtn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
                triggerBtn.disabled = true;
            }

            // Fetch Form 2 template
            let resp = await fetch('/assets/Annex 5-TES New Form 2.xlsx');
            if (!resp.ok) resp = await fetch('assets/Annex 5-TES New Form 2.xlsx');
            if (!resp.ok) resp = await fetch('../assets/Annex 5-TES New Form 2.xlsx');
            if (!resp.ok) resp = await fetch('superadmin_web/assets/Annex 5-TES New Form 2.xlsx');
            if (!resp.ok) resp = await fetch('/superadmin_web/assets/Annex 5-TES New Form 2.xlsx');
            if (!resp.ok) resp = await fetch('assets/Annex_5_TES_New_Form_2.xlsx');
            if (!resp.ok) {
                throw new Error('Could not load Annex 5 Form 2 template (Annex 5-TES New Form 2.xlsx)');
            }
            const blob = await resp.blob();

            const studentsForm2 = mapStudentsForForm2(verifiedForm2List);
            const currentBatch = resolveExportBatch(studentsForm2);
            const term = resolveExportTerm();

            const metadata = {
                academicYear: term.academicYear,
                semester: term.semester,
                batch: currentBatch,
                regionalCode: '10',
                heiCode: 'USTP'
            };

            const result = await BillingService.fillAnnex5Form2(blob, studentsForm2, metadata);
            const semClean = term.semester.replace(/[^a-zA-Z0-9]/g, '_');
            const ayClean = term.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Annex_5_TES_Form_2_${ayClean}_${semClean}_${Date.now()}.xlsx`;

            downloadBlob(result.blob, fileName);

            if (typeof window.showToast === 'function') {
                window.showToast(`Exported Annex 5 - Form 2 (${result.count} records)!`, 'check-circle');
            }
        } catch (err) {
            console.error('Annex 5 Form 2 export error:', err);
            alert('Failed to generate Annex 5 Form 2: ' + err.message);
        } finally {
            if (triggerBtn) {
                triggerBtn.innerHTML = originalHtml;
                triggerBtn.disabled = false;
            }
        }
    };

    const exportForm3Only = async (triggerBtn) => {
        const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
        try {
            if (triggerBtn) {
                triggerBtn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
                triggerBtn.disabled = true;
            }

            // Fetch Form 3 template
            let resp = await fetch('/assets/Annex 5-TES New Form 3.xlsx');
            if (!resp.ok) resp = await fetch('assets/Annex 5-TES New Form 3.xlsx');
            if (!resp.ok) resp = await fetch('../assets/Annex 5-TES New Form 3.xlsx');
            if (!resp.ok) resp = await fetch('superadmin_web/assets/Annex 5-TES New Form 3.xlsx');
            if (!resp.ok) resp = await fetch('/superadmin_web/assets/Annex 5-TES New Form 3.xlsx');
            if (!resp.ok) resp = await fetch('assets/Annex_5_TES_New_Form_3.xlsx');
            if (!resp.ok) {
                throw new Error('Could not load Annex 5 Form 3 template (Annex 5-TES New Form 3.xlsx)');
            }
            const blob = await resp.blob();

            const studentsForm3 = mapStudentsForForm3(verifiedForm3List);
            const currentBatch = resolveExportBatch(studentsForm3);
            const term = resolveExportTerm();

            const metadata = {
                academicYear: term.academicYear,
                semester: term.semester,
                batch: currentBatch,
                regionalCode: '10',
                heiCode: 'USTP'
            };

            const result = await BillingService.fillAnnex5Form3(blob, studentsForm3, metadata);
            const semClean = term.semester.replace(/[^a-zA-Z0-9]/g, '_');
            const ayClean = term.academicYear.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Annex_5_TES_Form_3_${ayClean}_${semClean}_${Date.now()}.xlsx`;

            downloadBlob(result.blob, fileName);

            if (typeof window.showToast === 'function') {
                window.showToast(`Exported Annex 5 - Form 3 (${result.count} records)!`, 'check-circle');
            }
        } catch (err) {
            console.error('Annex 5 Form 3 export error:', err);
            alert('Failed to generate Annex 5 Form 3: ' + err.message);
        } finally {
            if (triggerBtn) {
                triggerBtn.innerHTML = originalHtml;
                triggerBtn.disabled = false;
            }
        }
    };

    if (btnExportAnnexExcel) {
        btnExportAnnexExcel.addEventListener('click', () => exportConsolidatedAnnex(btnExportAnnexExcel));
    }

    if (btnExportF2) {
        btnExportF2.addEventListener('click', () => exportForm2Only(btnExportF2));
    }

    if (btnExportF3) {
        btnExportF3.addEventListener('click', () => exportForm3Only(btnExportF3));
    }

    // Annex Search Inputs
    if (saSearchF2) {
        saSearchF2.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = verifiedForm2List.filter(item => {
                const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
                const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
                return !q || name.includes(q) || id.includes(q);
            });
            renderAnnexForm2Table(filtered);
        });
    }

    if (saSearchF3) {
        saSearchF3.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = verifiedForm3List.filter(item => {
                const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
                const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
                return !q || name.includes(q) || id.includes(q);
            });
            renderAnnexForm3Table(filtered);
        });
    }

    // Form 2 Clear Data Action
    const saBtnClearForm2 = document.getElementById('sa-btn-clear-form2-data');
    if (saBtnClearForm2) {
        saBtnClearForm2.addEventListener('click', async () => {
            if (verifiedForm2List.length === 0) {
                alert('Form 2 table is already empty.');
                return;
            }
            if (confirm('Are you sure you want to clear all records from the Annex Form 2 table? This will clear local cache and delete records from Supabase.')) {
                verifiedForm2List = [];
                const synced = AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: needsReviewList,
                    updatedBy: 'Super Admin',
                    syncToDb: false
                });
                if (synced) {
                    verifiedForm2List = synced.form2List;
                    verifiedForm3List = synced.form3List;
                    needsReviewList = synced.needsReviewList;
                }
                if (window.supabaseClient) {
                    try {
                        await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    } catch (dbErr) {
                        console.warn('Error deleting annex_form_2 in Supabase:', dbErr);
                    }
                }
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                const syncBadge = document.getElementById('sa-sync-status-badge');
                if (syncBadge) {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Form 2 Cleared (0 Records)`;
                }
                if (window.showToast) window.showToast('Annex Form 2 records cleared.', 'info');
            }
        });
    }

    // Form 3 Clear Data Action
    const saBtnClearForm3 = document.getElementById('sa-btn-clear-form3-data');
    if (saBtnClearForm3) {
        saBtnClearForm3.addEventListener('click', async () => {
            if (verifiedForm3List.length === 0) {
                alert('Form 3 table is already empty.');
                return;
            }
            if (confirm('Are you sure you want to remove all records from the Annex Form 3 table? This will clear local cache and delete records from Supabase.')) {
                verifiedForm3List = [];
                const synced = AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: needsReviewList,
                    updatedBy: 'Super Admin',
                    syncToDb: false
                });
                if (synced) {
                    verifiedForm2List = synced.form2List;
                    verifiedForm3List = synced.form3List;
                    needsReviewList = synced.needsReviewList;
                }
                if (window.supabaseClient) {
                    try {
                        await window.supabaseClient.from('annex_form_3').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    } catch (dbErr) {
                        console.warn('Error deleting annex_form_3 in Supabase:', dbErr);
                    }
                }
                updateAnnexKPIs();
                renderAnnexForm3Table(verifiedForm3List);
                const syncBadge = document.getElementById('sa-sync-status-badge');
                if (syncBadge) {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Form 3 Cleared (0 Records)`;
                }
                if (window.showToast) window.showToast('Annex Form 3 records cleared.', 'info');
            }
        });
    }

    // Manual DB Refresh Action
    const refreshFromDb = async () => {
        await loadTermData(selectedAcademicYear, selectedSemester);
        if (window.showToast) window.showToast(`Database synced for ${selectedAcademicYear} ${selectedSemester}: ${verifiedForm2List.length} Form 2, ${verifiedForm3List.length} Form 3 records.`, 'check-circle');
    };

    const saBtnRefreshF2 = document.getElementById('sa-btn-refresh-form2-db');
    if (saBtnRefreshF2) saBtnRefreshF2.addEventListener('click', refreshFromDb);
    const saBtnRefreshF3 = document.getElementById('sa-btn-refresh-form3-db');
    if (saBtnRefreshF3) saBtnRefreshF3.addEventListener('click', refreshFromDb);

    window.refreshAnnexFromDb = refreshFromDb;
    window.clearAnnexForm2 = async () => {
        verifiedForm2List = [];
        AnnexSyncService.saveVerifiedData({
            form2List: [],
            form3List: verifiedForm3List,
            needsReviewList: needsReviewList,
            updatedBy: 'Manual Clear',
            syncToDb: false
        });
        if (window.supabaseClient) {
            await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
    };

    // Modal Handlers for Super Admin Grantee Categorization
    const saBtnCloseRes = document.getElementById('sa-btn-close-resolution');
    const saBtnCancelRes = document.getElementById('sa-btn-cancel-resolution');
    const saBtnConfirmRes = document.getElementById('sa-btn-confirm-resolution');
    const saModalTargetForm = document.getElementById('sa-modal-target-form');
    const saModalForm3ReasonGroup = document.getElementById('sa-modal-form3-reason-group');
    const saModalForm3Reason = document.getElementById('sa-modal-form3-reason');
    const saModalRemarks = document.getElementById('sa-modal-remarks');

    if (saBtnCloseRes) saBtnCloseRes.addEventListener('click', closeSuperAdminResolutionModal);
    if (saBtnCancelRes) saBtnCancelRes.addEventListener('click', closeSuperAdminResolutionModal);

    if (saModalTargetForm) {
        saModalTargetForm.addEventListener('change', (e) => {
            if (saModalForm3ReasonGroup) {
                saModalForm3ReasonGroup.style.display = e.target.value === 'form3' ? 'block' : 'none';
            }
        });
    }

    if (saBtnConfirmRes) {
        saBtnConfirmRes.addEventListener('click', () => {
            if (activeSAResolutionItem === null) return;
            const targetForm = saModalTargetForm ? saModalTargetForm.value : 'form3';
            const reason = saModalForm3Reason ? saModalForm3Reason.value : 'Not enrolled';
            const remarks = saModalRemarks ? saModalRemarks.value.trim() : '';

            resolveSuperAdminReviewItem(activeSAResolutionItem, targetForm, reason, remarks);
            closeSuperAdminResolutionModal();
        });
    }

    // Auto-Categorize All to Form 3
    if (btnAutoResolveAll) {
        btnAutoResolveAll.addEventListener('click', () => {
            if (needsReviewList.length === 0) {
                if (window.showToast) window.showToast('Review queue is already empty.', 'info');
                return;
            }
            const count = needsReviewList.length;
            while (needsReviewList.length > 0) {
                const item = needsReviewList.shift();
                item.classification = 'INACTIVE_FORM3';
                item.isEnrolled = false;
                item.specialStatusReason = 'Not enrolled';
                item.remarks = 'Batch categorized to Form 3 by Super Admin';
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
                updatedBy: 'Super Admin',
                syncToDb: false,
                academicYear: selectedAcademicYear,
                semester: selectedSemester
            });
            if (synced) {
                verifiedForm2List = synced.form2List;
                verifiedForm3List = synced.form3List;
                needsReviewList = synced.needsReviewList;
            }
            updateAnnexKPIs();
            renderAnnexForm3Table(verifiedForm3List);
            renderAnnexReviewQueue(needsReviewList);
            if (window.showToast) window.showToast(`Auto-categorized ${count} records to Form 3`, 'check-circle');
        });
    }

    // Subscribe to live synchronization with Admin Review Queue
    AnnexSyncService.onSync((synced) => {
        if (!synced) return;
        // Strictly ignore sync broadcasts for other academic periods to preserve term isolation
        if (synced.academicYear && selectedAcademicYear && selectedAcademicYear !== 'All' && synced.academicYear !== selectedAcademicYear) return;
        if (synced.semester && selectedSemester && selectedSemester !== 'All' && synced.semester !== selectedSemester) return;

        verifiedForm2List = synced.form2List || [];
        verifiedForm3List = synced.form3List || [];
        needsReviewList = synced.needsReviewList || [];

        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
        renderAnnexForm3Table(verifiedForm3List);
        renderAnnexReviewQueue(needsReviewList);

        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            const timeStr = new Date(synced.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Synced with Admin (${timeStr})`;
            syncBadge.style.display = 'inline-flex';
        }
    });

    // Initialize academic years dropdown, then load masterlist and active term data
    populateDistinctAcademicYears().then(async () => {
        await fetchExistingMasterlist();
        await loadTermData(selectedAcademicYear, selectedSemester);
    }).catch(e => {
        console.warn('Error during initMasterlistImport startup:', e);
    });

    // Subscribe to Realtime updates for school_students table (updates Superadmin automatically when Admin uploads list file)
    if (window.supabaseClient) {
        try {
            window.supabaseClient
                .channel('superadmin-school-students-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'school_students' }, async (payload) => {
                    console.log('[Realtime] school_students change event in Superadmin:', payload.eventType);
                    await loadSchoolStudentsAndVerify(extractedRecords);
                })
                .subscribe();
        } catch (rtErr) {
            console.warn('Realtime subscription error for school_students:', rtErr);
        }
    }
}

// Auto-run if loaded directly in standalone view
if (!window.__reportsHostingImport && document.getElementById('drop-zone')) {
    initMasterlistImport();
}
