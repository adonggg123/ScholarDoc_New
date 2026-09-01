// ScholarDoc Student Web — Status Tracking View Logic
// Mirrors status_tracking_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;

async function initStatusView() {
    if (uid && sb) {
        sb.channel(`status-${uid}`).on('postgres_changes', {
            event: '*', schema: 'public', table: 'students', filter: `uid=eq.${uid}`
        }, () => { loadStatusData(); }).subscribe();
    }
    await loadStatusData();
}

async function loadStatusData() {
    let student = null;
    if (uid && sb) {
        const { data, error } = await sb.from('students').select().eq('uid', uid);
        if (!error && data && data.length > 0) student = data[0];
    }
    if (!student) {
        student = window.currentStudentProfile || {
            fullName: 'Jude Student',
            scholarshipName: 'TES Scholarship Program',
            status: 'Verified',
            documents: {
                saVerificationStatus: 'Verified',
                idValidationStatus: 'Verified'
            },
            adminRemarks: 'All requirements verified by the University Scholarship Committee. Eligible for upcoming disbursement batch.'
        };
    }

    const status = student.status || 'Verified';
    const scholarshipName = student.scholarshipName || 'TES Scholarship Program';
    const scholarshipId = student.scholarshipId || '';
    const docs = (typeof student.documents === 'object' && student.documents) ? student.documents : {};
    const saVerificationStatus = docs.saVerificationStatus || (status === 'Verified' ? 'Verified' : 'Pending');
    const idValidationStatus = docs.idValidationStatus || (status === 'Verified' ? 'Verified' : 'Pending');
    const requiresResubmission = student.requiresResubmission === true;
    const adminRemarks = student.adminRemarks || 'Documents have been verified and endorsed for scholarship disbursement.';

    // Update header
    const nameEl = document.getElementById('status-scholarship-name');
    if (nameEl) nameEl.textContent = scholarshipName;

    // Status badge
    let badgeClass = 'badge-success', statusIcon = 'check-circle', statusLabel = 'Verified';
    if (status === 'Pending') {
        badgeClass = 'badge-pending'; statusIcon = 'hourglass'; statusLabel = 'Under Review';
    } else if (status === 'Rejected' || status === 'Missing') {
        badgeClass = 'badge-danger'; statusIcon = 'x-circle'; statusLabel = status;
    }

    const badgeEl = document.getElementById('status-overall-badge');
    if (badgeEl) {
        badgeEl.className = `badge ${badgeClass}`;
        badgeEl.innerHTML = `
            <i data-lucide="${statusIcon}"></i>
            <span>${statusLabel}</span>
        `;
    }

    // Requirements list
    const requirements = [
        'Savings Account (SA) Number',
        'Student ID Card (Front Side)',
        'Student ID Card (Back Side)',
        'Digital Specimen Signature'
    ];

    // Calculate progress
    let verifiedCount = 0;
    requirements.forEach(req => {
        if (isReqVerified(req, saVerificationStatus, idValidationStatus, docs)) verifiedCount++;
    });

    const progressValue = requirements.length > 0 ? (verifiedCount / requirements.length) * 100 : 100;
    let progressLabel = `${verifiedCount} of ${requirements.length} verified (100%)`;
    if (verifiedCount < requirements.length) {
        progressLabel = `${verifiedCount} of ${requirements.length} verified`;
    }
    if (requiresResubmission) {
        progressLabel = `Resubmission Required (${verifiedCount} of ${requirements.length} verified)`;
    }

    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    const progressLabelEl = document.getElementById('progress-label');
    if (progressBar) progressBar.style.width = `${progressValue}%`;
    if (progressLabelEl) progressLabelEl.textContent = progressLabel;

    // Resubmission alert
    const alertEl = document.getElementById('resubmission-alert');
    if (alertEl) alertEl.classList.toggle('hidden', !requiresResubmission);

    // Requirements list render
    const listEl = document.getElementById('requirements-list');
    if (listEl) {
        listEl.innerHTML = requirements.map(req => {
            const verified = isReqVerified(req, saVerificationStatus, idValidationStatus, docs);
            const reqStatus = getReqStatus(req, saVerificationStatus, idValidationStatus, docs);
            
            let badgeClass = 'badge-success', statusIcon = 'check-circle', statusText = 'Verified';
            if (!verified) {
                if (reqStatus === 'Rejected' || reqStatus === 'Missing' || reqStatus === 'Needs Correction') {
                    badgeClass = 'badge-danger'; statusIcon = 'alert-triangle'; statusText = reqStatus;
                } else {
                    badgeClass = 'badge-pending'; statusIcon = 'clock'; statusText = 'Pending';
                }
            }

            let reqIcon = 'file-text';
            if (req.includes('SA') || req.includes('Savings')) reqIcon = 'landmark';
            if (req.includes('Front') || req.includes('Back') || req.includes('ID')) reqIcon = 'id-card';
            if (req.includes('Signature')) reqIcon = 'pen-tool';

            return `
                <div class="card" style="transition: all 0.2s ease;">
                    <div class="card-body" style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <div style="width: 42px; height: 42px; border-radius: var(--radius-lg); background: var(--bg-alt); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="${reqIcon}" style="width: 19px; height: 19px; color: var(--primary);"></i>
                            </div>
                            <div>
                                <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800; color: var(--text-primary);">${req}</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 1px;">Official institutional requirement</div>
                            </div>
                        </div>
                        <span class="badge ${badgeClass}">
                            <i data-lucide="${statusIcon}"></i> ${statusText}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Admin remarks
    const remarksCard = document.getElementById('remarks-card');
    const remarksText = document.getElementById('remarks-text');
    if (remarksCard && adminRemarks) {
        remarksCard.classList.remove('hidden');
        if (remarksText) remarksText.textContent = adminRemarks;
    }

    if (window.lucide) window.lucide.createIcons();
}

function isReqVerified(req, saStatus, idStatus, docs) {
    if (req.includes('SA') || req.includes('Savings')) return saStatus === 'Verified' || saStatus === 'Approved';
    if (req.includes('ID') || req.includes('PDF') || req.includes('Combined') || req.includes('Enrollment') || req.includes('Signature') || req.includes('Front') || req.includes('Back')) {
        return idStatus === 'Verified' || idStatus === 'Approved';
    }
    const key = req.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return !!docs[key];
}

function getReqStatus(req, saStatus, idStatus, docs) {
    if (req.includes('SA') || req.includes('Savings')) return saStatus;
    if (req.includes('ID') || req.includes('PDF') || req.includes('Combined') || req.includes('Enrollment') || req.includes('Signature') || req.includes('Front') || req.includes('Back')) return idStatus;
    return 'Pending';
}

initStatusView();
