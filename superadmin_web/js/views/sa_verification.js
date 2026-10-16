// js/views/sa_verification.js
import { SmsNotificationService } from '../services/sms_notification_service.js';
const supabase = window.supabaseClient;

let saStudents = [];
let filteredSaStudents = [];
let selectedIndex = 0;
let isUpdating = false;

// ── Load Data ───────────────────────────────────────────────────────
async function loadSaQueue() {
    const refreshBtn = document.getElementById('sa-refresh-btn');
    if (refreshBtn) {
        refreshBtn.innerHTML = `<i class="icon-refresh-cw" style="font-size: 14px; animation: spin 0.8s linear infinite;"></i> <span>Syncing...</span>`;
    }

    try {
        let res = await supabase
            .from('student_grantees')
            .select('*')
            .order('created_at', { ascending: false });

        if (res.error) {
            res = await supabase.from('student_grantees').select('*').order('createdAt', { ascending: false });
        }
        if (res.error) {
            res = await supabase.from('student_grantees').select('*');
        }
        if (res.error) throw res.error;
        const data = res.data;

        // Filter students who have submitted SA number
        saStudents = (data || []).filter(s => {
            const sa = s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber;
            return sa && sa.toString().trim() !== '' && sa.toString().trim() !== 'N/A';
        });

        // Compute duplicate mapping across the whole pool
        computeDuplicateMap();

        // Update KPI summary cards
        updateKpis();

        // Populate dynamic batch filter options
        populateSaBatchFilter();

        // Apply filters
        filterSaQueue();

    } catch (e) {
        console.error('Error loading SA queue:', e);
        const container = document.getElementById('sa-list-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--error);">
                    <i class="icon-alert-triangle" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
                    <div style="font-weight: 700; font-size: 14px;">Error Loading Verification Queue</div>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${e.message || 'Could not connect to database.'}</p>
                    <button class="btn" style="margin-top: 14px; background: var(--primary-color); color: white; padding: 6px 16px; border-radius: 8px; font-size: 12px;" onclick="loadSaQueue()">Retry</button>
                </div>
            `;
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.innerHTML = `<i class="icon-refresh-cw" style="font-size: 14px; color: var(--primary-color);"></i> <span>Refresh Queue</span>`;
        }
    }
}

// ── Duplicate SA Hash Mapping ─────────────────────────────────────────
const duplicateSaMap = new Map(); // saNumber -> Array of students

function computeDuplicateMap() {
    duplicateSaMap.clear();
    saStudents.forEach(s => {
        const sa = (s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber || '').toString().trim();
        if (sa) {
            if (!duplicateSaMap.has(sa)) {
                duplicateSaMap.set(sa, []);
            }
            duplicateSaMap.get(sa).push(s);
        }
    });
}

function isStudentDuplicate(student) {
    const sa = (student.saNumber || student.sa_number || student.documents?.saNumber || student.documents?.sa_number || student.familyDetails?.saNumber || '').toString().trim();
    if (!sa) return false;
    const list = duplicateSaMap.get(sa);
    return list && list.length > 1;
}

function getDuplicateConflicts(student) {
    const sa = (student.saNumber || student.sa_number || student.documents?.saNumber || student.documents?.sa_number || student.familyDetails?.saNumber || '').toString().trim();
    if (!sa) return [];
    const list = duplicateSaMap.get(sa) || [];
    return list.filter(s => s.uid !== student.uid && s.id !== student.id);
}

// ── Update KPI Summary Cards ─────────────────────────────────────────
function updateKpis() {
    const total = saStudents.length;
    let pending = 0;
    let verified = 0;
    let missing = 0;
    let duplicates = 0;

    saStudents.forEach(s => {
        const status = s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || s.status || 'Pending';
        if (status === 'Verified' || status === 'Approved') {
            verified++;
        } else if (status === 'Missing') {
            missing++;
        } else {
            pending++;
        }

        if (isStudentDuplicate(s)) {
            duplicates++;
        }
    });

    const setKpi = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setKpi('kpi-sa-total', total);
    setKpi('kpi-sa-pending', pending);
    setKpi('kpi-sa-verified', verified);
    setKpi('kpi-sa-missing', missing);
    setKpi('kpi-sa-duplicates', duplicates);
}

// ── Dynamic Batch Filter ─────────────────────────────────────────────
function populateSaBatchFilter() {
    const filterBatchEl = document.getElementById('sa-filter-batch');
    if (!filterBatchEl) return;

    const currentVal = filterBatchEl.value || 'All';
    const batchSet = new Set();

    saStudents.forEach(s => {
        const raw = s.batch || s.tes_batch || s.batch_name;
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            let b = String(raw).trim();
            if (b === '1' || b.toLowerCase() === 'batch 1') {
                b = 'Batch 1.1';
            } else if (!b.toLowerCase().startsWith('batch')) {
                b = `Batch ${b}`;
            }
            batchSet.add(b);
        }
    });

    ['Batch 1.1', 'Batch 1.2', 'Batch 1.3', 'Batch 1.4', 'Batch 1.5', 'Batch 2.1', 'Batch 2.2', 'Batch 2.3', 'Batch 3.1', 'Batch 3.2'].forEach(b => batchSet.add(b));

    const sortedBatches = Array.from(batchSet).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    let optionsHtml = '<option value="All">All Batches</option>';
    sortedBatches.forEach(b => {
        optionsHtml += `<option value="${b}">${b}</option>`;
    });

    filterBatchEl.innerHTML = optionsHtml;
    if (sortedBatches.includes(currentVal) || currentVal === 'All') {
        filterBatchEl.value = currentVal;
    }
}

// ── Search & Filter Logic ────────────────────────────────────────────
function filterSaQueue() {
    const searchInput = document.getElementById('sa-search-input');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const batchFilter = document.getElementById('sa-filter-batch')?.value || 'All';
    const statusFilter = document.getElementById('sa-filter-status')?.value || 'All';
    const courseFilter = document.getElementById('sa-filter-course')?.value || 'All';
    const sortBy = document.getElementById('sa-sort-by')?.value || 'latest';

    filteredSaStudents = saStudents.filter(s => {
        const name = (s.fullName || s.full_name || '').toLowerCase();
        const studentId = (s.studentId || s.student_no || s.id || '').toLowerCase();
        const sa = (s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber || '').toString().toLowerCase();
        const course = (s.course || s.program_name || '').toUpperCase();
        const status = s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || 'Pending';
        const isDup = isStudentDuplicate(s);

        // Search Match
        const matchQuery = !query || name.includes(query) || studentId.includes(query) || sa.includes(query) || course.toLowerCase().includes(query);

        // Batch Match
        let matchBatch = batchFilter === 'All';
        if (!matchBatch) {
            let studentBatch = String(s.batch || s.tes_batch || s.batch_name || '').trim();
            if (studentBatch === '1' || studentBatch.toLowerCase() === 'batch 1') {
                studentBatch = 'Batch 1.1';
            } else if (studentBatch && !studentBatch.toLowerCase().startsWith('batch')) {
                studentBatch = `Batch ${studentBatch}`;
            }
            const selectedBatch = batchFilter.trim();
            const sNorm = studentBatch.toLowerCase().replace(/^batch\s*/i, '');
            const selNorm = selectedBatch.toLowerCase().replace(/^batch\s*/i, '');
            matchBatch = studentBatch.toLowerCase() === selectedBatch.toLowerCase() || sNorm === selNorm;
        }

        // Status Match
        let matchStatus = true;
        if (statusFilter === 'Pending') {
            matchStatus = status === 'Pending' || (!s.documents?.saVerificationStatus && !s.documents?.sa_verification_status);
        } else if (statusFilter === 'Verified') {
            matchStatus = status === 'Verified' || status === 'Approved';
        } else if (statusFilter === 'Missing') {
            matchStatus = status === 'Missing';
        } else if (statusFilter === 'Rejected') {
            matchStatus = status === 'Rejected';
        } else if (statusFilter === 'Duplicate') {
            matchStatus = isDup;
        }

        // Course Match
        let matchCourse = true;
        if (courseFilter !== 'All') {
            matchCourse = course.includes(courseFilter.toUpperCase());
        }

        return matchQuery && matchBatch && matchStatus && matchCourse;
    });

    // Sorting
    filteredSaStudents.sort((a, b) => {
        if (sortBy === 'name_asc') {
            return (a.fullName || a.full_name || '').localeCompare(b.fullName || b.full_name || '');
        } else if (sortBy === 'name_desc') {
            return (b.fullName || b.full_name || '').localeCompare(a.fullName || a.full_name || '');
        } else if (sortBy === 'sa_num') {
            const saA = (a.saNumber || a.sa_number || a.documents?.saNumber || a.documents?.sa_number || a.familyDetails?.saNumber || '').toString();
            const saB = (b.saNumber || b.sa_number || b.documents?.saNumber || b.documents?.sa_number || b.familyDetails?.saNumber || '').toString();
            return saA.localeCompare(saB);
        } else {
            // Latest First by createdAt or updatedAt
            const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
            return dateB - dateA;
        }
    });

    // Update Counts UI
    const matchedCountEl = document.getElementById('sa-matched-count');
    const totalCountEl = document.getElementById('sa-total-count');
    const queuePillEl = document.getElementById('sa-queue-count-pill');
    if (matchedCountEl) matchedCountEl.textContent = filteredSaStudents.length;
    if (totalCountEl) totalCountEl.textContent = saStudents.length;
    if (queuePillEl) queuePillEl.textContent = filteredSaStudents.length;

    if (selectedIndex >= filteredSaStudents.length) {
        selectedIndex = Math.max(0, filteredSaStudents.length - 1);
    }

    renderQueue();
    renderPanel();
}

// ── Render Queue (Left) ─────────────────────────────────────────────
function renderQueue() {
    const container = document.getElementById('sa-list-container');
    if (!container) return;

    if (filteredSaStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-secondary);">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(15, 50, 96, 0.05); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                    <i class="icon-user-x" style="font-size: 24px; color: var(--text-secondary);"></i>
                </div>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No Applicants Found</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Try clearing or changing your search filters.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredSaStudents.map((s, index) => {
        const isSelected = index === selectedIndex;
        const name = s.fullName || s.full_name || 'Unnamed Student';
        const studentId = s.studentId || s.student_no || s.id || 'N/A';
        const course = s.course || s.program_name || 'N/A';
        const sa = s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber || 'N/A';
        const photo = s.profilePictureUrl || s.profile_picture_url || s.profileImageUrl || s.photoUrl || s.photoURL;
        const status = s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || 'Pending';
        const isDup = isStudentDuplicate(s);

        // Status Badge Chip
        let statusBadgeHtml = '';
        if (isDup) {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(239, 68, 68, 0.12); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="icon-alert-triangle" style="font-size: 10px;"></i> DUPLICATE
                </span>
            `;
        } else if (status === 'Verified' || status === 'Approved') {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="icon-check" style="font-size: 10px;"></i> VERIFIED
                </span>
            `;
        } else if (status === 'Missing') {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(249, 115, 22, 0.12); color: #F97316; border: 1px solid rgba(249, 115, 22, 0.3); font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="icon-alert-circle" style="font-size: 10px;"></i> MISSING
                </span>
            `;
        } else if (status === 'Rejected') {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(107, 114, 128, 0.12); color: #6B7280; border: 1px solid rgba(107, 114, 128, 0.3); font-size: 9px; font-weight: 800;">
                    REJECTED
                </span>
            `;
        } else {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(245, 158, 11, 0.12); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="icon-clock" style="font-size: 10px;"></i> PENDING
                </span>
            `;
        }

        // Avatar
        let avatarHtml = '';
        if (photo) {
            avatarHtml = `
                <div style="padding: 2px; border-radius: 50%; border: 1.5px solid #FBC02D; box-shadow: 0 2px 6px rgba(0,0,0,0.08); display: flex; flex-shrink: 0;">
                    <img src="${photo}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                </div>
            `;
        } else {
            const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ST';
            avatarHtml = `
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, rgba(15, 50, 96, 0.1), rgba(212, 175, 55, 0.2)); border: 1.5px solid rgba(212, 175, 55, 0.4); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: var(--primary-color); flex-shrink: 0;">
                    ${initials}
                </div>
            `;
        }

        const rawBatch = s.batch || s.tes_batch || s.batch_name;
        let batchBadgeHtml = '';
        if (rawBatch) {
            let b = String(rawBatch).trim();
            if (b === '1' || b.toLowerCase() === 'batch 1') b = 'Batch 1.1';
            else if (!b.toLowerCase().startsWith('batch')) b = `Batch ${b}`;
            batchBadgeHtml = `<span style="font-size: 10px; color: #1E3A8A; font-weight: 700; background: rgba(30, 58, 138, 0.08); padding: 1px 6px; border-radius: 4px;">${b}</span>`;
        }

        return `
            <div class="sa-list-item ${isSelected ? 'selected' : ''}" 
                 style="padding: 14px 18px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--border-color); user-select: none;"
                 onclick="selectSaStudent(${index})">
                ${avatarHtml}
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
                        <div style="font-weight: 800; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                        ${statusBadgeHtml}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">ID: ${studentId}</span>
                        <span style="color: var(--border-color); font-size: 10px;">•</span>
                        <span style="font-size: 11px; color: var(--primary-color); font-weight: 700; font-family: monospace; background: rgba(15, 50, 96, 0.06); padding: 1px 6px; border-radius: 4px;">SA: ${sa}</span>
                        <span style="font-size: 10px; color: var(--text-secondary); background: rgba(0,0,0,0.04); padding: 1px 5px; border-radius: 4px;">${course}</span>
                        ${batchBadgeHtml}
                    </div>
                </div>
                <i class="icon-chevron-right" style="font-size: 16px; color: ${isSelected ? 'var(--primary-color)' : 'rgba(150,150,150,0.4)'}; flex-shrink: 0;"></i>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ── Render Panel (Right) ────────────────────────────────────────────
function renderPanel() {
    const container = document.getElementById('sa-panel-container');
    if (!container) return;

    if (filteredSaStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 24px; color: var(--text-secondary);">
                <i class="icon-user-x" style="font-size: 48px; color: rgba(15, 50, 96, 0.2); margin-bottom: 14px; display: block;"></i>
                <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">No Student Selected</h3>
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">Select an applicant from the list to review their SA Number details.</p>
            </div>
        `;
        return;
    }

    const s = filteredSaStudents[selectedIndex];
    if (!s) return;

    const name = s.fullName || s.full_name || 'Unnamed Student';
    const sa = (s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber || 'Not Submitted').toString();
    const studentId = s.studentId || s.student_no || s.id || 'N/A';
    const course = s.course || s.program_name || 'N/A';
    const year = s.year || s.year_level || 'N/A';
    const photo = s.profilePictureUrl || s.profile_picture_url || s.profileImageUrl || s.photoUrl || s.photoURL;
    const currentRemarks = s.adminRemarks || s.admin_remarks || '';
    const status = s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || 'Pending';

    // Queue Navigation Counts
    const currentPos = selectedIndex + 1;
    const totalPos = filteredSaStudents.length;

    // Avatar
    let avatarHtml = '';
    if (photo) {
        avatarHtml = `
            <div style="padding: 3px; border-radius: 50%; border: 2px solid #FBC02D; box-shadow: 0 4px 14px rgba(0,0,0,0.12); display: inline-flex;">
                <img src="${photo}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">
            </div>
        `;
    } else {
        const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ST';
        avatarHtml = `
            <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, rgba(15, 50, 96, 0.15), rgba(212, 175, 55, 0.25)); border: 2px solid #FBC02D; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: var(--primary-color);">
                ${initials}
            </div>
        `;
    }

    // Duplicate Check Banner
    const isDup = isStudentDuplicate(s);
    const conflicts = getDuplicateConflicts(s);

    let duplicateBannerHtml = '';
    if (isDup) {
        const conflictNames = conflicts.map(c => `${c.fullName || 'Student'} (${c.studentId || 'No ID'})`).join(', ');
        duplicateBannerHtml = `
            <div style="padding: 12px 14px; border-radius: 10px; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.35); margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px;">
                <i class="icon-alert-triangle" style="font-size: 18px; color: #EF4444; flex-shrink: 0; margin-top: 1px;"></i>
                <div style="flex: 1;">
                    <div style="font-size: 12px; font-weight: 800; color: #DC2626;">DUPLICATE SA CONFLICT DETECTED</div>
                    <div style="font-size: 11px; color: var(--text-primary); margin-top: 3px; line-height: 1.4;">
                        This exact SA number (<span style="font-family: monospace; font-weight: 700;">${sa}</span>) is also submitted by: <strong>${conflictNames || 'another student'}</strong>.
                    </div>
                </div>
            </div>
        `;
    } else {
        duplicateBannerHtml = `
            <div style="padding: 10px 14px; border-radius: 10px; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.25); margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                <i class="icon-shield-check" style="font-size: 18px; color: #10B981; flex-shrink: 0;"></i>
                <div style="flex: 1;">
                    <span style="font-size: 11px; font-weight: 800; color: #059669;">Security Hash Check: PASSED</span>
                    <span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">(Unique SA Number in registry)</span>
                </div>
            </div>
        `;
    }

    // ATM Card Proof Box
    let atmCardHtml = '';
    const atmCardUrl = s.atmCardUrl || s.atm_card_url || (s.documents && (s.documents.atmCardUrl || s.documents.atm_card_url || s.documents.atmProofUrl || s.documents.atm_proof_url));
    const atmCardFileName = s.atmCardFileName || s.atm_card_file_name || (s.documents && (s.documents.atmCardFileName || s.documents.atm_card_file_name)) || 'ATM_Proof_Document';
    const isAtmPdf = (atmCardFileName && atmCardFileName.toLowerCase().endsWith('.pdf')) || (atmCardUrl && atmCardUrl.toLowerCase().includes('.pdf'));

    if (atmCardUrl) {
        atmCardHtml = `
            <div style="margin-bottom: 16px; padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 50, 96, 0.02);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <i class="icon-credit-card" style="font-size: 14px; color: var(--primary-color);"></i> ATM Card Document Proof
                    </div>
                    <span style="font-size: 10px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 12px;">ATTACHED</span>
                </div>

                <div style="display: flex; gap: 14px; align-items: center; background: var(--surface-color); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
                    <div style="position: relative; width: 100px; height: 65px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: rgba(0,0,0,0.02); flex-shrink: 0; cursor: pointer;"
                         onclick="openSaLightbox('${atmCardUrl}', '${name} - ATM Card Proof')">
                        ${isAtmPdf ? `
                            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.08);">
                                <i class="icon-file-text" style="font-size: 24px; color: #EF4444;"></i>
                                <span style="font-size: 9px; font-weight: 800; color: #EF4444; margin-top: 2px;">PDF PROOF</span>
                            </div>
                        ` : `
                            <img src="${atmCardUrl}" alt="ATM Card" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        `}
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                            <i class="icon-zoom-in" style="color: white; font-size: 18px;"></i>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${atmCardFileName}">${atmCardFileName}</div>
                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Land Bank ATM Card Document</div>
                        
                        <div style="display: flex; gap: 8px; margin-top: 6px;">
                            <button onclick="openSaLightbox('${atmCardUrl}', '${name} - ATM Card Proof')" style="padding: 4px 10px; background: rgba(15, 50, 96, 0.08); border: 1px solid rgba(15, 50, 96, 0.15); border-radius: 6px; font-size: 11px; font-weight: 700; color: var(--primary-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-maximize-2" style="font-size: 11px;"></i> Lightbox
                            </button>
                            <a href="${atmCardUrl}" target="_blank" rel="noopener noreferrer" style="padding: 4px 10px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-external-link" style="font-size: 11px;"></i> Full Tab
                            </a>
                        </div>

                        <!-- Document AI ATM Proof Verification Badge -->
                        <div style="margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: ${(s.atmNameMatches === true && s.atmSaMatches === true) || (s.documents && s.documents.atmNameMatches === true && s.documents.atmSaMatches === true) ? 'rgba(16, 185, 129, 0.08)' : ((s.atmNameMatches === false || s.atmSaMatches === false) || (s.documents && (s.documents.atmNameMatches === false || s.documents.atmSaMatches === false)) ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 50, 96, 0.04)')}; border: 1px solid ${(s.atmNameMatches === true && s.atmSaMatches === true) || (s.documents && s.documents.atmNameMatches === true && s.documents.atmSaMatches === true) ? 'rgba(16, 185, 129, 0.25)' : ((s.atmNameMatches === false || s.atmSaMatches === false) || (s.documents && (s.documents.atmNameMatches === false || s.documents.atmSaMatches === false)) ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-color)')}; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 10px; font-weight: 800; color: ${(s.atmNameMatches === true && s.atmSaMatches === true) || (s.documents && s.documents.atmNameMatches === true && s.documents.atmSaMatches === true) ? '#10B981' : ((s.atmNameMatches === false || s.atmSaMatches === false) || (s.documents && (s.documents.atmNameMatches === false || s.documents.atmSaMatches === false)) ? '#EF4444' : 'var(--primary-color)')};">
                                    <i class="${(s.atmNameMatches === true && s.atmSaMatches === true) || (s.documents && s.documents.atmNameMatches === true && s.documents.atmSaMatches === true) ? 'icon-shield-check' : 'icon-credit-card'}" style="font-size: 11px;"></i>
                                    ${(s.atmNameMatches === true && s.atmSaMatches === true) || (s.documents && s.documents.atmNameMatches === true && s.documents.atmSaMatches === true) ? 'AI MATCH: NAME & SA CONFIRMED' : ((s.atmNameMatches === false || s.atmSaMatches === false) || (s.documents && (s.documents.atmNameMatches === false || s.documents.atmSaMatches === false)) ? 'AI MISMATCH DETECTED' : 'AI ATM VERIFICATION')}
                                </div>
                                <div style="font-size: 9.5px; color: var(--text-primary); font-weight: 600; margin-top: 1px;">
                                    Holder: ${s.atmExtractedName || (s.documents && s.documents.atmExtractedName) || name} • SA: ${s.atmExtractedSaNumber || (s.documents && s.documents.atmExtractedSaNumber) || (s.saNumber || s.sa_number || 'N/A')}
                                </div>
                            </div>
                            ${!isAtmPdf ? `
                                <button onclick="triggerAtmProofScan('${atmCardUrl}', ${selectedIndex})" title="Run Google Document AI ATM Proof Scan" style="padding: 3px 8px; background: white; border: 1px solid var(--border-color); border-radius: 4px; font-size: 10px; font-weight: 700; color: var(--primary-color); cursor: pointer;">
                                    AI Scan
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        atmCardHtml = `
            <div style="margin-bottom: 16px; padding: 14px; border: 1px dashed var(--border-color); border-radius: 12px; text-align: center; background: rgba(0,0,0,0.01);">
                <i class="icon-credit-card" style="font-size: 24px; color: var(--text-secondary); margin-bottom: 6px; display: block;"></i>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">No ATM Card Proof Uploaded</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Student provided Land Bank SA number without ATM card photo attachment.</div>
            </div>
        `;
    }

    // Deposit Slip Proof Box
    let depositSlipHtml = '';
    const depositSlipUrl = s.depositSlipUrl || s.deposit_slip_url || (s.documents && (s.documents.depositSlipUrl || s.documents.deposit_slip_url));
    const depositSlipFileName = s.depositSlipFileName || s.deposit_slip_file_name || (s.documents && (s.documents.depositSlipFileName || s.documents.deposit_slip_file_name)) || 'Deposit_Slip_Document';
    const isDepositPdf = (depositSlipFileName && depositSlipFileName.toLowerCase().endsWith('.pdf')) || (depositSlipUrl && depositSlipUrl.toLowerCase().includes('.pdf'));

    if (depositSlipUrl) {
        depositSlipHtml = `
            <div style="margin-bottom: 16px; padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 50, 96, 0.02);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        <i class="icon-file-text" style="font-size: 14px; color: var(--primary-color);"></i> Deposit Slip Document Proof
                    </div>
                    <span style="font-size: 10px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 12px;">ATTACHED</span>
                </div>

                <div style="display: flex; gap: 14px; align-items: center; background: var(--surface-color); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
                    <div style="position: relative; width: 100px; height: 65px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: rgba(0,0,0,0.02); flex-shrink: 0; cursor: pointer;"
                         onclick="openSaLightbox('${depositSlipUrl}', '${name} - Deposit Slip Proof')">
                        ${isDepositPdf ? `
                            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.08);">
                                <i class="icon-file-text" style="font-size: 24px; color: #EF4444;"></i>
                                <span style="font-size: 9px; font-weight: 800; color: #EF4444; margin-top: 2px;">PDF RECEIPT</span>
                            </div>
                        ` : `
                            <img src="${depositSlipUrl}" alt="Deposit Slip" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        `}
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                            <i class="icon-zoom-in" style="color: white; font-size: 18px;"></i>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${depositSlipFileName}">${depositSlipFileName}</div>
                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Bank Deposit Slip / Transaction Receipt</div>
                        
                        <div style="display: flex; gap: 8px; margin-top: 6px;">
                            <button onclick="openSaLightbox('${depositSlipUrl}', '${name} - Deposit Slip Proof')" style="padding: 4px 10px; background: rgba(15, 50, 96, 0.08); border: 1px solid rgba(15, 50, 96, 0.15); border-radius: 6px; font-size: 11px; font-weight: 700; color: var(--primary-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-maximize-2" style="font-size: 11px;"></i> Lightbox
                            </button>
                            <a href="${depositSlipUrl}" target="_blank" rel="noopener noreferrer" style="padding: 4px 10px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-external-link" style="font-size: 11px;"></i> Full Tab
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        depositSlipHtml = `
            <div style="margin-bottom: 16px; padding: 14px; border: 1px dashed var(--border-color); border-radius: 12px; text-align: center; background: rgba(0,0,0,0.01);">
                <i class="icon-file-text" style="font-size: 24px; color: var(--text-secondary); margin-bottom: 6px; display: block;"></i>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">No Deposit Slip Uploaded</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Student did not attach a bank deposit slip or transaction receipt.</div>
            </div>
        `;
    }

    container.innerHTML = `
        <!-- Sticky Navigation Bar -->
        <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); background: rgba(15, 50, 96, 0.03); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="icon-shield" style="font-size: 14px; color: var(--primary-color);"></i>
                <span style="font-size: 12px; font-weight: 800; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px;">Verification Station</span>
            </div>

            <!-- Previous / Next Navigator -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn" style="padding: 4px 8px; border-radius: 6px; background: var(--surface-color); border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: var(--text-primary); cursor: pointer;" 
                        onclick="navigateSaQueue(-1)" ${selectedIndex === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                    <i class="icon-chevron-left" style="font-size: 12px;"></i> Prev
                </button>
                <span style="font-size: 11px; font-weight: 800; color: var(--text-secondary);">${currentPos} / ${totalPos}</span>
                <button class="btn" style="padding: 4px 8px; border-radius: 6px; background: var(--surface-color); border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: var(--text-primary); cursor: pointer;" 
                        onclick="navigateSaQueue(1)" ${selectedIndex === totalPos - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                    Next <i class="icon-chevron-right" style="font-size: 12px;"></i>
                </button>
            </div>
        </div>

        <div style="padding: 20px; max-height: 720px; overflow-y: auto;">
            <!-- Student Header Dossier -->
            <div style="text-align: center; margin-bottom: 16px;">
                ${avatarHtml}
                <div style="margin-top: 10px; font-size: 17px; font-weight: 900; color: var(--text-primary); letter-spacing: -0.3px;">${name}</div>
                <div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;">
                    <span style="padding: 3px 10px; background: rgba(15, 50, 96, 0.08); border-radius: 20px; color: var(--primary-color); font-size: 11px; font-weight: 800;">
                        ID: ${studentId}
                    </span>
                    <span style="padding: 3px 10px; background: rgba(212, 175, 55, 0.15); border-radius: 20px; color: #B45309; font-size: 11px; font-weight: 800;">
                        ${course} - ${year}
                    </span>
                    ${(() => {
                        const raw = s.batch || s.tes_batch || s.batch_name;
                        if (!raw) return '';
                        let b = String(raw).trim();
                        if (b === '1' || b.toLowerCase() === 'batch 1') b = 'Batch 1.1';
                        else if (!b.toLowerCase().startsWith('batch')) b = `Batch ${b}`;
                        return `
                            <span style="padding: 3px 10px; background: rgba(30, 58, 138, 0.1); border-radius: 20px; color: #1E3A8A; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-layers" style="font-size: 11px;"></i> ${b}
                            </span>
                        `;
                    })()}
                </div>
            </div>

            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;">

            <!-- Land Bank SA Number Card -->
            <div style="padding: 14px; border-radius: 12px; background: linear-gradient(135deg, rgba(15, 50, 96, 0.04), rgba(212, 175, 55, 0.06)); border: 1px solid var(--border-color); margin-bottom: 14px;">
                <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Submitted Statement of Account (SA)</div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="font-family: monospace; font-size: 18px; font-weight: 900; color: var(--primary-color); letter-spacing: 1px;">${sa}</div>
                    <button id="copy-sa-btn" onclick="copySaNumber('${sa}')" style="padding: 6px 12px; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 8px; font-size: 11px; font-weight: 700; color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;">
                        <i class="icon-copy" style="font-size: 12px;"></i> <span id="copy-sa-text">Copy</span>
                    </button>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 600;">
                    <i class="icon-landmark" style="font-size: 12px; color: #10B981;"></i> Servicing Bank: <strong>Land Bank of the Philippines</strong>
                </div>
            </div>

            <!-- Duplicate Security Integrity Status -->
            ${duplicateBannerHtml}

            <!-- ATM Card & Deposit Slip Document Proof Previews -->
            ${atmCardHtml}
            ${depositSlipHtml}

            <!-- Download Student Documents Action Card -->
            <div style="margin-bottom: 16px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(135deg, rgba(15, 50, 96, 0.04), rgba(37, 99, 235, 0.05)); border: 1.5px solid rgba(15, 50, 96, 0.15);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-size: 12px; font-weight: 800; color: var(--primary-color); display: flex; align-items: center; gap: 6px;">
                        <i class="icon-download" style="font-size: 15px;"></i>
                        <span>Download Student Documents</span>
                    </div>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-secondary); background: rgba(0,0,0,0.04); padding: 2px 8px; border-radius: 10px;">ZIP & PDF</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <!-- Download ZIP button -->
                    <button id="btn-download-zip" class="btn" onclick="downloadSelectedStudentZip()"
                            style="background: linear-gradient(135deg, #0F3260, #1E3A8A); color: white; border: none; padding: 10px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; box-shadow: 0 4px 12px rgba(15, 50, 96, 0.2); transition: all 0.2s;"
                            title="Download all student document files compressed in a ZIP archive">
                        <i class="icon-file-archive" style="font-size: 15px; color: #FBC02D;"></i>
                        <span>Download ZIP</span>
                    </button>
                    <!-- Download PDF button -->
                    <button id="btn-download-pdf" class="btn" onclick="downloadSelectedStudentPdf()"
                            style="background: linear-gradient(135deg, #DC2626, #B91C1C); color: white; border: none; padding: 10px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2); transition: all 0.2s;"
                            title="Generate and download complete Land Bank SA Document Dossier in PDF format">
                        <i class="icon-file-text" style="font-size: 15px; color: #FFFFFF;"></i>
                        <span>Download PDF</span>
                    </button>
                </div>
            </div>

            <!-- Quick Remarks Preset Chips -->
            <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 800; color: var(--text-primary);">Admin Remarks & Feedback</span>
                <span style="font-size: 10px; color: var(--text-secondary); font-weight: 600;">Quick Presets:</span>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                <span class="sa-preset-chip" onclick="applySaPreset('SA Account and name match ATM card proof.')">✓ SA Matches Card</span>
                <span class="sa-preset-chip" onclick="applySaPreset('Submitted SA Number is blurred or unreadable. Please re-upload a clear copy.')">⚠ Blurred SA Image</span>
                <span class="sa-preset-chip" onclick="applySaPreset('SA format appears incorrect. Please provide the official 10-digit Land Bank account number.')">⚠ Format Error</span>
                <span class="sa-preset-chip" onclick="applySaPreset('Name on ATM proof does not match applicant record.')">✖ Name Mismatch</span>
            </div>

            <textarea id="sa-remarks" placeholder="Enter custom administrative notes or student resubmission instructions here..." 
                      style="width: 100%; height: 75px; padding: 12px 14px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--surface-color); color: var(--text-primary); font-family: inherit; font-size: 12px; font-weight: 500; resize: none; margin-bottom: 16px; outline: none; transition: border-color 0.2s;"
                      onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='var(--border-color)'">${currentRemarks}</textarea>

            <!-- Verification Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Mark Verified Button -->
                <button class="btn sa-action-btn" 
                        style="width: 100%; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 800;" 
                        onclick="updateSaStatus('Verified')">
                    <i class="icon-check-circle" style="font-size: 16px;"></i> Mark as Verified
                </button>

                <!-- Mark Missing Button -->
                <button class="btn btn-outline sa-action-btn" 
                        style="width: 100%; border: 1.5px solid #F97316; color: #EA580C; background: rgba(249, 115, 22, 0.05); padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 800;" 
                        onclick="updateSaStatus('Missing')">
                    <i class="icon-alert-circle" style="font-size: 15px;"></i> Request Resubmission (Missing)
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}

