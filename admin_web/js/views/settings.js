// js/views/settings.js
const supabase = window.supabaseClient;

// ── State ───────────────────────────────────────────────────────────
let fixingTypo = false;
let migratingData = false;
let resettingReqs = false;
let deduplicating = false;
let clearingSubmission = false;

// ── Auth Diagnostics ────────────────────────────────────────────────
(async function loadDiagnostics() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        document.getElementById('diag-uid').textContent = user?.id || 'Not Logged In';
        document.getElementById('diag-email').textContent = user?.email || 'N/A';
    } catch (e) {
        document.getElementById('diag-uid').textContent = 'Error';
        document.getElementById('diag-email').textContent = 'Error';
    }
})();

// ── Submissions Diagnostics ─────────────────────────────────────────
async function loadSubmissionsDiagnostics() {
    const container = document.getElementById('duplicate-status-container');
    try {
        const { data: students, error } = await supabase.from('students').select('*');
        if (error) throw error;

        // Filter students who have saNumber or submissionPdfUrl
        const submittedDocs = (students || []).filter(data => {
            const sa = data.saNumber || data.familyDetails?.saNumber;
            const hasSa = sa && sa.toString().trim() && sa.toString().trim() !== 'N/A';
            const hasPdf = data.submissionPdfUrl && data.submissionPdfUrl.toString().trim();
            return hasSa || hasPdf;
        });

        if (submittedDocs.length === 0) {
            container.innerHTML = `<span>No active student submissions found in the database.</span>`;
            return;
        }

        // Find Krisha's submissions
        let krishaSa = null, krishaPdf = null;
        for (const data of submittedDocs) {
            const name = (data.fullName || '').toLowerCase();
            if (name.includes('krisha')) {
                krishaSa = (data.saNumber || data.familyDetails?.saNumber)?.toString().trim();
                krishaPdf = data.submissionPdfUrl?.toString().trim();
                break;
            }
        }

        // Check duplicates
        let hasDuplicates = false;
        if (krishaSa || krishaPdf) {
            for (const data of submittedDocs) {
                const name = data.fullName || '';
                if (!name.toLowerCase().includes('krisha')) {
                    const sa = (data.saNumber || data.familyDetails?.saNumber)?.toString().trim();
                    const pdf = data.submissionPdfUrl?.toString().trim();
                    if (krishaSa && krishaSa.length > 0 && sa === krishaSa) hasDuplicates = true;
                    if (krishaPdf && krishaPdf.length > 0 && pdf === krishaPdf) hasDuplicates = true;
                }
            }
        }

        // Build HTML
        let headerHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                    <div style="font-weight: 700; font-size: 14px;">Requirements Submission Diagnostics</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Real-time overview of active submissions to detect and clean duplicates.</div>
                </div>
                ${hasDuplicates ? `<button class="btn" id="btn-auto-dedup" style="background: var(--warning, #FFA726); color: black; border: none; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                    <i class="icon-sparkles" style="font-size: 12px;"></i> Auto-Deduplicate
                </button>` : ''}
            </div>
        `;

        let rowsHtml = submittedDocs.map(data => {
            const uid = data.uid || '';
            const name = data.fullName || 'N/A';
            const email = data.email || 'N/A';
            const sa = (data.saNumber || data.familyDetails?.saNumber)?.toString().trim() || 'None';
            const pdf = data.submissionPdfUrl ? data.submissionPdfUrl.split('/').pop().split('?')[0] : 'None';
            const status = data.status || 'Pending';

            const isKrisha = name.toLowerCase().includes('krisha');
            let isDuplicate = false;
            if (!isKrisha) {
                if (krishaSa && krishaSa.length > 0 && sa === krishaSa) isDuplicate = true;
                if (krishaPdf && krishaPdf.length > 0 && pdf === krishaPdf) isDuplicate = true;
            }

            let bgColor = 'transparent';
            let borderColor = 'transparent';
            if (isDuplicate) { bgColor = 'rgba(239,83,80,0.05)'; borderColor = 'rgba(239,83,80,0.2)'; }
            else if (isKrisha) { bgColor = 'rgba(67,160,71,0.05)'; borderColor = 'rgba(67,160,71,0.2)'; }

            let badges = '';
            if (isKrisha) badges += `<span style="background: var(--success); color: white; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">TARGET USER</span>`;
            if (isDuplicate) badges += `<span style="background: var(--error); color: white; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">DUPLICATE DATA</span>`;

            return `
                <div style="padding: 12px; border-radius: 8px; background: ${bgColor}; border: 1px solid ${borderColor}; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="display: flex; align-items: center;">
                                <span style="font-weight: 700; font-size: 13px;">${name}</span>
                                ${badges}
                            </div>
                            <div style="font-size: 11px; color: var(--text-secondary);">${email}</div>
                        </div>
                        ${!isKrisha ? `<button class="btn btn-outline" style="font-size: 11px; padding: 4px 8px; color: var(--error); border-color: var(--error);" onclick="clearSubmission('${uid}', '${name.replace(/'/g, "\\'")}')">
                            <i class="icon-trash-2" style="font-size: 12px;"></i> Reset Submission
                        </button>` : ''}
                    </div>
                    <div style="margin-top: 8px; font-size: 11px;">
                        <div><strong>SA Number:</strong> <span style="font-family: monospace; color: var(--text-secondary);">${sa}</span></div>
                        <div style="margin-top: 2px;"><strong>PDF URL:</strong> <span style="font-family: monospace; color: var(--text-secondary);">${pdf}</span></div>
                        <div style="margin-top: 2px;"><strong>Status:</strong> <span style="font-family: monospace; color: var(--text-secondary);">${status}</span></div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = headerHtml + rowsHtml;
        container.style.fontStyle = 'normal';
        container.style.textAlign = 'left';

        // Bind dedup button
        const dedupBtn = document.getElementById('btn-auto-dedup');
        if (dedupBtn) {
            dedupBtn.addEventListener('click', () => autoDeduplicate(submittedDocs, krishaSa, krishaPdf));
        }

        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error('Error loading submissions diagnostics:', e);
        container.textContent = 'Failed to load submissions diagnostics.';
    }
}

