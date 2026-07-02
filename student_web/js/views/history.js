// ScholarDoc Student Web — Submission History View Logic
// Mirrors submission_history_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;
const profile = window.currentStudentProfile;

const headerEl = document.getElementById('history-scholarship');
const subtitleEl = document.getElementById('history-subtitle');
const listEl = document.getElementById('history-list');
const emptyEl = document.getElementById('history-empty');

if (profile?.scholarshipName && headerEl) {
    headerEl.textContent = profile.scholarshipName;
}

async function loadHistory() {
    if (!uid || !profile) {
        if (listEl) listEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
        return;
    }

    const docs = profile.documents || {};
    const items = [];

    // Build items from documents map
    if (docs.saVerificationStatus || profile.saNumber) {
        items.push({
            type: 'SA Number',
            fileName: profile.saNumber || 'N/A',
            date: docs.lastSubmittedAt || profile.submittedAt || profile.createdAt,
            status: docs.saVerificationStatus || 'Pending',
            url: null,
        });
    }

    if (docs.idFrontUrl) {
        items.push({
            type: 'ID Front',
            fileName: 'ID Front Image',
            date: docs.lastSubmittedAt || profile.submittedAt,
            status: docs.idValidationStatus || 'Pending',
            url: docs.idFrontUrl,
        });
    }

    if (docs.idBackUrl) {
        items.push({
            type: 'ID Back',
            fileName: 'ID Back Image',
            date: docs.lastSubmittedAt || profile.submittedAt,
            status: docs.idValidationStatus || 'Pending',
            url: docs.idBackUrl,
        });
    }

    if (docs.submissionPdfUrl) {
        items.push({
            type: 'Combined PDF Submission',
            fileName: 'Document Submission PDF',
            date: docs.lastSubmittedAt || profile.submittedAt,
            status: docs.idValidationStatus || 'Pending',
            url: docs.submissionPdfUrl,
        });
    }

    if (docs.atmCardUrl) {
        items.push({
            type: 'ATM Card',
            fileName: 'ATM Card Photo',
            date: docs.lastSubmittedAt || profile.submittedAt,
            status: 'Submitted',
            url: docs.atmCardUrl,
        });
    }

    if (items.length === 0) {
        if (listEl) listEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    if (subtitleEl) subtitleEl.textContent = `${items.length} document(s) submitted`;

    listEl.innerHTML = items.map((item, index) => {
        let statusColor = '#F59E0B', statusIcon = 'hourglass';
        if (item.status === 'Approved' || item.status === 'Verified') {
            statusColor = '#10B981'; statusIcon = 'badge-check';
        } else if (item.status === 'Rejected' || item.status === 'Missing' || item.status === 'Needs Correction') {
            statusColor = '#EF4444'; statusIcon = 'alert-triangle';
        } else if (item.status === 'Submitted') {
            statusColor = '#3B82F6'; statusIcon = 'check-circle';
        }

        let typeIcon = 'file-text';
        if (item.type.includes('ID')) typeIcon = 'badge-check';
        if (item.type.includes('SA')) typeIcon = 'landmark';
        if (item.type.includes('ATM')) typeIcon = 'credit-card';
        if (item.type.includes('PDF')) typeIcon = 'file-text';

        const dateStr = item.date
            ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A';

        const viewAction = item.url 
            ? `onclick="window.open('${item.url}', '_blank')" style="cursor: pointer;"` 
            : '';

        return `
            <div class="card" style="margin-bottom: 12px;" ${viewAction}>
                <div class="card-body" style="padding: 16px 18px; display: flex; align-items: center; gap: 14px;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(15,50,96,0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${typeIcon}" style="width: 20px; height: 20px; color: var(--primary-color);"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${item.type}</div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.fileName}</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">•</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">${dateStr}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; background: ${statusColor}12; flex-shrink: 0;">
                        <i data-lucide="${statusIcon}" style="width: 13px; height: 13px; color: ${statusColor};"></i>
                        <span style="font-size: 11px; font-weight: 700; color: ${statusColor};">${item.status}</span>
                    </div>
                    ${item.url ? '<i data-lucide="external-link" style="width: 16px; height: 16px; color: var(--text-secondary); opacity: 0.4; flex-shrink: 0;"></i>' : ''}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

loadHistory();