// ── Queue Navigation ────────────────────────────────────────────────
window.selectSaStudent = function (index) {
    selectedIndex = index;
    renderQueue();
    renderPanel();
};

window.navigateSaQueue = function (direction) {
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < filteredSaStudents.length) {
        selectSaStudent(nextIndex);
    }
};

window.applySaPreset = function (presetText) {
    const textarea = document.getElementById('sa-remarks');
    if (textarea) {
        textarea.value = presetText;
        textarea.focus();
    }
};

window.copySaNumber = function (saNum) {
    navigator.clipboard.writeText(saNum).then(() => {
        const textEl = document.getElementById('copy-sa-text');
        const btn = document.getElementById('copy-sa-btn');
        if (textEl) textEl.textContent = 'Copied!';
        if (btn) btn.style.background = 'rgba(16, 185, 129, 0.15)';
        setTimeout(() => {
            if (textEl) textEl.textContent = 'Copy';
            if (btn) btn.style.background = 'var(--surface-color)';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
    });
};

// ── Image Lightbox ──────────────────────────────────────────────────
window.openSaLightbox = function (url, caption = '') {
    const modal = document.getElementById('sa-lightbox-modal');
    const img = document.getElementById('sa-lightbox-img');
    const iframe = document.getElementById('sa-lightbox-frame');
    const cap = document.getElementById('sa-lightbox-caption');
    if (!modal) return;

    const isPdf = (url || '').toLowerCase().includes('.pdf');
    if (isPdf) {
        if (img) img.style.display = 'none';
        if (iframe) {
            iframe.style.display = 'block';
            iframe.src = url;
        }
    } else {
        if (iframe) {
            iframe.style.display = 'none';
            iframe.src = '';
        }
        if (img) {
            img.style.display = 'block';
            img.src = url;
        }
    }
    if (cap) cap.textContent = caption || (isPdf ? 'Document Proof PDF' : 'Document Proof Image');
    modal.style.display = 'flex';
};

window.closeSaLightbox = function () {
    const modal = document.getElementById('sa-lightbox-modal');
    const iframe = document.getElementById('sa-lightbox-frame');
    if (iframe) iframe.src = '';
    if (modal) modal.style.display = 'none';
};

// ── Update SA Status ────────────────────────────────────────────────
window.updateSaStatus = async function (newStatus, isFinalRejection = false) {
    if (isUpdating) return;
    const s = filteredSaStudents[selectedIndex];
    if (!s || !s.uid) return;

    const remarks = (document.getElementById('sa-remarks')?.value || '').trim();

    isUpdating = true;
    try {
        // 1. Update SA Verification Status (stored in both documents JSON and top-level column)
        const currentDocs = s.documents || {};
        const updatedDocs = {
            ...currentDocs,
            saVerificationStatus: newStatus,
            sa_verification_status: newStatus
        };

        const currentIdStatus = s.idValidationStatus || s.id_validation_status || currentDocs.idValidationStatus || currentDocs.id_validation_status || 'Pending';

        let calculatedStatus = 'Pending';
        if (newStatus === 'Verified') {
            if (currentIdStatus === 'Verified' || currentIdStatus === 'Approved') {
                calculatedStatus = 'Verified';
            } else if (currentIdStatus === 'Missing') {
                calculatedStatus = 'Missing Documents';
            } else if (currentIdStatus === 'Rejected') {
                calculatedStatus = 'Rejected';
            } else {
                calculatedStatus = 'Pending';
            }
        } else if (newStatus === 'Missing') {
            calculatedStatus = 'Missing Documents';
        } else if (newStatus === 'Rejected') {
            calculatedStatus = 'Rejected';
        }

        const needsResubmission = !isFinalRejection && (newStatus === 'Missing' || newStatus === 'Rejected');

        const updatePayload = {
            status: calculatedStatus,
            saVerificationStatus: newStatus,
            sa_verification_status: newStatus,
            documents: updatedDocs,
            adminRemarks: remarks,
            admin_remarks: remarks,
            requiresResubmission: needsResubmission,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let updateRes = await supabase.from('student_grantees').update(updatePayload).eq('uid', s.uid);
        if (updateRes.error) {
            console.warn('Initial update failed, trying fallback schema:', updateRes.error);
            const fallbackPayload = {
                status: calculatedStatus,
                admin_remarks: remarks,
                adminRemarks: remarks,
                requiresResubmission: needsResubmission,
                updated_at: new Date().toISOString()
            };
            if (s.documents !== undefined) fallbackPayload.documents = updatedDocs;
            updateRes = await supabase.from('student_grantees').update(fallbackPayload).eq('uid', s.uid);
            if (updateRes.error) throw updateRes.error;
        }

        // 2. Audit Log
        try {
            await supabase.from('audit_logs').insert([{
                adminId: (await supabase.auth.getUser()).data.user?.id || 'unknown',
                adminName: 'Admin',
                action: `Verified student SA Number: ${newStatus}`,
                targetUser: s.uid,
                timestamp: new Date().toISOString()
            }]);
        } catch (auditErr) {
            console.warn('Could not write audit log:', auditErr);
        }

        // 3. In-App Notification
        let title = '';
        let message = '';
        let type = 'info';

        if (newStatus === 'Verified') {
            title = 'SA Verification Approved';
            message = 'Your Land Bank SA Number has been verified and approved by the administrator.';
            type = 'success';
        } else if (newStatus === 'Missing') {
            title = 'SA Verification Missing Documents';
            message = remarks
                ? `Your submitted SA Number requires revision. Feedback: ${remarks}`
                : 'Your submitted SA Number requires revision. Please upload a clear copy of your Land Bank ATM card or deposit slip.';
            type = 'warning';
        } else {
            title = 'SA Verification Rejected';
            message = remarks
                ? `Your SA Number submission has been rejected. Feedback: ${remarks}`
                : 'Your SA Number submission has been rejected.';
            type = 'error';
        }

        try {
            await supabase.from('notifications').insert([{
                studentId: s.uid,
                title: title,
                message: message,
                type: type,
                isRead: false,
                timestamp: new Date().toISOString()
            }]);

            // Notify Admin of Super Admin verification update
            await supabase.from('notifications').insert([{
                studentId: 'admin',
                title: `SA Verification: ${newStatus}`,
                message: `Super Admin marked SA Number as ${newStatus} for ${s.fullName || s.full_name || 'student'}.`,
                type: newStatus === 'Verified' ? 'success' : 'warning',
                isRead: false,
                timestamp: new Date().toISOString()
            }]);
        } catch (notifErr) {
            console.warn('Could not send notification:', notifErr);
        }

        // 4. Mirror directly to SMS via Semaphore with identical content
        try {
            const phone = s.mobile_number || s.contactNumber || s.phone_number;
            if (phone) {
                const eventType = newStatus === 'Verified' ? 'sa_verified' : 'sa_revision';
                await SmsNotificationService.sendStudentSms(s.uid, {
                    eventType,
                    title: title,
                    message: message,
                    phone,
                    feedback: remarks,
                    fullName: s.fullName || s.full_name,
                    studentNo: s.studentId || s.student_no,
                    course: s.course || s.program_name
                });
            }
        } catch (smsErr) {
            console.warn('SA SMS notification trigger note:', smsErr);
        }

        if (window.showToast) {
            window.showToast(`Updated ${s.fullName || s.full_name || 'student'} to ${newStatus}.`, 'check-circle');
        } else {
            alert(`Student ${s.fullName || s.full_name} status updated to ${newStatus}.`);
        }

        // Reload SA Queue
        await loadSaQueue();

    } catch (e) {
        console.error('Error updating status:', e);
        alert('Failed to update student verification: ' + (e.message || e));
    } finally {
        isUpdating = false;
    }
};

// Google Document AI Scanner for ATM Proof Name & SA verification
window.triggerAtmProofScan = async function (imageUrl, studentIndex) {
    if (!imageUrl) return;
    const s = filteredSaStudents[studentIndex];
    if (!s) return;

    if (window.showToast) {
        window.showToast('Verifying ATM card holder name & SA number with Document AI...', 'refresh-cw');
    }

    try {
        const imgRes = await fetch(imageUrl);
        const blob = await imgRes.blob();
        const reader = new FileReader();

        reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            try {
                const apiRes = await fetch('/api/document-ai/scan-atm-proof', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: base64data,
                        expectedName: s.fullName || s.full_name || '',
                        expectedSaNumber: s.saNumber || s.sa_number || (s.documents && s.documents.saNumber) || ''
                    })
                });

                const data = await apiRes.json();
                if (data && data.success) {
                    s.atmNameMatches = data.nameMatches;
                    s.atmSaMatches = data.saMatches;
                    s.atmExtractedName = data.detectedName;
                    s.atmExtractedSaNumber = data.detectedSaNumber;
                    if (!s.documents) s.documents = {};
                    s.documents.atmNameMatches = data.nameMatches;
                    s.documents.atmSaMatches = data.saMatches;
                    s.documents.atmExtractedName = data.detectedName;
                    s.documents.atmExtractedSaNumber = data.detectedSaNumber;

                    const statusMsg = data.isValid
                        ? `✓ Verified: Name & SA match card details`
                        : `⚠️ Mismatch: ${data.message || 'Details do not match'}`;

                    if (window.showToast) {
                        window.showToast(statusMsg, data.isValid ? 'shield-check' : 'alert-triangle');
                    }
                    renderPanel();
                } else {
                    if (window.showToast) {
                        window.showToast(data.message || 'Could not extract details from ATM card.', 'alert-triangle');
                    }
                }
            } catch (err) {
                console.error('ATM scan error:', err);
                if (window.showToast) window.showToast('Document AI service error: ' + err.message, 'alert-circle');
            }
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.error('Image fetch error:', e);
        if (window.showToast) window.showToast('Error loading image for scan: ' + e.message, 'alert-circle');
    }
};