loadSubmissionsDiagnostics();

// ── Fix Spelling Errors ─────────────────────────────────────────────
document.getElementById('btn-fix-typo').addEventListener('click', async function() {
    if (fixingTypo) return;
    fixingTypo = true;
    const btn = this;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Processing...';
    btn.disabled = true;

    try {
        // Fix scholarship table: rename STUFAH → STUFAP
        const { data: scholarships } = await supabase.from('scholarships').select('id, name');
        let sCount = 0;
        for (const s of (scholarships || [])) {
            if (s.name && s.name.includes('STUFAH')) {
                await supabase.from('scholarships').update({ name: s.name.replace(/STUFAH/g, 'STUFAP') }).eq('id', s.id);
                sCount++;
            }
        }

        // Fix student table: scholarshipProgram field
        const { data: students } = await supabase.from('students').select('uid, scholarshipProgram');
        let aCount = 0;
        for (const st of (students || [])) {
            if (st.scholarshipProgram && st.scholarshipProgram.includes('STUFAH')) {
                await supabase.from('students').update({ scholarshipProgram: st.scholarshipProgram.replace(/STUFAH/g, 'STUFAP') }).eq('uid', st.uid);
                aCount++;
            }
        }

        alert(`Repair Complete: Fixed ${sCount} scholarship and ${aCount} student records.`);
    } catch (e) {
        console.error('Spelling repair failed:', e);
        alert('Repair Failed: ' + e.message);
    } finally {
        fixingTypo = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="icon-wrench"></i> Run spelling repair';
    }
});

// ── Data Migration ──────────────────────────────────────────────────
document.getElementById('btn-migrate-data').addEventListener('click', async function() {
    if (migratingData) return;
    migratingData = true;
    const btn = this;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Migrating...';
    btn.disabled = true;

    try {
        const { data: students } = await supabase.from('students').select('*');
        let count = 0;
        const femaleNames = ['krisha', 'maria', 'anna', 'jane', 'rose', 'grace', 'faith', 'joy', 'princess', 'angel', 'mary', 'ella', 'lyn'];

        for (const st of (students || [])) {
            const updates = {};
            if (!st.gender) {
                const firstName = (st.fullName || '').split(' ')[0].toLowerCase();
                updates.gender = femaleNames.some(n => firstName.includes(n)) ? 'Female' : 'Male';
            }
            if (!st.scholarYearLevel) updates.scholarYearLevel = '1st Year';
            if (st.payoutsReceived == null) updates.payoutsReceived = 0;
            if (!st.familyDetails?.fatherEduStatus) {
                updates.familyDetails = {
                    ...(st.familyDetails || {}),
                    fatherEduStatus: 'Non-graduate',
                    motherEduStatus: 'Non-graduate'
                };
            }
            if (Object.keys(updates).length > 0) {
                await supabase.from('students').update(updates).eq('uid', st.uid);
                count++;
            }
        }
        alert(`Migration Complete: Updated ${count} student records with default values.`);
    } catch (e) {
        console.error('Migration failed:', e);
        alert('Migration Failed: ' + e.message);
    } finally {
        migratingData = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="icon-play-circle"></i> Run data migration';
    }
});

