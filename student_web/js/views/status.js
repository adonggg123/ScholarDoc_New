// ScholarDoc Student Web — Status Tracking View Logic
// Mirrors status_tracking_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;

async function initStatusView() {
    if (!uid) return;

    // Subscribe to real-time student changes
    const channel = sb.channel(`status-${uid}`).on('postgres_changes', {
        event: '*', schema: 'public', table: 'students', filter: `uid=eq.${uid}`
    }, () => { loadStatusData(); }).subscribe();

    await loadStatusData();
}

async function loadStatusData() {
    const { data, error } = await sb.from('students').select().eq('uid', uid);
    if (error || !data || data.length === 0) return;

    const student = data[0];
    const status = student.status || 'Pending';
    const scholarshipName = student.scholarshipName || 'No Scholarship Assigned';
    const scholarshipId = student.scholarshipId || '';
    const docs = (typeof student.documents === 'object' && student.documents) ? student.documents : {};
    const saVerificationStatus = docs.saVerificationStatus || 'Pending';
    const idValidationStatus = docs.idValidationStatus || 'Pending';
    const requiresResubmission = student.requiresResubmission === true;
    const adminRemarks = student.adminRemarks;

    // Update header
    const nameEl = document.getElementById('status-scholarship-name');
    if (nameEl) nameEl.textContent = scholarshipName;

    // Status badge
    let statusColor = '#F59E0B', statusIcon = 'hourglass', statusLabel = 'Under Review';
    if (status === 'Approved' || status === 'Verified') {
        statusColor = '#10B981'; statusIcon = 'check-circle'; statusLabel = status;
    } else if (status === 'Rejected' || status === 'Missing') {
        statusColor = '#EF4444'; statusIcon = 'x-circle'; statusLabel = status;
    }

    const badgeEl = document.getElementById('status-overall-badge');
    if (badgeEl) {
        badgeEl.style.background = `${statusColor}22`;
        badgeEl.innerHTML = `
            <i data-lucide="${statusIcon}" style="width: 14px; height: 14px; color: ${statusColor};"></i>
            <span style="font-size: 12px; font-weight: 800; color: ${statusColor};">${statusLabel}</span>
        `;
    }

    // Get scholarship requirements
    let requirements = ['SA Number', 'ID (Front)', 'ID (Back)', 'Combined PDF Submission'];
    if (scholarshipId) {
        try {
            const { data: scholarship } = await sb.from('scholarships').select().eq('id', scholarshipId);
            if (scholarship && scholarship.length > 0 && scholarship[0].requiredDocuments) {
                requirements = scholarship[0].requiredDocuments;
                // Auto-remap labels
                requirements = requirements.flatMap(doc => {
                    if (doc === 'Enrollment Form' || doc === 'ID Card') {
                        return ['ID (Front)', 'ID (Back)', 'Combined PDF Submission'];
                    }
                    return [doc];
                });
                requirements = [...new Set(requirements)];
            }
        } catch (_) {}
    }

    // Calculate progress
    let verifiedCount = 0;
    requirements.forEach(req => {
        if (isReqVerified(req, saVerificationStatus, idValidationStatus, docs)) verifiedCount++;
    });

    const progressValue = requirements.length > 0 ? (verifiedCount / requirements.length) * 100 : 0;
    let progressLabel = `Awaiting Review (${verifiedCount} of ${requirements.length} verified)`;
    if (verifiedCount === requirements.length && requirements.length > 0) {
        progressLabel = 'All requirements complete';
    } else if (requiresResubmission || saVerificationStatus === 'Missing' || saVerificationStatus === 'Rejected' || idValidationStatus === 'Missing' || idValidationStatus === 'Rejected') {
        progressLabel = `Resubmission Required (${verifiedCount} of ${requirements.length} verified)`;
    }

    // Update progress
    const progressBar = document.getElementById('progress-bar');
    const progressLabelEl = document.getElementById('progress-label');
    if (progressBar) progressBar.style.width = `${progressValue}%`;
    if (progressLabelEl) progressLabelEl.textContent = progressLabel;

    // Resubmission alert
    const alertEl = document.getElementById('resubmission-alert');
    if (alertEl) alertEl.classList.toggle('hidden', !requiresResubmission);

    // Requirements list
    const listEl = document.getElementById('requirements-list');
    if (listEl) {
        listEl.innerHTML = requirements.map(req => {
            const verified = isReqVerified(req, saVerificationStatus, idValidationStatus, docs);
            const reqStatus = getReqStatus(req, saVerificationStatus, idValidationStatus, docs);
            
            let dotColor = '#F59E0B', dotIcon = 'clock', statusText = 'Pending';
            if (verified) {
                dotColor = '#10B981'; dotIcon = 'check-circle'; statusText = 'Verified';
            } else if (reqStatus === 'Rejected' || reqStatus === 'Missing') {
                dotColor = '#EF4444'; dotIcon = 'x-circle'; statusText = reqStatus;
            }

            let reqIcon = 'file-text';
            if (req.includes('SA')) reqIcon = 'landmark';
            if (req.includes('ID')) reqIcon = 'badge-check';
            if (req.includes('PDF') || req.includes('Combined')) reqIcon = 'file-text';
            if (req.includes('ATM')) reqIcon = 'credit-card';

            return `
                <div class="card" style="margin-bottom: 10px;">
                    <div class="card-body" style="padding: 14px 18px; display: flex; align-items: center; gap: 14px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: ${dotColor}10; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="${reqIcon}" style="width: 18px; height: 18px; color: ${dotColor};"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${req}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="${dotIcon}" style="width: 14px; height: 14px; color: ${dotColor};"></i>
                            <span style="font-size: 11px; font-weight: 700; color: ${dotColor};">${statusText}</span>
                        </div>
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
    if (req.includes('SA')) return saStatus === 'Verified' || saStatus === 'Approved';
    if (req.includes('ID') || req.includes('PDF') || req.includes('Combined') || req.includes('Enrollment') || req.includes('Signature')) {
        return idStatus === 'Verified' || idStatus === 'Approved';
    }
    // Check if document URL exists
    const key = req.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return !!docs[key];
}

function getReqStatus(req, saStatus, idStatus, docs) {
    if (req.includes('SA')) return saStatus;
    if (req.includes('ID') || req.includes('PDF') || req.includes('Combined') || req.includes('Enrollment') || req.includes('Signature')) return idStatus;
    return 'Pending';
}

initStatusView();