// ── Student Documents Download & Export Utilities ─────────────────────

function getStudentDocumentUrls(s) {
    if (!s) return [];
    const docs = s.documents || {};
    const items = [];

    // 1. ATM Card Proof
    const atmUrl = s.atmCardUrl || s.atm_card_url || docs.atmCardUrl || docs.atm_card_url || docs.atmProofUrl || docs.atm_proof_url;
    const atmName = s.atmCardFileName || s.atm_card_file_name || docs.atmCardFileName || docs.atm_card_file_name || 'ATM_Card_Proof';
    if (atmUrl) {
        items.push({ type: 'atm', label: 'ATM_Card_Proof', url: atmUrl, defaultName: atmName });
    }

    // 2. Deposit Slip Proof
    const depositUrl = s.depositSlipUrl || s.deposit_slip_url || docs.depositSlipUrl || docs.deposit_slip_url;
    const depositName = s.depositSlipFileName || s.deposit_slip_file_name || docs.depositSlipFileName || docs.deposit_slip_file_name || 'Deposit_Slip_Proof';
    if (depositUrl) {
        items.push({ type: 'deposit', label: 'Deposit_Slip_Proof', url: depositUrl, defaultName: depositName });
    }

    // 3. ID Front
    const frontUrl = s.idFrontUrl || s.id_front_url || docs.idFrontUrl || docs.id_front_url;
    if (frontUrl) {
        items.push({ type: 'id_front', label: 'ID_Card_Front', url: frontUrl, defaultName: 'ID_Front.jpg' });
    }

    // 4. ID Back
    const backUrl = s.idBackUrl || s.id_back_url || docs.idBackUrl || docs.id_back_url;
    if (backUrl) {
        items.push({ type: 'id_back', label: 'ID_Card_Back', url: backUrl, defaultName: 'ID_Back.jpg' });
    }

    // 5. Submission PDF (Application Dossier)
    const pdfUrl = s.submissionPdfUrl || s.submission_pdf_url || docs.submissionPdfUrl || docs.submission_pdf_url;
    const pdfName = s.submissionPdfName || docs.submissionPdfName || 'Application_Submission.pdf';
    if (pdfUrl) {
        items.push({ type: 'submission_pdf', label: 'Application_Submission', url: pdfUrl, defaultName: pdfName });
    }

    return items;
}

