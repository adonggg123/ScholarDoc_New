// js/views/annex5_generator.js
import { BillingService } from '../services/billing_service.js';
import { VerificationService } from '../services/verification_service.js';

const supabase = window.supabaseClient;

// State
let rawSuperAdminGrantees = [];
let rawSchoolStudents = [];
let uploadedSchoolFile = null;

let selectedSchoolStudentIds = new Set();
let isSchoolTableExpanded = false;

let verifiedForm2List = [];
let verifiedForm3List = [];
let needsReviewList = [];

let activeResolutionItem = null;

// ── 1. Load Data from Supabase ───────────────────────────────────────
async function loadInitialData() {
    try {
        // 1. Fetch Super Admin Grantee Masterlist
        let { data: masterlistData, error: errMasterlist } = await supabase
            .from('scholar_masterlist')
            .select('*')
            .order('created_at', { ascending: false });

        if (!errMasterlist && masterlistData && masterlistData.length > 0) {
            rawSuperAdminGrantees = masterlistData.map(m => ({
                id: m.id,
                name: m.name || `${m.last_name || ''}, ${m.first_name || ''} ${m.middle_name || ''}`.trim(),
                last_name: m.last_name,
                first_name: m.first_name,
                middle_name: m.middle_name,
                batch: m.batch || 'Batch 1',
                student_id: m.student_id || '',
                course: m.course || m.program || '',
                year: m.year || '1'
            }));
            const syncEl = document.getElementById('superadmin-sync-status');
            if (syncEl) syncEl.innerHTML = `<i class="icon-check-circle-2" style="font-size: 14px;"></i> Synced with Super Admin Import`;
        } else {
            // Seed from active grantees in database
            const { data: seedStudents } = await supabase.from('students').select('*');
            rawSuperAdminGrantees = (seedStudents || []).map(s => {
                const norm = VerificationService.normalizeName(s.fullName);
                return {
                    id: s.uid || s.id,
                    name: s.fullName,
                    last_name: norm.lastName,
                    first_name: norm.firstName,
                    middle_name: norm.middleName,
                    batch: s.batch || 'Batch 1',
                    student_id: s.studentId,
                    course: s.course,
                    year: s.year,
                    saNumber: s.saNumber || s.familyDetails?.saNumber
                };
            });
        }

        // 2. Fetch Default School Student Records (Institutional DB)
        const { data: schoolDbData, error: errSchool } = await supabase
            .from('students')
            .select('*')
            .order('createdAt', { ascending: false });

        if (!errSchool && schoolDbData) {
            rawSchoolStudents = schoolDbData;
        }

        updateSourceCounts();
        populateSuperAdminBatchFilter();
        renderSuperAdminGranteesTable(rawSuperAdminGrantees);
        renderSchoolStudentsTable(rawSchoolStudents);
        runCrossVerification();

    } catch (e) {
        console.error('Error loading initial verification data:', e);
        showToast('Error loading records: ' + e.message, 'alert-triangle');
    }
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-secondary);">No grantees found in Super Admin masterlist.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((g, idx) => {
        const fullName = g.name || `${g.last_name || ''}, ${g.first_name || ''} ${g.middle_name || ''}`.trim();
        return `
            <tr>
                <td style="font-weight: 700; color: var(--primary-color);">${idx + 1}</td>
                <td><span style="font-weight: 600; font-family: monospace; font-size: 11px;">${g.student_id || g.studentId || 'Unassigned'}</span></td>
                <td style="font-weight: 600;">${fullName}</td>
                <td>${g.course || 'BSIT'}</td>
                <td style="text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: rgba(15,50,96,0.06); font-size: 11px; font-weight: 600;">${g.batch || 'Batch 1'}</span></td>
            </tr>
        `;
    }).join('');
}

