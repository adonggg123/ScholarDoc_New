// js/views/id_validation.js
const supabase = window.supabaseClient;

let idStudents = [];
let filteredIdStudents = [];
let selectedIndex = 0;
let isUpdating = false;

// ── Load Data ───────────────────────────────────────────────────────
async function loadIdQueue() {
    const refreshBtn = document.getElementById('id-refresh-btn');
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

        // Filter students who have submitted documents
        idStudents = (data || []).filter(s => {
            const hasPdf = s.submissionPdfUrl || (s.documents && s.documents.submissionPdfUrl);
            const hasFront = s.idFrontUrl || (s.documents && s.documents.idFrontUrl);
            const hasBack = s.idBackUrl || (s.documents && s.documents.idBackUrl);
            return hasPdf || hasFront || hasBack;
        });

        // Update KPI summary cards
        updateKpis();

        // Apply filters
        filterIdQueue();

    } catch (e) {
        console.error('Error loading ID queue:', e);
        const container = document.getElementById('id-list-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--error);">
                    <i class="icon-alert-triangle" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
                    <div style="font-weight: 700; font-size: 14px;">Error Loading ID Validation Queue</div>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${e.message || 'Could not connect to database.'}</p>
                    <button class="btn" style="margin-top: 14px; background: var(--primary-color); color: white; padding: 6px 16px; border-radius: 8px; font-size: 12px;" onclick="loadIdQueue()">Retry</button>
                </div>
            `;
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.innerHTML = `<i class="icon-refresh-cw" style="font-size: 14px; color: var(--primary-color);"></i> <span>Refresh</span>`;
        }
    }
}

// ── Update KPI Summary Cards ─────────────────────────────────────────
function updateKpis() {
    const total = idStudents.length;
    let pending = 0;
    let verified = 0;
    let missing = 0;
    let pdfCount = 0;

    idStudents.forEach(s => {
        const status = s.documents?.idValidationStatus || 'Pending';
        if (status === 'Verified' || status === 'Approved') {
            verified++;
        } else if (status === 'Missing') {
            missing++;
        } else {
            pending++;
        }

        const pdfUrl = s.submissionPdfUrl || (s.documents && s.documents.submissionPdfUrl);
        if (pdfUrl) {
            pdfCount++;
        }
    });

    const setKpi = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setKpi('kpi-id-total', total);
    setKpi('kpi-id-pending', pending);
    setKpi('kpi-id-verified', verified);
    setKpi('kpi-id-missing', missing);
    setKpi('kpi-id-pdf', pdfCount);

    const bulkBadge = document.getElementById('bulk-count-badge');
    if (bulkBadge) bulkBadge.textContent = pdfCount;
}

// ── Search & Filter Logic ────────────────────────────────────────────
function filterIdQueue() {
    const searchInput = document.getElementById('id-search-input');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const statusFilter = document.getElementById('id-filter-status')?.value || 'All';
    const docFilter = document.getElementById('id-filter-doc')?.value || 'All';
    const courseFilter = document.getElementById('id-filter-course')?.value || 'All';
    const sortBy = document.getElementById('id-sort-by')?.value || 'latest';

    filteredIdStudents = idStudents.filter(s => {
        const name = (s.fullName || '').toLowerCase();
        const studentId = (s.studentId || s.id || '').toLowerCase();
        const course = (s.course || '').toUpperCase();
        const status = s.documents?.idValidationStatus || 'Pending';

        const hasFront = !!(s.idFrontUrl || s.documents?.idFrontUrl);
        const hasBack = !!(s.idBackUrl || s.documents?.idBackUrl);
        const hasPdf = !!(s.submissionPdfUrl || s.documents?.submissionPdfUrl);

        // Search Match
        const matchQuery = !query || name.includes(query) || studentId.includes(query) || course.toLowerCase().includes(query);

        // Status Match
        let matchStatus = true;
        if (statusFilter === 'Pending') {
            matchStatus = status === 'Pending' || (!s.documents?.idValidationStatus);
        } else if (statusFilter === 'Verified') {
            matchStatus = status === 'Verified' || status === 'Approved';
        } else if (statusFilter === 'Missing') {
            matchStatus = status === 'Missing';
        } else if (statusFilter === 'Rejected') {
            matchStatus = status === 'Rejected';
        }

        // Doc Type Match
        let matchDoc = true;
        if (docFilter === 'front_back') {
            matchDoc = hasFront || hasBack;
        } else if (docFilter === 'pdf') {
            matchDoc = hasPdf;
        }

        // Course Match
        let matchCourse = true;
        if (courseFilter !== 'All') {
            matchCourse = course.includes(courseFilter.toUpperCase());
        }

        return matchQuery && matchStatus && matchDoc && matchCourse;
    });

    // Sorting
    filteredIdStudents.sort((a, b) => {
        if (sortBy === 'name_asc') {
            return (a.fullName || '').localeCompare(b.fullName || '');
        } else if (sortBy === 'name_desc') {
            return (b.fullName || '').localeCompare(a.fullName || '');
        } else if (sortBy === 'id_num') {
            const idA = (a.studentId || a.id || '').toString();
            const idB = (b.studentId || b.id || '').toString();
            return idA.localeCompare(idB);
        } else {
            // Latest First
            const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
        }
    });

    // Update Counts UI
    const matchedCountEl = document.getElementById('id-matched-count');
    const totalCountEl = document.getElementById('id-total-count');
    const queuePillEl = document.getElementById('id-queue-count-pill');
    if (matchedCountEl) matchedCountEl.textContent = filteredIdStudents.length;
    if (totalCountEl) totalCountEl.textContent = idStudents.length;
    if (queuePillEl) queuePillEl.textContent = filteredIdStudents.length;

    if (selectedIndex >= filteredIdStudents.length) {
        selectedIndex = Math.max(0, filteredIdStudents.length - 1);
    }

    renderQueue();
    renderPanel();
}

// ── Render Queue (Left) ─────────────────────────────────────────────
function renderQueue() {
    const container = document.getElementById('id-list-container');
    if (!container) return;

    if (filteredIdStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-secondary);">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(15, 50, 96, 0.05); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                    <i class="icon-user-x" style="font-size: 24px; color: var(--text-secondary);"></i>
                </div>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No ID Submissions Found</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Try modifying your search or filter settings.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredIdStudents.map((s, index) => {
        const isSelected = index === selectedIndex;
        const name = s.fullName || 'Unnamed Student';
        const studentId = s.studentId || s.id || 'N/A';
        const course = s.course || 'N/A';
        const photo = s.profilePictureUrl || s.profileImageUrl || s.photoUrl || s.photoURL;
        const status = s.documents?.idValidationStatus || 'Pending';

        const hasFront = !!(s.idFrontUrl || s.documents?.idFrontUrl);
        const hasBack = !!(s.idBackUrl || s.documents?.idBackUrl);
        const hasPdf = !!(s.submissionPdfUrl || s.documents?.submissionPdfUrl);

        // Status Badge Chip
        let statusBadgeHtml = '';
        if (status === 'Verified' || status === 'Approved') {
            statusBadgeHtml = `
                <span style="padding: 2px 7px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                    <i class="icon-check" style="font-size: 10px;"></i> VALIDATED
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

        // Document Badges
        let docBadgesHtml = '';
        if (hasFront && hasBack) {
            docBadgesHtml += `<span style="font-size: 9px; font-weight: 700; color: #2563EB; background: rgba(37, 99, 235, 0.08); padding: 1px 5px; border-radius: 4px;">Front+Back ID</span>`;
        } else if (hasFront) {
            docBadgesHtml += `<span style="font-size: 9px; font-weight: 700; color: #2563EB; background: rgba(37, 99, 235, 0.08); padding: 1px 5px; border-radius: 4px;">Front ID</span>`;
        } else if (hasBack) {
            docBadgesHtml += `<span style="font-size: 9px; font-weight: 700; color: #2563EB; background: rgba(37, 99, 235, 0.08); padding: 1px 5px; border-radius: 4px;">Back ID</span>`;
        }
        if (hasPdf) {
            docBadgesHtml += `<span style="font-size: 9px; font-weight: 700; color: #7C3AED; background: rgba(124, 58, 237, 0.08); padding: 1px 5px; border-radius: 4px;">PDF Dossier</span>`;
        }

        return `
            <div class="id-list-item ${isSelected ? 'selected' : ''}" 
                 style="padding: 14px 18px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--border-color); user-select: none;"
                 onclick="selectIdStudent(${index})">
                ${avatarHtml}
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
                        <div style="font-weight: 800; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                        ${statusBadgeHtml}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">ID: ${studentId}</span>
                        <span style="color: var(--border-color); font-size: 10px;">•</span>
                        <span style="font-size: 10px; color: var(--text-secondary); background: rgba(0,0,0,0.04); padding: 1px 5px; border-radius: 4px;">${course}</span>
                        ${docBadgesHtml}
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
    const container = document.getElementById('id-panel-container');
    if (!container) return;

    if (filteredIdStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 24px; color: var(--text-secondary);">
                <i class="icon-user-x" style="font-size: 48px; color: rgba(15, 50, 96, 0.2); margin-bottom: 14px; display: block;"></i>
                <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">No Student Selected</h3>
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">Select an applicant from the list to review their ID card and signature files.</p>
            </div>
        `;
        return;
    }

    const s = filteredIdStudents[selectedIndex];
    if (!s) return;

    const name = s.fullName || 'Unnamed Student';
    const studentId = s.studentId || s.id || 'N/A';
    const course = s.course || 'N/A';
    const year = s.year || 'N/A';
    const photo = s.profilePictureUrl || s.profileImageUrl || s.photoUrl || s.photoURL;
    const currentRemarks = s.adminRemarks || '';

    // Queue Navigation Counts
    const currentPos = selectedIndex + 1;
    const totalPos = filteredIdStudents.length;

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

    // Front ID & Back ID Display Cards
    const frontUrl = s.idFrontUrl || s.documents?.idFrontUrl;
    const backUrl = s.idBackUrl || s.documents?.idBackUrl;
    const pdfUrl = s.submissionPdfUrl || s.documents?.submissionPdfUrl;
    const pdfName = s.submissionPdfName || (s.documents && s.documents.submissionPdfName) || 'Submission_Requirement_Dossier.pdf';

    let idCardsSection = '';
    if (frontUrl || backUrl) {
        idCardsSection = `
            <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <i class="icon-id-card" style="font-size: 14px; color: var(--primary-color);"></i> Student ID Card Photos
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <!-- Front ID Card -->
                    <div style="border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 50, 96, 0.02); padding: 10px; display: flex; flex-direction: column;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; font-weight: 800; color: var(--text-primary);">Front ID</span>
                            ${frontUrl ? `<span style="font-size: 9px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.1); padding: 1px 6px; border-radius: 10px;">READY</span>` : `<span style="font-size: 9px; font-weight: 700; color: var(--text-secondary);">MISSING</span>`}
                        </div>
                        
                        ${frontUrl ? `
                            <div style="position: relative; width: 100%; height: 130px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); cursor: pointer;"
                                 onclick="openIdLightbox('${frontUrl}', '${name} - Front ID Card')">
                                <img src="${frontUrl}" alt="Front ID" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                                    <i class="icon-zoom-in" style="color: white; font-size: 20px;"></i>
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; margin-top: 8px;">
                                <button onclick="openIdLightbox('${frontUrl}', '${name} - Front ID Card')" style="flex: 1; padding: 4px 6px; background: rgba(15, 50, 96, 0.08); border: 1px solid rgba(15, 50, 96, 0.15); border-radius: 6px; font-size: 10px; font-weight: 700; color: var(--primary-color); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px;">
                                    <i class="icon-maximize-2" style="font-size: 10px;"></i> Zoom
                                </button>
                                <a href="${frontUrl}" target="_blank" style="padding: 4px 8px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; font-size: 10px; font-weight: 600; color: var(--text-secondary); text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
                                    <i class="icon-external-link" style="font-size: 10px;"></i>
                                </a>
                            </div>
                        ` : `
                            <div style="height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); border-radius: 8px; border: 1px dashed var(--border-color); color: var(--text-secondary);">
                                <i class="icon-image-off" style="font-size: 20px; margin-bottom: 4px; opacity: 0.5;"></i>
                                <span style="font-size: 11px;">Not Uploaded</span>
                            </div>
                        `}
                    </div>

                    <!-- Back ID Card -->
                    <div style="border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 50, 96, 0.02); padding: 10px; display: flex; flex-direction: column;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; font-weight: 800; color: var(--text-primary);">Back ID & Signature</span>
                            ${backUrl ? `<span style="font-size: 9px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.1); padding: 1px 6px; border-radius: 10px;">READY</span>` : `<span style="font-size: 9px; font-weight: 700; color: var(--text-secondary);">MISSING</span>`}
                        </div>
                        
                        ${backUrl ? `
                            <div style="position: relative; width: 100%; height: 130px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); cursor: pointer;"
                                 onclick="openIdLightbox('${backUrl}', '${name} - Back ID Card & Signature')">
                                <img src="${backUrl}" alt="Back ID" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                                    <i class="icon-zoom-in" style="color: white; font-size: 20px;"></i>
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; margin-top: 8px;">
                                <button onclick="openIdLightbox('${backUrl}', '${name} - Back ID Card & Signature')" style="flex: 1; padding: 4px 6px; background: rgba(15, 50, 96, 0.08); border: 1px solid rgba(15, 50, 96, 0.15); border-radius: 6px; font-size: 10px; font-weight: 700; color: var(--primary-color); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px;">
                                    <i class="icon-maximize-2" style="font-size: 10px;"></i> Zoom
                                </button>
                                <a href="${backUrl}" target="_blank" style="padding: 4px 8px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; font-size: 10px; font-weight: 600; color: var(--text-secondary); text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
                                    <i class="icon-external-link" style="font-size: 10px;"></i>
                                </a>
                            </div>
                        ` : `
                            <div style="height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); border-radius: 8px; border: 1px dashed var(--border-color); color: var(--text-secondary);">
                                <i class="icon-image-off" style="font-size: 20px; margin-bottom: 4px; opacity: 0.5;"></i>
                                <span style="font-size: 11px;">Not Uploaded</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    // PDF Document Attachment Tile
    let pdfSectionHtml = '';
    if (pdfUrl) {
        pdfSectionHtml = `
            <div style="margin-bottom: 16px; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 12px; background: rgba(15, 50, 96, 0.02); display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="icon-file-text" style="color: #EF4444; font-size: 20px;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pdfName}">${pdfName}</div>
                    <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Official Compiled Requirement PDF</div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <a href="${pdfUrl}" target="_blank" style="padding: 6px 12px; background: var(--primary-color); color: white; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="icon-eye" style="font-size: 12px;"></i> View PDF
                    </a>
                </div>
            </div>
        `;
    }

    if (!frontUrl && !backUrl && !pdfUrl) {
        idCardsSection = `
            <div style="margin-bottom: 16px; padding: 20px; border: 1px dashed var(--border-color); border-radius: 12px; text-align: center; background: rgba(0,0,0,0.01);">
                <i class="icon-folder-x" style="font-size: 28px; color: var(--text-secondary); margin-bottom: 6px; display: block;"></i>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">No ID Documents Attached</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Student has not uploaded front/back ID images or requirement PDF files yet.</div>
            </div>
        `;
    }

    container.innerHTML = `
        <!-- Sticky Navigation Bar -->
        <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); background: rgba(15, 50, 96, 0.03); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="icon-badge-check" style="font-size: 14px; color: var(--primary-color);"></i>
                <span style="font-size: 12px; font-weight: 800; color: var(--primary-color); text-transform: uppercase; letter-spacing: 0.5px;">Validation Station</span>
            </div>

            <!-- Previous / Next Navigator -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn" style="padding: 4px 8px; border-radius: 6px; background: var(--surface-color); border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: var(--text-primary); cursor: pointer;" 
                        onclick="navigateIdQueue(-1)" ${selectedIndex === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                    <i class="icon-chevron-left" style="font-size: 12px;"></i> Prev
                </button>
                <span style="font-size: 11px; font-weight: 800; color: var(--text-secondary);">${currentPos} / ${totalPos}</span>
                <button class="btn" style="padding: 4px 8px; border-radius: 6px; background: var(--surface-color); border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: var(--text-primary); cursor: pointer;" 
                        onclick="navigateIdQueue(1)" ${selectedIndex === totalPos - 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
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

            <!-- ID Photos Grid -->
            ${idCardsSection}

            <!-- PDF Attachment Tile -->
            ${pdfSectionHtml}

            <!-- Quick Remarks Preset Chips -->
            <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 800; color: var(--text-primary);">Admin Remarks & Feedback</span>
                <span style="font-size: 10px; color: var(--text-secondary); font-weight: 600;">Quick Presets:</span>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
                <span class="id-preset-chip" onclick="applyIdPreset('ID and signatures verified and approved.')">✓ ID & Signatures Verified</span>
                <span class="id-preset-chip" onclick="applyIdPreset('Signature is missing or unclear on the Back ID image. Please re-upload.')">⚠ Signature Missing</span>
                <span class="id-preset-chip" onclick="applyIdPreset('ID photo is blurred, obscured, or illegible. Please provide a clear scan.')">⚠ Blurred Photo</span>
                <span class="id-preset-chip" onclick="applyIdPreset('Submitted ID appears expired or invalid for this academic year.')">⚠ Expired / Invalid ID</span>
            </div>

            <textarea id="id-remarks" placeholder="Enter administrative notes or document resubmission instructions..." 
                      style="width: 100%; height: 75px; padding: 12px 14px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--surface-color); color: var(--text-primary); font-family: inherit; font-size: 12px; font-weight: 500; resize: none; margin-bottom: 16px; outline: none; transition: border-color 0.2s;"
                      onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='var(--border-color)'">${currentRemarks}</textarea>

            <!-- Verification Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Mark Verified Button -->
                <button class="btn id-action-btn" 
                        style="width: 100%; background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 800;" 
                        onclick="updateIdStatus('Verified')">
                    <i class="icon-check-circle" style="font-size: 16px;"></i> Approve ID & Signature
                </button>

                <!-- Mark Missing Button -->
                <button class="btn btn-outline id-action-btn" 
                        style="width: 100%; border: 1.5px solid #F97316; color: #EA580C; background: rgba(249, 115, 22, 0.05); padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 800;" 
                        onclick="updateIdStatus('Missing')">
                    <i class="icon-alert-circle" style="font-size: 15px;"></i> Request Resubmission (Missing)
                </button>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}

// ── Queue Navigation & Presets ──────────────────────────────────────
window.selectIdStudent = function (index) {
    selectedIndex = index;
    renderQueue();
    renderPanel();
};

window.navigateIdQueue = function (direction) {
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < filteredIdStudents.length) {
        selectIdStudent(nextIndex);
    }
};

window.applyIdPreset = function (presetText) {
    const textarea = document.getElementById('id-remarks');
    if (textarea) {
        textarea.value = presetText;
        textarea.focus();
    }
};

// ── Lightbox Preview ────────────────────────────────────────────────
window.openIdLightbox = function (url, caption = '') {
    const modal = document.getElementById('id-lightbox-modal');
    const img = document.getElementById('id-lightbox-img');
    const cap = document.getElementById('id-lightbox-caption');
    if (modal && img) {
        img.src = url;
        if (cap) cap.textContent = caption || 'Student ID Card Preview';
        modal.style.display = 'flex';
    }
};

window.closeIdLightbox = function () {
    const modal = document.getElementById('id-lightbox-modal');
    if (modal) modal.style.display = 'none';
};

// ── Update ID Validation Status ─────────────────────────────────────
window.updateIdStatus = async function (newStatus, isFinalRejection = false) {
    if (isUpdating) return;
    const s = filteredIdStudents[selectedIndex];
    if (!s || !s.uid) return;

    const remarks = (document.getElementById('id-remarks')?.value || '').trim();

    isUpdating = true;
    try {
        // 1. Update ID Validation Status (stored inside documents JSON)
        const currentDocs = s.documents || {};
        const updatedDocs = { ...currentDocs, idValidationStatus: newStatus };

        const updatePayload = {
            documents: updatedDocs,
            adminRemarks: remarks,
            requiresResubmission: !isFinalRejection && (newStatus === 'Missing' || newStatus === 'Rejected'),
            updatedAt: new Date().toISOString()
        };

        // Auto-calculate overall status:
        // Only set global status to Verified when BOTH SA and ID are verified
        const currentSaStatus = currentDocs.saVerificationStatus || 'Pending';
        if (newStatus === 'Verified' && (currentSaStatus === 'Verified' || currentSaStatus === 'Approved')) {
            updatePayload.status = 'Verified';
        } else if (newStatus === 'Missing' || newStatus === 'Rejected') {
            updatePayload.status = newStatus;
        }

        const { error } = await supabase.from('students').update(updatePayload).eq('uid', s.uid);
        if (error) throw error;

        // 2. Audit Log
        await supabase.from('audit_logs').insert([{
            adminId: (await supabase.auth.getUser()).data.user?.id || 'unknown',
            adminName: 'Admin',
            action: `Validated student ID: ${newStatus}`,
            targetUser: s.uid,
            timestamp: new Date().toISOString()
        }]);

        // 3. Notification
        let title = '';
        let message = '';
        let type = 'info';

        if (newStatus === 'Verified') {
            title = 'ID Validation Approved';
            message = 'Your ID Front & Back + Signature document has been approved.';
            type = 'success';
        } else if (newStatus === 'Missing') {
            title = 'ID Validation Missing';
            message = remarks
                ? `Your submitted ID Front & Back + Signature document requires revision. Please review the feedback provided by the administrator: ${remarks}`
                : 'Your submitted ID Front & Back + Signature document requires revision. Please review the feedback provided by the administrator.';
            type = 'warning';
        } else {
            title = 'ID Validation Rejected';
            message = remarks
                ? `Your ID Front & Back + Signature document has been rejected. Feedback: ${remarks}`
                : 'Your ID Front & Back + Signature document has been rejected.';
            type = 'error';
        }

        await supabase.from('notifications').insert([{
            studentId: s.uid,
            title: title,
            message: message,
            type: type,
            isRead: false,
            timestamp: new Date().toISOString()
        }]);

        if (window.showToast) {
            window.showToast(`Updated ${s.fullName || 'student'} to ${newStatus}.`, 'check-circle');
        } else {
            alert(`Student ${s.fullName} status updated to ${newStatus}.`);
        }

        await loadIdQueue();

    } catch (e) {
        console.error('Error updating status:', e);
        alert('Failed to update student verification: ' + (e.message || e));
    } finally {
        isUpdating = false;
    }
};

// ── Bulk Download of Student ID Validation Documents ──────────────────
function formatStudentFolderName(student) {
    let namePart = '';
    if (student.lastName && student.firstName) {
        namePart = `${student.lastName.trim()}_${student.firstName.trim()}`;
    } else if (student.fullName) {
        let parts = student.fullName.split(',');
        if (parts.length === 2) {
            namePart = `${parts[0].trim()}_${parts[1].trim()}`;
        } else {
            namePart = student.fullName.trim().replace(/\s+/g, '_');
        }
    } else {
        namePart = 'Student';
    }
    const idPart = student.studentId || student.id || student.uid || 'NoID';
    const rawName = `${namePart}_${idPart}`;
    // Sanitize to create safe folder names in ZIP
    return rawName.replace(/[\\/:*?"<>|]/g, '_');
}

function updateBulkDownloadProgress(percent, subtitleText, titleText = 'Compiling ZIP Archive...', stageText = 'Processing...') {
    const modal = document.getElementById('bulk-download-modal');
    const titleEl = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    const barEl = document.getElementById('modal-progress-bar');
    const pctEl = document.getElementById('modal-percentage');
    const actionsEl = document.getElementById('modal-actions');
    const stageEl = document.getElementById('modal-stage-text');

    if (modal) modal.style.display = 'flex';
    if (titleEl) titleEl.textContent = titleText;
    if (subtitleEl) subtitleEl.textContent = subtitleText;
    if (stageEl) stageEl.textContent = stageText;
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (pctEl) pctEl.textContent = `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
    if (actionsEl) actionsEl.style.display = percent >= 100 ? 'flex' : 'none';
}

window.closeBulkDownloadModal = function () {
    const modal = document.getElementById('bulk-download-modal');
    if (modal) modal.style.display = 'none';
};

window.downloadAllIdDocuments = async function () {
    const btn = document.getElementById('bulk-download-btn');
    const JSZip = window.JSZip;
    const saveAs = window.saveAs || window.FileSaver?.saveAs;

    if (!JSZip) {
        alert('ZIP utility (JSZip) is not loaded. Please refresh the page and try again.');
        return;
    }
    if (!saveAs) {
        alert('FileSaver utility is not loaded. Please refresh the page and try again.');
        return;
    }

    try {
        if (btn) btn.disabled = true;

        updateBulkDownloadProgress(5, 'Fetching student records from database...', 'Compiling ZIP Archive...', 'Step 1/4 • Database Query');

        // Fetch all students from database
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
        const allStudents = res.data;

        // Filter students who have uploaded PDF document requirements
        const eligibleStudents = (allStudents || []).filter(s => {
            const pdfUrl = s.submissionPdfUrl || (s.documents && s.documents.submissionPdfUrl);
            return !!pdfUrl;
        });

        if (eligibleStudents.length === 0) {
            window.closeBulkDownloadModal();
            if (window.showToast) {
                window.showToast('No student PDF documents available to download.', 'alert-circle');
            } else {
                alert('No student PDF documents available to download.');
            }
            return;
        }

        updateBulkDownloadProgress(12, `Found ${eligibleStudents.length} student document(s). Preparing stream...`, 'Compiling ZIP Archive...', 'Step 2/4 • Fetching Files');

        const zip = new JSZip();
        let successCount = 0;
        let failedCount = 0;
        const total = eligibleStudents.length;

        // Fetch files in controlled batches of 5 for optimal performance
        const BATCH_SIZE = 5;
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = eligibleStudents.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (student) => {
                const pdfUrl = student.submissionPdfUrl || (student.documents && student.documents.submissionPdfUrl);
                const folderName = formatStudentFolderName(student);
                const fileName = student.submissionPdfName || 'ID Front & Back + Signatures.pdf';

                try {
                    const response = await fetch(pdfUrl);
                    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
                    const pdfBlob = await response.blob();

                    const studentFolder = zip.folder(folderName);
                    studentFolder.file(fileName, pdfBlob);
                    successCount++;
                } catch (err) {
                    console.error(`Error fetching PDF for student ${folderName}:`, err);
                    failedCount++;
                }
            }));

            const processed = Math.min(i + BATCH_SIZE, total);
            const progressPct = 12 + Math.round((processed / total) * 63); // 12% to 75%
            updateBulkDownloadProgress(progressPct, `Downloading documents: ${processed} of ${total}...`, 'Compiling ZIP Archive...', `Step 2/4 • Downloading (${processed}/${total})`);
        }

        if (successCount === 0) {
            updateBulkDownloadProgress(100, 'Could not retrieve any PDF files.', 'Download Failed', 'Failed');
            if (window.showToast) window.showToast('Failed to download student document files.', 'alert-circle');
            return;
        }

        // Generate ZIP archive
        updateBulkDownloadProgress(78, 'Compressing documents into ZIP archive...', 'Compiling ZIP Archive...', 'Step 3/4 • Compressing ZIP');
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            const compPercent = 78 + Math.round((metadata.percent / 100) * 18); // 78% to 96%
            updateBulkDownloadProgress(compPercent, `Compressing archive: ${Math.round(metadata.percent)}%...`, 'Compiling ZIP Archive...', `Step 3/4 • Compressing (${Math.round(metadata.percent)}%)`);
        });

        updateBulkDownloadProgress(98, 'Saving ZIP file to your computer...', 'Finalizing Archive', 'Step 4/4 • Saving File');
        saveAs(zipBlob, 'Student_ID_Validation_Documents.zip');

        // Finalize notification
        const statusMsg = failedCount > 0
            ? `Successfully archived ${successCount} document(s). ${failedCount} file(s) could not be retrieved.`
            : `All ${successCount} student PDF document(s) compiled into ZIP archive.`;

        updateBulkDownloadProgress(100, statusMsg, 'Download Ready!', 'Completed');

        if (window.showToast) {
            window.showToast(`ZIP generated for ${successCount} student(s).`, 'check-circle');
        }

        // Audit Log
        try {
            await supabase.from('audit_logs').insert([{
                adminId: (await supabase.auth.getUser()).data.user?.id || 'unknown',
                adminName: 'Admin',
                action: `Bulk downloaded ${successCount} student ID validation documents ZIP`,
                timestamp: new Date().toISOString()
            }]);
        } catch (_) { }

    } catch (err) {
        console.error('Bulk download error:', err);
        updateBulkDownloadProgress(100, `An error occurred: ${err.message || err}`, 'Error', 'Failed');
        if (window.showToast) {
            window.showToast('Bulk download failed.', 'alert-circle');
        }
    } finally {
        if (btn) btn.disabled = false;
    }
};

// Global Exposure for admin router
window.loadIdQueue = loadIdQueue;
window.filterIdQueue = filterIdQueue;

// Init
loadIdQueue();