function formatStudentFilePrefix(student) {
    const name = (student.fullName || student.full_name || 'Student').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
    const id = (student.studentId || student.student_no || student.id || 'N-A').toString().replace(/[^a-zA-Z0-9_\-]/g, '');
    return `${id}_${name}`;
}

async function fetchMediaBlob(url) {
    try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.blob();
    } catch (e) {
        console.warn(`Direct fetch failed for ${url}:`, e);
        throw e;
    }
}

async function urlToBase64Image(url) {
    return new Promise(async (resolve, reject) => {
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        } catch (err) {
            // Fallback via Image element with CORS canvas
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (cErr) {
                    reject(cErr);
                }
            };
            img.onerror = () => reject(err);
            img.src = url;
        }
    });
}

function generateStudentSummaryText(s, docItems) {
    const name = s.fullName || s.full_name || 'Unnamed Student';
    const studentId = s.studentId || s.student_no || s.id || 'N/A';
    const course = s.course || s.program_name || 'N/A';
    const year = s.year || s.year_level || 'N/A';
    const sa = (s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || 'N/A').toString();
    const status = (s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || s.status || 'Pending').toUpperCase();
    const email = s.email || s.emailAddress || 'N/A';
    const phone = s.phone || s.phoneNumber || s.mobileNumber || s.mobile || 'N/A';
    const remarks = s.adminRemarks || s.admin_remarks || 'None';

    return `================================================================================
SCHOLARDOC - LAND BANK STATEMENT OF ACCOUNT (SA) VERIFICATION DOSSIER
University of Science and Technology of Southern Philippines (USTP)
Oroquieta City Campus • CHED UniFAST TES Scholarship Program
================================================================================

APPLICANT INFORMATION:
--------------------------------------------------------------------------------
Full Name          : ${name}
Student ID Number  : ${studentId}
Degree Program     : ${course}
Year Level         : ${year}
Email Address      : ${email}
Mobile Number      : ${phone}

LAND BANK STATEMENT OF ACCOUNT (SA) DETAILS:
--------------------------------------------------------------------------------
SA Account Number  : ${sa}
Servicing Bank     : Land Bank of the Philippines (LBP)
Verification Status: ${status}
Admin Remarks      : ${remarks}

DOCUMENT ATTACHMENTS IN THIS ARCHIVE:
--------------------------------------------------------------------------------
${docItems && docItems.length > 0 ? docItems.map((d, i) => `${i + 1}. [${d.label}] ${d.defaultName}`).join('\n') : 'No binary attachments uploaded.'}

Generated On: ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}
Generated By: ScholarDoc Super Administrator System
================================================================================
`;
}

