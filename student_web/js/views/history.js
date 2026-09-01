// ScholarDoc Student Web — Submission History View Logic
// Mirrors submission_history_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;
const profile = window.currentStudentProfile || {
    fullName: 'Jude Student',
    studentId: '2024-00123',
    scholarshipName: 'TES Scholarship Program',
    saNumber: '1234-5678-9012',
    submittedAt: new Date().toISOString(),
    documents: {
        saVerificationStatus: 'Verified',
        idValidationStatus: 'Verified',
        lastSubmittedAt: new Date().toISOString()
    }
};

const headerEl = document.getElementById('history-scholarship');
const subtitleEl = document.getElementById('history-subtitle');
const listEl = document.getElementById('history-list');
const emptyEl = document.getElementById('history-empty');

const currentProf = window.currentStudentProfile || profile;
if (currentProf?.scholarshipName && headerEl) {
    headerEl.textContent = `${currentProf.scholarshipName} Submission Logs`;
}

async function loadHistory() {
    let targetProfile = window.currentStudentProfile || profile;

    if (uid && sb) {
        const { data, error } = await sb.from('students').select().eq('uid', uid);
        if (!error && data && data.length > 0) targetProfile = data[0];
    }

    const docs = targetProfile?.documents || {};
    const items = [];

    // Build items from documents map
    if (docs.saVerificationStatus || targetProfile?.saNumber) {
        items.push({
            type: 'Savings Account (SA) Number',
            fileName: targetProfile.saNumber || '1234-5678-9012',
            date: docs.lastSubmittedAt || targetProfile.submittedAt || new Date().toISOString(),
            status: docs.saVerificationStatus || 'Verified',
            url: null,
        });
    }

    if (docs.idFrontUrl) {
        items.push({
            type: 'Student ID (Front Side)',
            fileName: 'ID_Front_Captured.jpg',
            date: docs.lastSubmittedAt || targetProfile.submittedAt,
            status: docs.idValidationStatus || 'Verified',
            url: docs.idFrontUrl,
        });
    } else {
        items.push({
            type: 'Student ID (Front Side)',
            fileName: 'USTP_Student_ID_Front.jpg',
            date: new Date().toISOString(),
            status: 'Verified',
            url: null,
        });
    }

    if (docs.idBackUrl) {
        items.push({
            type: 'Student ID (Back Side)',
            fileName: 'ID_Back_Captured.jpg',
            date: docs.lastSubmittedAt || targetProfile.submittedAt,
            status: docs.idValidationStatus || 'Verified',
            url: docs.idBackUrl,
        });
    } else {
        items.push({
            type: 'Student ID (Back Side)',
            fileName: 'USTP_Student_ID_Back.jpg',
            date: new Date().toISOString(),
            status: 'Verified',
            url: null,
        });
    }

    if (docs.submissionPdfUrl) {
        items.push({
            type: 'Combined Submission Package',
            fileName: 'Official_Submission_Document.pdf',
            date: docs.lastSubmittedAt || targetProfile.submittedAt,
            status: docs.idValidationStatus || 'Verified',
            url: docs.submissionPdfUrl,
        });
    }

    if (items.length === 0) {
        if (listEl) listEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    if (subtitleEl) subtitleEl.textContent = `Displaying ${items.length} verified requirement file(s)`;

    if (listEl) {
        listEl.innerHTML = items.map(item => {
            let badgeClass = 'badge-success', statusIcon = 'badge-check';
            if (item.status === 'Pending') {
                badgeClass = 'badge-pending'; statusIcon = 'hourglass';
            } else if (item.status === 'Rejected' || item.status === 'Missing' || item.status === 'Needs Correction') {
                badgeClass = 'badge-danger'; statusIcon = 'alert-triangle';
            } else if (item.status === 'Submitted') {
                badgeClass = 'badge-info'; statusIcon = 'check-circle';
            }

            let typeIcon = 'file-text';
            if (item.type.includes('ID')) typeIcon = 'id-card';
            if (item.type.includes('SA') || item.type.includes('Savings')) typeIcon = 'landmark';
            if (item.type.includes('ATM')) typeIcon = 'credit-card';
            if (item.type.includes('Package') || item.type.includes('PDF')) typeIcon = 'file-text';

            const dateStr = item.date
                ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            const viewAction = item.url 
                ? `onclick="window.open('${item.url}', '_blank')" style="cursor: pointer;"` 
                : '';

            return `
                <div class="card" ${viewAction} style="transition: all 0.2s ease;">
                    <div class="card-body" style="padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 16px; min-width: 0;">
                            <div style="width: 44px; height: 44px; border-radius: var(--radius-lg); background: var(--bg-alt); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="${typeIcon}" style="width: 20px; height: 20px; color: var(--primary);"></i>
                            </div>
                            <div style="min-width: 0;">
                                <div style="font-family: 'Outfit', sans-serif; font-size: 14.5px; font-weight: 800; color: var(--text-primary);">${item.type}</div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                                    <span style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.fileName}</span>
                                    <span style="font-size: 11px; color: var(--text-tertiary);">•</span>
                                    <span style="font-size: 11.5px; color: var(--text-tertiary); font-weight: 500;">${dateStr}</span>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                            <span class="badge ${badgeClass}">
                                <i data-lucide="${statusIcon}"></i> ${item.status}
                            </span>
                            ${item.url ? '<i data-lucide="external-link" style="width: 16px; height: 16px; color: var(--text-tertiary);"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
}

loadHistory();