// ── Batch Filter Population & Filtering (Source 1) ─────────────────
function populateSuperAdminBatchFilter() {
    const sel = document.getElementById('filter-superadmin-batch');
    if (!sel) return;

    const uniqueBatches = new Set();
    rawSuperAdminGrantees.forEach(g => {
        if (g.batch && g.batch.trim().length > 0) {
            uniqueBatches.add(g.batch.trim());
        }
    });

    if (uniqueBatches.size === 0) {
        uniqueBatches.add('Batch 1');
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
        const batch = (g.batch || 'Batch 1').trim();

        const matchQuery = !q || name.includes(q) || id.includes(q) || course.includes(q);
        const matchBatch = batchSel === 'All Batches' || batch.toLowerCase() === batchSel.toLowerCase();

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
        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 32px; color: var(--text-secondary);">No school student records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map((s) => {
        const family = s.familyDetails || {};
        const uid = s.uid || s.studentNo || s.studentId || s.student_id || s.id || Math.random().toString(36).substring(2);
        const isChecked = selectedSchoolStudentIds.has(uid) ? 'checked' : '';

        // 1. Student No.
        const studentNo = s.studentNo || s.studentId || s.student_id || 'N/A';

        // 2. Full Name
        let fullName = s.fullName || '';
        if (!fullName) {
            if (s.last_name || s.first_name) {
                fullName = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(', ');
            } else if (s.name) {
                fullName = s.name;
            } else {
                fullName = 'N/A';
            }
        }

        // 3. Program Name
        const programName = s.programName || s.program || s.course || 'N/A';

        // 4. Year Level
        const yearLevel = s.yearLevel || s.year || 'N/A';

        // 5. Date of Birth
        const rawDob = s.dateOfBirth || s.birthdate || s.birthday || s.dob || '';
        const dob = rawDob ? (parseAndFormatDate(rawDob) || rawDob) : 'N/A';

        // 6. Age
        let age = s.age;
        if (!age || age === 'N/A' || isNaN(age)) {
            age = calculateAge(dob !== 'N/A' ? dob : rawDob);
        }

        // 7. Gender
        const gender = (s.gender || s.sex || '').trim() || 'N/A';

        // 8. Civil Status
        const civilStatus = (s.civilStatus || s.maritalStatus || family.civilStatus || '').trim() || 'Single';

        // 9. Religion
        const religion = (s.religion || family.religion || '').trim() || 'N/A';

        // 10. Mobile Number
        const mobileNumber = (s.mobileNumber || s.contactNumber || s.phone || '').trim() || 'N/A';

        // 11. Email Address
        const emailAddress = (s.emailAddress || s.email || s.authEmail || '').trim() || 'N/A';

        // 12. Father's Full Name
        const fatherFullName = (s.fatherFullName || s.fatherName || family.fatherFullName || family.fatherName || '').trim() || 'N/A';

        // 13. Father's Occupation
        const fatherOccupation = (s.fatherOccupation || s.fatherEduStatus || family.fatherOccupation || family.fatherEduStatus || '').trim() || 'N/A';

        // 14. Mother's Full Name
        const motherFullName = (s.motherFullName || s.motherName || family.motherFullName || family.motherName || '').trim() || 'N/A';

        // 15. Mother's Occupation
        const motherOccupation = (s.motherOccupation || s.motherEduStatus || family.motherOccupation || family.motherEduStatus || '').trim() || 'N/A';

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
            const studentNo = (s.studentNo || s.studentId || s.student_id || '').toLowerCase();
            const name = (s.fullName || `${s.last_name || ''} ${s.first_name || ''}`).toLowerCase();
            const prog = (s.programName || s.program || s.course || '').toLowerCase();
            const email = (s.emailAddress || s.email || '').toLowerCase();
            const father = (s.fatherFullName || s.fatherName || family.fatherFullName || family.fatherName || '').toLowerCase();
            const mother = (s.motherFullName || s.motherName || family.motherFullName || family.motherName || '').toLowerCase();
            const religion = (s.religion || family.religion || '').toLowerCase();
            const dob = (s.dateOfBirth || s.birthdate || '').toLowerCase();
            return studentNo.includes(q) || name.includes(q) || prog.includes(q) || email.includes(q) || father.includes(q) || mother.includes(q) || religion.includes(q) || dob.includes(q);
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
        if (e.dataTransfer.files.length > 0) {
            handleSchoolFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSchoolFile(e.target.files[0]);
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

        // Revert to database students
        const { data: dbStudents } = await supabase.from('students').select('*');
        rawSchoolStudents = dbStudents || [];
        updateSourceCounts();
        renderSchoolStudentsTable(rawSchoolStudents);
        runCrossVerification();
        showToast('Reverted to default school database records.', 'info');
    });
}