async function generateStudentPdfBlob(s) {
    const jspdfModule = window.jspdf || {};
    const jsPDF = jspdfModule.jsPDF || window.jsPDF;
    if (!jsPDF) {
        throw new Error('jsPDF library is not loaded. Please refresh the page and try again.');
    }

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2); // 182mm

    // 1. Header Banner
    doc.setFillColor(15, 50, 96); // Deep Navy (#0F3260)
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFillColor(212, 175, 55); // Gold line (#D4AF37)
    doc.rect(0, 28, pageWidth, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES', pageWidth / 2, 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text('Oroquieta City Campus • CHED UniFAST Tertiary Education Subsidy (TES)', pageWidth / 2, 16, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(251, 192, 45); // Warm gold
    doc.text('LAND BANK STATEMENT OF ACCOUNT (SA) VERIFICATION DOSSIER', pageWidth / 2, 24, { align: 'center' });

    let currentY = 36;

    // 2. Student Demographics Card
    const name = s.fullName || s.full_name || 'Unnamed Student';
    const studentId = s.studentId || s.student_no || s.id || 'N/A';
    const course = s.course || s.program_name || 'N/A';
    const year = s.year || s.year_level || 'N/A';
    const email = s.email || s.emailAddress || 'N/A';
    const mobile = s.phone || s.phoneNumber || s.mobileNumber || s.mobile || 'N/A';
    const gender = s.gender || 'N/A';
    const status = (s.documents?.saVerificationStatus || s.documents?.sa_verification_status || s.saVerificationStatus || s.sa_verification_status || s.status || 'Pending').toUpperCase();
    const sa = (s.saNumber || s.sa_number || s.documents?.saNumber || s.documents?.sa_number || s.familyDetails?.saNumber || 'N/A').toString();

    // Box background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 38, 2.5, 2.5, 'FD');

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 50, 96);
    doc.text('STUDENT APPLICANT INFORMATION', margin + 6, currentY + 7);

    // Metadata Grid
    doc.setFontSize(8.5);
    const col1X = margin + 6;
    const val1X = margin + 34;
    const col2X = margin + 98;
    const val2X = margin + 122;

    let rowY = currentY + 14;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Full Name:', col1X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(name, val1X, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Student ID:', col2X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(studentId, val2X, rowY);

    rowY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Program:', col1X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(course, val1X, rowY);

    doc.setTextColor(100, 116, 139);
    doc.text('Year Level:', col2X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(year, val2X, rowY);

    rowY += 6;
    doc.setTextColor(100, 116, 139);
    doc.text('Email Address:', col1X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(email, val1X, rowY);

    doc.setTextColor(100, 116, 139);
    doc.text('Mobile Number:', col2X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(mobile, val2X, rowY);

    rowY += 6;
    doc.setTextColor(100, 116, 139);
    doc.text('Gender:', col1X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(gender, val1X, rowY);

    doc.setTextColor(100, 116, 139);
    doc.text('Export Date:', col2X, rowY);
    doc.setTextColor(15, 23, 42);
    doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), val2X, rowY);

    currentY += 44;

    // 3. Land Bank SA Number Card
    doc.setFillColor(254, 252, 232); // Amber light (#FEFCE8)
    doc.setDrawColor(253, 224, 71);
    doc.roundedRect(margin, currentY, contentWidth, 26, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('LAND BANK STATEMENT OF ACCOUNT (SA) DETAILS', margin + 6, currentY + 6);

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 50, 96);
    doc.text(`SA Number: ${sa}`, margin + 6, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Servicing Bank: Land Bank of the Philippines (LBP)', margin + 6, currentY + 21);

    // Status pill on right of SA box
    doc.setFont('helvetica', 'bold');
    let statusBg = [241, 245, 249];
    let statusFg = [71, 85, 105];
    if (status === 'VERIFIED' || status === 'APPROVED') {
        statusBg = [220, 252, 231];
        statusFg = [22, 101, 52];
    } else if (status === 'MISSING') {
        statusBg = [254, 243, 199];
        statusFg = [180, 83, 9];
    } else if (status === 'REJECTED') {
        statusBg = [254, 226, 226];
        statusFg = [185, 28, 28];
    }
    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(margin + contentWidth - 36, currentY + 7, 30, 8, 2, 2, 'F');
    doc.setTextColor(statusFg[0], statusFg[1], statusFg[2]);
    doc.setFontSize(8);
    doc.text(status, margin + contentWidth - 21, currentY + 12.5, { align: 'center' });

    currentY += 32;

    // 4. Document Proof Section (ATM Card & Deposit Slip)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 50, 96);
    doc.text('SUBMITTED DOCUMENT PROOFS', margin, currentY);
    currentY += 4;

    const atmCardUrl = s.atmCardUrl || s.atm_card_url || (s.documents && (s.documents.atmCardUrl || s.documents.atm_card_url || s.documents.atmProofUrl || s.documents.atm_proof_url));
    const depositSlipUrl = s.depositSlipUrl || s.deposit_slip_url || (s.documents && (s.documents.depositSlipUrl || s.documents.deposit_slip_url));

    const isAtmPdf = atmCardUrl && (atmCardUrl.toLowerCase().includes('.pdf') || (s.atmCardFileName || '').toLowerCase().endsWith('.pdf'));
    const isDepositPdf = depositSlipUrl && (depositSlipUrl.toLowerCase().includes('.pdf') || (s.depositSlipFileName || '').toLowerCase().endsWith('.pdf'));

    // Check which images are available
    let atmBase64 = null;
    let depositBase64 = null;

    if (atmCardUrl && !isAtmPdf) {
        try {
            atmBase64 = await urlToBase64Image(atmCardUrl);
        } catch (e) {
            console.warn('Could not load ATM image for PDF:', e);
        }
    }
    if (depositSlipUrl && !isDepositPdf) {
        try {
            depositBase64 = await urlToBase64Image(depositSlipUrl);
        } catch (e) {
            console.warn('Could not load Deposit image for PDF:', e);
        }
    }

    const boxHeight = 72;

    if (atmBase64 && depositBase64) {
        // Side by side layout
        const halfWidth = (contentWidth - 6) / 2; // ~88mm

        // Box 1: ATM
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, halfWidth, boxHeight, 2, 2, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 50, 96);
        doc.text('ATM CARD PROOF', margin + 4, currentY + 6);
        try {
            doc.addImage(atmBase64, 'JPEG', margin + 3, currentY + 8, halfWidth - 6, boxHeight - 11);
        } catch (_) {}

        // Box 2: Deposit Slip
        const col2Left = margin + halfWidth + 6;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(col2Left, currentY, halfWidth, boxHeight, 2, 2, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 50, 96);
        doc.text('DEPOSIT SLIP PROOF', col2Left + 4, currentY + 6);
        try {
            doc.addImage(depositBase64, 'JPEG', col2Left + 3, currentY + 8, halfWidth - 6, boxHeight - 11);
        } catch (_) {}

        currentY += boxHeight + 8;
    } else if (atmBase64) {
        // ATM Card Single Image Large
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, 'FD');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 50, 96);
        doc.text('LAND BANK ATM CARD DOCUMENT PROOF', margin + 6, currentY + 6);
        try {
            const imgW = 115;
            const imgH = boxHeight - 12;
            const imgX = margin + (contentWidth - imgW) / 2;
            doc.addImage(atmBase64, 'JPEG', imgX, currentY + 8, imgW, imgH);
        } catch (_) {}
        currentY += boxHeight + 8;
    } else if (depositBase64) {
        // Deposit Slip Single Image Large
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, 'FD');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 50, 96);
        doc.text('DEPOSIT SLIP / TRANSACTION RECEIPT PROOF', margin + 6, currentY + 6);
        try {
            const imgW = 115;
            const imgH = boxHeight - 12;
            const imgX = margin + (contentWidth - imgW) / 2;
            doc.addImage(depositBase64, 'JPEG', imgX, currentY + 8, imgW, imgH);
        } catch (_) {}
        currentY += boxHeight + 8;
    } else {
        // Placeholder box for PDF attachments or missing files
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, 28, 2, 2, 'FD');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('DOCUMENT FILE ATTACHMENTS', margin + 6, currentY + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`ATM Proof: ${atmCardUrl ? (isAtmPdf ? 'Attached (PDF Format - Included in ZIP archive)' : 'Attached') : 'Not Provided'}`, margin + 6, currentY + 14);
        doc.text(`Deposit Slip: ${depositSlipUrl ? (isDepositPdf ? 'Attached (PDF Receipt - Included in ZIP archive)' : 'Attached') : 'Not Provided'}`, margin + 6, currentY + 20);
        currentY += 34;
    }

    // 5. Remarks & Verification Audit
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 50, 96);
    doc.text('ADMINISTRATIVE NOTES & VERIFICATION AUDIT', margin + 6, currentY + 6);

    const remarks = s.adminRemarks || s.admin_remarks || 'None recorded.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitRemarks = doc.splitTextToSize(`Remarks: ${remarks}`, contentWidth - 12);
    doc.text(splitRemarks, margin + 6, currentY + 13);

    // Footer Watermark / Disclaimer
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This document was officially generated by the ScholarDoc Super Administrator Verification System.', pageWidth / 2, 285, { align: 'center' });
    doc.text('Republic of the Philippines • Commission on Higher Education (CHED) UniFAST TES', pageWidth / 2, 290, { align: 'center' });

    return doc.output('blob');
}