// ── Reset Requirements ──────────────────────────────────────────────
document.getElementById('btn-reset-reqs').addEventListener('click', async function() {
    if (resettingReqs) return;
    resettingReqs = true;
    const btn = this;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Resetting...';
    btn.disabled = true;

    try {
        const { data: scholarships } = await supabase.from('scholarships').select('id');
        const standardDocs = ['SA Number', 'ID Front & Back + Signatures (PDF)'];
        let count = 0;
        for (const s of (scholarships || [])) {
            await supabase.from('scholarships').update({ requiredDocuments: standardDocs }).eq('id', s.id);
            count++;
        }
        alert(`Reset Complete: Overwrote requirements for ${count} scholarship programs.`);
    } catch (e) {
        console.error('Reset failed:', e);
        alert('Reset Failed: ' + e.message);
    } finally {
        resettingReqs = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="icon-refresh-cw"></i> Reset all programs requirements';
    }
});

// ── Clear Submission ────────────────────────────────────────────────
window.clearSubmission = async function(uid, name) {
    if (clearingSubmission) return;
    if (!confirm(`Reset submission data for ${name}? This will clear their SA number and PDF.`)) return;
    clearingSubmission = true;

    try {
        await supabase.from('students').update({
            saNumber: null,
            submissionPdfUrl: null,
            submissionPdfName: null,
            pdfVerified: false,
            submittedAt: null,
            status: 'Missing',
            requiresResubmission: true,
        }).eq('uid', uid);
        alert(`Cleared requirements submission for ${name}.`);
        loadSubmissionsDiagnostics();
    } catch (e) {
        alert('Failed to reset submission: ' + e.message);
    } finally {
        clearingSubmission = false;
    }
};

// ── Auto-Deduplicate ────────────────────────────────────────────────
async function autoDeduplicate(docs, krishaSa, krishaPdf) {
    if (deduplicating) return;
    deduplicating = true;
    const btn = document.getElementById('btn-auto-dedup');
    if (btn) { btn.innerHTML = 'Cleaning...'; btn.disabled = true; }

    try {
        let count = 0;
        for (const data of docs) {
            const name = data.fullName || '';
            const isKrisha = name.toLowerCase().includes('krisha');
            if (!isKrisha && data.uid) {
                const sa = (data.saNumber || data.familyDetails?.saNumber)?.toString().trim();
                const pdf = data.submissionPdfUrl?.toString().trim();
                let isDuplicate = false;
                if (krishaSa && krishaSa.length > 0 && sa === krishaSa) isDuplicate = true;
                if (krishaPdf && krishaPdf.length > 0 && pdf === krishaPdf) isDuplicate = true;

                if (isDuplicate) {
                    await supabase.from('students').update({
                        saNumber: null,
                        submissionPdfUrl: null,
                        submissionPdfName: null,
                        pdfVerified: false,
                        submittedAt: null,
                        status: 'Missing',
                        requiresResubmission: true,
                    }).eq('uid', data.uid);
                    count++;
                }
            }
        }

        if (count > 0) {
            alert(`Successfully deduplicated database! Reset ${count} duplicate records.`);
        } else {
            alert('No duplicate records detected.');
        }
        loadSubmissionsDiagnostics();
    } catch (e) {
        alert('Deduplication failed: ' + e.message);
    } finally {
        deduplicating = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="icon-sparkles" style="font-size: 12px;"></i> Auto-Deduplicate'; }
    }
}

console.log("Settings view loaded.");
