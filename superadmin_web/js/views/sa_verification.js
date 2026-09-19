// js/views/sa_verification.js
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
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (res.error) {
            res = await supabase.from('students').select('*').order('createdAt', { ascending: false });
        }
        if (res.error) {
            res = await supabase.from('students').select('*');
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
        const status = s.documents?.saVerificationStatus || 'Pending';
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

// ── Search & Filter Logic ────────────────────────────────────────────
function filterSaQueue() {
    const searchInput = document.getElementById('sa-search-input');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

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

        return matchQuery && matchStatus && matchCourse;
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
    const atmCardUrl = s.atmCardUrl || s.atm_card_url || (s.documents && (s.documents.atmCardUrl || s.documents.atm_card_url));
    const atmCardFileName = s.atmCardFileName || s.atm_card_file_name || (s.documents && (s.documents.atmCardFileName || s.documents.atm_card_file_name)) || 'ATM_Proof_Image.jpg';

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
                        <img src="${atmCardUrl}" alt="ATM Card" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                            <i class="icon-zoom-in" style="color: white; font-size: 18px;"></i>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${atmCardFileName}">${atmCardFileName}</div>
                        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Land Bank ATM Card Image</div>
                        
                        <div style="display: flex; gap: 8px; margin-top: 6px;">
                            <button onclick="openSaLightbox('${atmCardUrl}', '${name} - ATM Card Proof')" style="padding: 4px 10px; background: rgba(15, 50, 96, 0.08); border: 1px solid rgba(15, 50, 96, 0.15); border-radius: 6px; font-size: 11px; font-weight: 700; color: var(--primary-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-maximize-2" style="font-size: 11px;"></i> Lightbox
                            </button>
                            <a href="${atmCardUrl}" target="_blank" style="padding: 4px 10px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-external-link" style="font-size: 11px;"></i> Full Tab
                            </a>
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
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Student provided Land Bank SA number without photo attachment.</div>
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

            <!-- ATM Card Document Proof Preview -->
            ${atmCardHtml}

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
window.selectSaStudent = function(index) {
    selectedIndex = index;
    renderQueue();
    renderPanel();
};

window.navigateSaQueue = function(direction) {
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < filteredSaStudents.length) {
        selectSaStudent(nextIndex);
    }
};

window.applySaPreset = function(presetText) {
    const textarea = document.getElementById('sa-remarks');
    if (textarea) {
        textarea.value = presetText;
        textarea.focus();
    }
};

window.copySaNumber = function(saNum) {
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
window.openSaLightbox = function(url, caption = '') {
    const modal = document.getElementById('sa-lightbox-modal');
    const img = document.getElementById('sa-lightbox-img');
    const cap = document.getElementById('sa-lightbox-caption');
    if (modal && img) {
        img.src = url;
        if (cap) cap.textContent = caption || 'ATM Card Proof Image';
        modal.style.display = 'flex';
    }
};

window.closeSaLightbox = function() {
    const modal = document.getElementById('sa-lightbox-modal');
    if (modal) modal.style.display = 'none';
};

// ── Update SA Status ────────────────────────────────────────────────
window.updateSaStatus = async function(newStatus, isFinalRejection = false) {
    if (isUpdating) return;
    const s = filteredSaStudents[selectedIndex];
    if (!s || !s.uid) return;

    const remarks = (document.getElementById('sa-remarks')?.value || '').trim();

    isUpdating = true;
    try {
        // 1. Update SA Verification Status (stored inside documents JSON)
        const currentDocs = s.documents || {};
        const updatedDocs = { 
            ...currentDocs, 
            saVerificationStatus: newStatus,
            sa_verification_status: newStatus 
        };

        const updatePayload = {
            documents: updatedDocs,
            adminRemarks: remarks,
            admin_remarks: remarks,
            requiresResubmission: !isFinalRejection && (newStatus === 'Missing' || newStatus === 'Rejected'),
            requires_resubmission: !isFinalRejection && (newStatus === 'Missing' || newStatus === 'Rejected'),
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Auto-calculate overall status:
        // Only set global status to Verified when BOTH SA and ID are verified
        const currentIdStatus = currentDocs.idValidationStatus || currentDocs.id_validation_status || 'Pending';
        if (newStatus === 'Verified' && (currentIdStatus === 'Verified' || currentIdStatus === 'Approved')) {
            updatePayload.status = 'Verified';
        } else if (newStatus === 'Missing' || newStatus === 'Rejected') {
            updatePayload.status = newStatus;
        }

        let updateRes = await supabase.from('students').update(updatePayload).eq('uid', s.uid);
        if (updateRes.error) {
            // Fallback: update with reduced fields if schema difference
            const fallbackPayload = {
                admin_remarks: remarks,
                adminRemarks: remarks,
                updated_at: new Date().toISOString()
            };
            if (s.documents !== undefined) fallbackPayload.documents = updatedDocs;
            updateRes = await supabase.from('students').update(fallbackPayload).eq('uid', s.uid);
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

        // 3. Notification
        let title = '';
        let message = '';
        let type = 'info';

        if (newStatus === 'Verified') {
            title = 'SA Number Verified';
            message = 'Your Land Bank SA Number has been verified by the administrator.';
            type = 'success';
        } else if (newStatus === 'Missing') {
            title = 'SA Number Missing';
            message = remarks 
                ? `Your submitted SA Number requires revision. Please review the feedback provided by the administrator: ${remarks}`
                : 'Your submitted SA Number requires revision. Please review the feedback provided by the administrator.';
            type = 'warning';
        } else {
            title = 'SA Number Rejected';
            message = remarks
                ? `Your SA Number has been rejected. Feedback: ${remarks}`
                : 'Your SA Number has been rejected.';
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
        } catch (notifErr) {
            console.warn('Could not send notification:', notifErr);
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

// Global Exposure for admin router
window.loadSaQueue = loadSaQueue;
window.filterSaQueue = filterSaQueue;

// Init
loadSaQueue();