// ── Download Actions (Single Student) ────────────────────────────────

window.downloadSelectedStudentZip = async function () {
    const s = filteredSaStudents[selectedIndex];
    if (!s) {
        alert('Please select a student from the queue first.');
        return;
    }

    const btn = document.getElementById('btn-download-zip');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="icon-loader" style="font-size: 13px; animation: spin 1s linear infinite; display: inline-block;"></i> <span>Zipping...</span>`;
    }

    try {
        const JSZip = window.JSZip;
        const saveAs = window.saveAs || window.FileSaver?.saveAs;
        if (!JSZip || !saveAs) {
            alert('ZIP export utility (JSZip / FileSaver) is loading. Please refresh and try again.');
            return;
        }

        const zip = new JSZip();
        const prefix = formatStudentFilePrefix(s);
        const folder = zip.folder(prefix);

        // 1. Gather all documents
        const docItems = getStudentDocumentUrls(s);
        let addedFilesCount = 0;

        for (const item of docItems) {
            try {
                const blob = await fetchMediaBlob(item.url);
                let ext = 'jpg';
                const urlLower = item.url.toLowerCase();
                if (urlLower.includes('.pdf') || (item.defaultName || '').toLowerCase().endsWith('.pdf')) ext = 'pdf';
                else if (urlLower.includes('.png')) ext = 'png';
                else if (urlLower.includes('.webp')) ext = 'webp';

                const cleanName = `${item.label}.${ext}`;
                folder.file(cleanName, blob);
                addedFilesCount++;
            } catch (err) {
                console.warn(`Could not fetch document ${item.label} for student:`, err);
            }
        }

        // 2. Generate and add the official PDF dossier into the ZIP
        try {
            const pdfBlob = await generateStudentPdfBlob(s);
            if (pdfBlob) {
                folder.file(`${prefix}_SA_Dossier.pdf`, pdfBlob);
                addedFilesCount++;
            }
        } catch (pdfErr) {
            console.warn('Could not compile PDF dossier for ZIP:', pdfErr);
        }

        // 3. Add text summary
        const summaryText = generateStudentSummaryText(s, docItems);
        folder.file(`${prefix}_Summary.txt`, summaryText);

        // 4. Generate ZIP archive and trigger download
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${prefix}_SA_Documents.zip`);

        if (window.showToast) {
            window.showToast(`ZIP package downloaded successfully for ${s.fullName || 'student'}`, 'check-circle');
        }
    } catch (e) {
        console.error('Error generating student ZIP:', e);
        alert('Failed to generate ZIP archive: ' + (e.message || e));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    }
};