async function handleSchoolFile(file) {
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

    try {
        const parsedStudents = await parseSchoolExcelOrCsv(file);

        if (parsedStudents.length > 0) {
            rawSchoolStudents = parsedStudents;
            updateSourceCounts();
            renderSchoolStudentsTable(rawSchoolStudents);
            runCrossVerification();
            showToast(`Loaded ${parsedStudents.length} school student records from ${file.name}!`, 'check-circle');
        } else {
            alert('Could not extract student records from the file. Make sure it has student names and IDs.');
        }
    } catch (err) {
        console.error('File parsing error:', err);
        alert('Error parsing school student file: ' + err.message);
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
                            else if (col.includes('student no') || col.includes('student id') || col.includes('student number') || col.includes('id number') || col.includes('control no') || col === 'id' || col === 'student_no' || col === 'student_id') {
                                colMap.studentNo = idx;
                            }
                            // 4. Student Name (strictly non-parent)
                            else if (col.includes('full name') || col.includes('student name') || col === 'name' || col === 'student' || col === 'student_name') {
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
function runCrossVerification() {
    const result = VerificationService.runBatchVerification(rawSuperAdminGrantees, rawSchoolStudents);

    verifiedForm2List = result.form2List;
    verifiedForm3List = result.form3List;
    needsReviewList = result.needsReviewList;

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
    if (statF2Amt) statF2Amt.textContent = `₱${f2TotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} Total Billing`;
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
        const grantee = item.grantee;
        const student = item.matchedStudent || {};
        const name = VerificationService.normalizeName(student.fullName || grantee.name);
        const sa = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || 'N/A';
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
        const email = student.email || student.authEmail || 'N/A';
        const phone = student.contactNumber || student.phone || 'N/A';

        return `
            <tr>
                <td style="font-weight: 700; color: var(--primary-color);">${ctrl}</td>
                <td><span style="font-weight: 600;">${student.studentId || grantee.student_id || 'N/A'}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(15,50,96,0.06); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${student.course || grantee.course || 'BSIT'}</td>
                <td style="text-align: center;">${year}</td>
                <td><span style="font-size: 11px; color: var(--text-secondary);">${email}</span></td>
                <td><span style="font-size: 11px;">${phone}</span></td>
                <td style="text-align: center;">${grantee.batch || '1'}</td>
                <td style="font-weight: 600; color: #2E7D32;">₱10,000.00</td>
                <td style="text-align: center; color: var(--text-secondary);">₱0.00</td>
                <td style="font-weight: 700; color: #2E7D32;">₱10,000.00</td>
            </tr>
        `;
    }).join('');
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
        const grantee = item.grantee;
        const student = item.matchedStudent || {};
        const name = VerificationService.normalizeName(student.fullName || grantee.name);
        const sa = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || 'N/A';
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
        const reason = item.specialStatusReason || 'Not enrolled';
        const remarks = item.remarks || (reason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${reason}`);

        let badgeStyle = 'background: rgba(255,152,0,0.12); color: #E65100;';
        if (reason === 'Dropped' || reason === 'Waived') badgeStyle = 'background: rgba(244,67,54,0.12); color: #D32F2F;';
        if (reason === 'Graduated') badgeStyle = 'background: rgba(76,175,80,0.12); color: #2E7D32;';

        return `
            <tr>
                <td style="font-weight: 700; color: #E65100;">${ctrl}</td>
                <td><span style="font-weight: 600;">${student.studentId || grantee.student_id || 'N/A'}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(255,143,0,0.08); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${student.course || grantee.course || 'BSIT'}</td>
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

        const granteeName = grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''}`;
        const studentName = student ? (student.fullName || student.name) : 'No Matching Record in School File';

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
                                ID: <strong>${grantee.student_id || 'Unassigned'}</strong> • Program: <strong>${grantee.course || 'N/A'}</strong> • Batch: <strong>${grantee.batch || '1'}</strong>
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: rgba(229,57,53,0.1); color: #D32F2F;">
                            Match Confidence: ${confidence}%
                        </span>
                    </div>
                </div>

                <!-- Comparison Row -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: rgba(0,0,0,0.02); padding: 12px 16px; border-radius: 10px; font-size: 12px;">
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">Super Admin Grantee List:</span>
                        <div>Name: <strong>${granteeName}</strong></div>
                        <div>Program: <strong>${grantee.course || 'N/A'}</strong></div>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary); font-weight: 600; display: block; margin-bottom: 2px;">School Student Masterlist:</span>
                        <div>Name: <strong>${studentName}</strong></div>
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
}

// ── 9. Review Resolution Actions ────────────────────────────────────
function resolveReviewItem(reviewIndex, targetForm, specialReason = 'Not enrolled', remarks = '') {
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    needsReviewList.splice(reviewIndex, 1);

    if (targetForm === 'form2') {
        item.classification = 'MATCHED_FORM2';
        item.isEnrolled = true;
        verifiedForm2List.push(item);
        showToast(`Approved ${item.grantee.name || 'Grantee'} to Form 2 (Enrolled)`, 'check-circle');
    } else {
        item.classification = 'INACTIVE_FORM3';
        item.isEnrolled = false;
        item.specialStatusReason = specialReason;
        item.remarks = remarks || `Categorized: ${specialReason}`;
        verifiedForm3List.push(item);
        showToast(`Categorized ${item.grantee.name || 'Grantee'} to Form 3 (${specialReason})`, 'tag');
    }

    updateKPIMetrics();
    renderForm2Table(verifiedForm2List);
    renderForm3Table(verifiedForm3List);
    renderReviewQueue(needsReviewList);
}

// ── 10. Resolution Modal Handlers ───────────────────────────────────
const resModal = document.getElementById('resolution-modal');
const btnCloseRes = document.getElementById('btn-close-resolution');
const btnCancelRes = document.getElementById('btn-cancel-resolution');
const btnConfirmRes = document.getElementById('btn-confirm-resolution');
const modalGranteeName = document.getElementById('modal-grantee-name');
const modalTargetForm = document.getElementById('modal-target-form');
const modalForm3ReasonGroup = document.getElementById('modal-form3-reason-group');
const modalForm3Reason = document.getElementById('modal-form3-reason');
const modalRemarks = document.getElementById('modal-remarks');

function openResolutionModal(reviewIndex) {
    activeResolutionItem = reviewIndex;
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    if (modalGranteeName) modalGranteeName.textContent = item.grantee.name || 'Scholar Grantee';
    if (modalTargetForm) modalTargetForm.value = 'form3';
    if (modalForm3ReasonGroup) modalForm3ReasonGroup.style.display = 'block';
    if (modalForm3Reason) modalForm3Reason.value = item.specialStatusReason || 'Not enrolled';
    if (modalRemarks) modalRemarks.value = '';

    if (resModal) resModal.style.display = 'flex';
}

function closeResolutionModal() {
    activeResolutionItem = null;
    if (resModal) resModal.style.display = 'none';
}

if (btnCloseRes) btnCloseRes.addEventListener('click', closeResolutionModal);
if (btnCancelRes) btnCancelRes.addEventListener('click', closeResolutionModal);

if (modalTargetForm) {
    modalTargetForm.addEventListener('change', (e) => {
        if (modalForm3ReasonGroup) {
            modalForm3ReasonGroup.style.display = e.target.value === 'form3' ? 'block' : 'none';
        }
    });
}

if (btnConfirmRes) {
    btnConfirmRes.addEventListener('click', () => {
        if (activeResolutionItem === null) return;
        const targetForm = modalTargetForm ? modalTargetForm.value : 'form3';
        const reason = modalForm3Reason ? modalForm3Reason.value : 'Not enrolled';
        const remarks = modalRemarks ? modalRemarks.value.trim() : '';

        resolveReviewItem(activeResolutionItem, targetForm, reason, remarks);
        closeResolutionModal();
    });
}

// Auto Resolve All to Form 3
const btnAutoResolveAll = document.getElementById('btn-auto-resolve-all');
if (btnAutoResolveAll) {
    btnAutoResolveAll.addEventListener('click', () => {
        if (needsReviewList.length === 0) return;
        const count = needsReviewList.length;
        while (needsReviewList.length > 0) {
            resolveReviewItem(0, 'form3', 'Not enrolled', 'Batch categorized to Form 3 by Admin');
        }
        showToast(`Auto-categorized ${count} records to Form 3`, 'check-circle');
    });
}

// ── 11. Tab Switching Navigation ────────────────────────────────────
const tabBtn2 = document.getElementById('tab-btn-form2');
const tabBtn3 = document.getElementById('tab-btn-form3');
const tabBtnRev = document.getElementById('tab-btn-review');

const tabPane2 = document.getElementById('tab-pane-form2');
const tabPane3 = document.getElementById('tab-pane-form3');
const tabPaneRev = document.getElementById('tab-pane-review');

function activateTab(activeBtn, activePane) {
    [tabBtn2, tabBtn3, tabBtnRev].forEach(b => b && b.classList.remove('active'));
    [tabPane2, tabPane3, tabPaneRev].forEach(p => p && (p.style.display = 'none'));

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.style.display = 'block';
}

if (tabBtn2) tabBtn2.addEventListener('click', () => activateTab(tabBtn2, tabPane2));
if (tabBtn3) tabBtn3.addEventListener('click', () => activateTab(tabBtn3, tabPane3));
if (tabBtnRev) tabBtnRev.addEventListener('click', () => activateTab(tabBtnRev, tabPaneRev));

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

const btnClearForm3 = document.getElementById('btn-clear-form3-data');
if (btnClearForm3) {
    btnClearForm3.addEventListener('click', () => {
        if (verifiedForm3List.length === 0) {
            showToast('Form 3 table is already empty.', 'info');
            return;
        }
        if (confirm('Are you sure you want to remove all records from the Annex Form 3 table?')) {
            verifiedForm3List = [];
            updateKPIMetrics();
            renderForm3Table(verifiedForm3List);
            showToast('Annex Form 3 table data removed.', 'check-circle');
        }
    });
}

// ── 13. Auto-Fill Excel Exports ─────────────────────────────────────
async function exportForm2Excel() {
    const btn = document.getElementById('btn-export-form2-top');
    try {
        if (btn) btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';

        const resp = await fetch('/assets/Annex 5-TES New Form 2.xlsx');
        if (!resp.ok) throw new Error('Could not load Annex 5 Form 2 template');
        const blob = await resp.blob();

        const studentsToFill = verifiedForm2List.map(item => item.matchedStudent || item.grantee);
        const result = await BillingService.fillAnnex5Form2(blob, studentsToFill);
        saveAs(result.blob, `AutoFilled_Annex_5_TES_Form_2_${Date.now()}.xlsx`);
        showToast('Annex 5 Form 2 Excel generated successfully!', 'check-circle');
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

        const studentsToFill = verifiedForm3List.map(item => ({
            ...(item.matchedStudent || item.grantee),
            status: item.specialStatusReason || 'Not enrolled',
            remarks: item.remarks || `Categorized: ${item.specialStatusReason || 'Not enrolled'}`
        }));

        const result = await BillingService.fillAnnex5Form3(blob, studentsToFill);
        saveAs(result.blob, `AutoFilled_Annex_5_TES_Form_3_${Date.now()}.xlsx`);
        showToast('Annex 5 Form 3 Excel generated successfully!', 'check-circle');
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
            runCrossVerification();
            btnRunMatch.innerHTML = '<i class="icon-refresh-cw" style="font-size: 16px;"></i> Run Automated Cross-Verification';
            btnRunMatch.disabled = false;
            showToast('Cross-Verification completed! Forms updated.', 'check-circle');
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

// Initial Load
loadInitialData();
