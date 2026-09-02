// js/views/annex5_generator.js
import { BillingService } from '../services/billing_service.js';
import { VerificationService } from '../services/verification_service.js';

const supabase = window.supabaseClient;

// State
let rawSuperAdminGrantees = [];
let rawSchoolStudents = [];
let uploadedSchoolFile = null;

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
        renderSuperAdminGranteesTable(rawSuperAdminGrantees);
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

// Search filter for Super Admin Grantees Table
const searchSAGrantees = document.getElementById('search-superadmin-grantees');
if (searchSAGrantees) {
    searchSAGrantees.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = rawSuperAdminGrantees.filter(g => {
            const name = (g.name || `${g.last_name || ''} ${g.first_name || ''}`).toLowerCase();
            const id = (g.student_id || g.studentId || '').toLowerCase();
            const course = (g.course || '').toLowerCase();
            const batch = (g.batch || '').toLowerCase();
            return !q || name.includes(q) || id.includes(q) || course.includes(q) || batch.includes(q);
        });
        renderSuperAdminGranteesTable(filtered);
    });
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
        runCrossVerification();
        showToast('Reverted to default school database records.', 'info');
    });
}

async function handleSchoolFile(file) {
    uploadedSchoolFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (uploadPrompt) uploadPrompt.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'flex';

    try {
        const ext = file.name.split('.').pop().toLowerCase();
        let parsedStudents = [];

        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            parsedStudents = await parseSchoolExcelOrCsv(file);
        } else if (ext === 'pdf') {
            parsedStudents = await parseSchoolPdf(file);
        } else if (ext === 'docx' || ext === 'doc') {
            parsedStudents = await parseSchoolDocx(file);
        }

        if (parsedStudents.length > 0) {
            rawSchoolStudents = parsedStudents;
            updateSourceCounts();
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
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                const students = [];
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    const rowStr = row.join(' ').toLowerCase();
                    if (rowStr.includes('control no') || rowStr.includes('student no') || (rowStr.includes('last name') && rowStr.includes('first name'))) {
                        continue; // Skip header
                    }

                    const cleanCells = row.map(c => String(c || '').trim()).filter(c => c.length > 0);
                    if (cleanCells.length === 0) continue;

                    let studentId = '';
                    let fullName = '';
                    let course = 'BSIT';
                    let year = '1';
                    let status = 'Enrolled';

                    // Extract fields heuristically
                    cleanCells.forEach(cell => {
                        if (/^\d{6,15}$/.test(cell) || /^\d{4}-\d{4,6}$/.test(cell)) {
                            studentId = cell;
                        } else if (cell.toLowerCase().includes('enrolled') || cell.toLowerCase().includes('active') || cell.toLowerCase().includes('drop') || cell.toLowerCase().includes('loa') || cell.toLowerCase().includes('graduat') || cell.toLowerCase().includes('waiv')) {
                            status = cell;
                        } else if (cell.toUpperCase().startsWith('BS') || cell.toLowerCase().includes('bachelor') || cell.toLowerCase().includes('tech')) {
                            course = cell;
                        } else if (/^[1-5]$/.test(cell) || cell.toLowerCase().includes('year')) {
                            year = cell.replace(/[^0-9]/g, '') || '1';
                        } else if (cell.includes(' ') && cell.length > 4 && !fullName) {
                            fullName = cell;
                        }
                    });

                    if (!fullName && cleanCells.length >= 2) {
                        fullName = cleanCells.slice(0, 2).join(' ');
                    }

                    if (fullName) {
                        students.push({
                            fullName,
                            studentId,
                            course,
                            year,
                            status,
                            enrollmentStatus: status
                        });
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