window.downloadSelectedStudentPdf = async function () {
    const s = filteredSaStudents[selectedIndex];
    if (!s) {
        alert('Please select a student from the queue first.');
        return;
    }

    const btn = document.getElementById('btn-download-pdf');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="icon-loader" style="font-size: 13px; animation: spin 1s linear infinite; display: inline-block;"></i> <span>Generating...</span>`;
    }

    try {
        const saveAs = window.saveAs || window.FileSaver?.saveAs;
        const prefix = formatStudentFilePrefix(s);
        const pdfBlob = await generateStudentPdfBlob(s);

        if (saveAs) {
            saveAs(pdfBlob, `${prefix}_SA_Dossier.pdf`);
        } else {
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix}_SA_Dossier.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        if (window.showToast) {
            window.showToast(`SA Verification PDF Dossier downloaded for ${s.fullName || 'student'}`, 'check-circle');
        }
    } catch (e) {
        console.error('Error generating student PDF:', e);
        alert('Failed to generate PDF dossier: ' + (e.message || e));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    }
};

// ── Bulk Download (All Students in Queue) ────────────────────────────

function openSaDownloadModal() {
    const modal = document.getElementById('sa-download-modal');
    if (modal) {
        modal.style.display = 'flex';
        const actions = document.getElementById('sa-modal-actions');
        if (actions) actions.style.display = 'none';
        updateSaDownloadProgress(0, 'Initializing batch...', 'Compiling SA Archive', 'Step 1/4 • Preparing');
    }
}

window.closeSaDownloadModal = function () {
    const modal = document.getElementById('sa-download-modal');
    if (modal) modal.style.display = 'none';
};

function updateSaDownloadProgress(pct, stageText, title, stage) {
    const pBar = document.getElementById('sa-modal-progress-bar');
    const pText = document.getElementById('sa-modal-percentage');
    const sText = document.getElementById('sa-modal-stage-text');
    const titleEl = document.getElementById('sa-modal-title');

    if (pBar) pBar.style.width = `${pct}%`;
    if (pText) pText.textContent = `${pct}%`;
    if (sText) sText.textContent = stageText || `${stage} (${pct}%)`;
    if (titleEl && title) titleEl.textContent = title;
}

window.downloadAllSaDocuments = async function () {
    const JSZip = window.JSZip;
    const saveAs = window.saveAs || window.FileSaver?.saveAs;
    if (!JSZip || !saveAs) {
        alert('ZIP export utility (JSZip / FileSaver) is not loaded.');
        return;
    }

    const studentsWithDocs = filteredSaStudents.filter(s => getStudentDocumentUrls(s).length > 0 || (s.saNumber || s.sa_number));
    if (studentsWithDocs.length === 0) {
        if (window.showToast) {
            window.showToast('No students with documents found in the current queue.', 'alert-circle');
        } else {
            alert('No students with documents found in the current queue.');
        }
        return;
    }

    openSaDownloadModal();
    updateSaDownloadProgress(5, 'Preparing document download batch...', 'Compiling SA Archive', 'Step 1/4 • Preparing');

    const zip = new JSZip();
    let successCount = 0;
    const total = studentsWithDocs.length;
    const BATCH_SIZE = 4;

    try {
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = studentsWithDocs.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (student) => {
                const prefix = formatStudentFilePrefix(student);
                const studentFolder = zip.folder(prefix);
                const docItems = getStudentDocumentUrls(student);

                for (const item of docItems) {
                    try {
                        const blob = await fetchMediaBlob(item.url);
                        let ext = 'jpg';
                        const urlLower = item.url.toLowerCase();
                        if (urlLower.includes('.pdf') || (item.defaultName || '').toLowerCase().endsWith('.pdf')) ext = 'pdf';
                        else if (urlLower.includes('.png')) ext = 'png';
                        const cleanName = `${item.label}.${ext}`;
                        studentFolder.file(cleanName, blob);
                    } catch (err) {
                        console.warn(`Error downloading ${item.label} for ${prefix}:`, err);
                    }
                }

                // Also generate individual PDF dossier
                try {
                    const pdfBlob = await generateStudentPdfBlob(student);
                    if (pdfBlob) studentFolder.file(`${prefix}_SA_Dossier.pdf`, pdfBlob);
                } catch (_) {}

                // Text summary
                const summary = generateStudentSummaryText(student, docItems);
                studentFolder.file(`${prefix}_Summary.txt`, summary);
                successCount++;
            }));

            const processed = Math.min(i + BATCH_SIZE, total);
            const pct = 10 + Math.round((processed / total) * 65);
            updateSaDownloadProgress(pct, `Downloading student files (${processed}/${total})...`, 'Compiling SA Archive', `Step 2/4 • Downloading (${processed}/${total})`);
        }

        updateSaDownloadProgress(80, 'Compressing archive into ZIP format...', 'Finalizing ZIP', 'Step 3/4 • Compressing');
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            const compPercent = 80 + Math.round((metadata.percent / 100) * 16);
            updateSaDownloadProgress(compPercent, `Compressing files: ${Math.round(metadata.percent)}%...`, 'Finalizing ZIP', `Step 3/4 • Compressing (${Math.round(metadata.percent)}%)`);
        });

        updateSaDownloadProgress(99, 'Saving ZIP archive to your device...', 'Saving File', 'Step 4/4 • Saving File');
        saveAs(zipBlob, `SA_Verification_All_Student_Documents_${new Date().toISOString().slice(0, 10)}.zip`);

        updateSaDownloadProgress(100, `Successfully archived documents for ${successCount} student(s)!`, 'Download Completed!', 'Finished');
        const actions = document.getElementById('sa-modal-actions');
        if (actions) actions.style.display = 'flex';

        if (window.showToast) {
            window.showToast(`All documents for ${successCount} student(s) downloaded in ZIP archive.`, 'check-circle');
        }
    } catch (err) {
        console.error('Bulk SA download error:', err);
        updateSaDownloadProgress(100, 'Error: ' + err.message, 'Download Failed', 'Error');
        const actions = document.getElementById('sa-modal-actions');
        if (actions) actions.style.display = 'flex';
    }
};

// Global Exposure for admin router
window.loadSaQueue = loadSaQueue;
window.filterSaQueue = filterSaQueue;

let saRealtimeChannel = null;
function setupRealtimeSaSubscription() {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
        if (saRealtimeChannel) {
            supabase.removeChannel(saRealtimeChannel);
            saRealtimeChannel = null;
        }

        saRealtimeChannel = supabase.channel('public:sa_verification_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_grantees' }, (payload) => {
                console.log('[Realtime] students change event in sa_verification:', payload.eventType);
                loadSaQueue();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] sa_verification subscribed to students table');
                }
            });
    } catch (e) {
        console.warn('Could not establish realtime channel in sa_verification:', e);
    }
}

// Init
loadSaQueue();
setupRealtimeSaSubscription();


