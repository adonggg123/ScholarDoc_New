// js/views/sa_verification.js
const supabase = window.supabaseClient;

let saStudents = [];
let selectedIndex = 0;
let isUpdating = false;

// ── Load Data ───────────────────────────────────────────────────────
async function loadSaQueue() {
    try {
        const { data, error } = await supabase.from('students').select('*').order('createdAt', { ascending: false });
        if (error) throw error;

        // Filter students who have submitted SA number
        saStudents = (data || []).filter(s => {
            const sa = s.saNumber || s.familyDetails?.saNumber;
            return sa && sa.toString().trim() !== '' && sa.toString().trim() !== 'N/A';
        });

        if (selectedIndex >= saStudents.length) selectedIndex = 0;

        renderQueue();
        renderPanel();
    } catch (e) {
        console.error('Error loading SA queue:', e);
        document.getElementById('sa-list-container').innerHTML = `<div style="text-align: center; padding: 40px; color: var(--error);">Error loading data.</div>`;
    }
}

// ── Render Queue (Left) ─────────────────────────────────────────────
function renderQueue() {
    const container = document.getElementById('sa-list-container');
    
    if (saStudents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="icon-user-x" style="font-size: 48px; color: #ccc; margin-bottom: 16px; display: block;"></i>
                <div style="color: var(--text-secondary);">No SA verification submissions found.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = saStudents.map((s, index) => {
        const isSelected = index === selectedIndex;
        const name = s.fullName || 'N/A';
        const sa = s.saNumber || s.familyDetails?.saNumber || 'N/A';
        const photo = s.profilePictureUrl || s.profileImageUrl || s.photoUrl || s.photoURL;

        let avatarHtml = '';
        if (photo) {
            avatarHtml = `
                <div style="padding: 2px; border-radius: 50%; border: 2px solid #FBC02D; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex;">
                    <img src="${photo}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                </div>
            `;
        } else {
            avatarHtml = `
                <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(15, 50, 96, 0.05); display: flex; align-items: center; justify-content: center;">
                    <i class="icon-user" style="font-size: 16px; color: var(--primary-color);"></i>
                </div>
            `;
        }

        return `
            <div class="sa-list-item ${isSelected ? 'selected' : ''}" style="padding: 12px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--border-color);" onclick="selectStudent(${index})">
                ${avatarHtml}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-weight: 800; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; color: var(--text-primary);">${name}</div>
                    <div style="font-size: 10px; color: var(--text-secondary); font-weight: 600; margin-top: 2px;">SA: ${sa}</div>
                </div>
                <i class="icon-chevron-right" style="font-size: 18px; color: ${isSelected ? 'var(--primary-color)' : 'rgba(0,0,0,0.2)'};"></i>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ── Render Panel (Right) ────────────────────────────────────────────
function renderPanel() {
    const container = document.getElementById('sa-panel-container');

    if (saStudents.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Select a student to view details.</div>`;
        return;
    }

    const s = saStudents[selectedIndex];
    if (!s) return;

    const name = s.fullName || 'N/A';
    const sa = s.saNumber || s.familyDetails?.saNumber || 'Not Submitted';
    const studentId = s.studentId || 'N/A';
    const course = s.course || 'N/A';
    const year = s.year || 'N/A';
    const photo = s.profilePictureUrl || s.profileImageUrl || s.photoUrl || s.photoURL;

    let avatarHtml = '';
    if (photo) {
        avatarHtml = `
            <div style="padding: 4px; border-radius: 50%; border: 1.5px solid #FBC02D; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: inline-flex;">
                <img src="${photo}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;">
            </div>
        `;
    } else {
        avatarHtml = `
            <div style="padding: 4px; border-radius: 50%; border: 1.5px solid #FBC02D; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: inline-flex;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(212, 175, 55, 0.1); display: flex; align-items: center; justify-content: center;">
                    <i class="icon-user" style="font-size: 24px; color: #D4AF37;"></i>
                </div>
            </div>
        `;
    }

    // Duplicate check logic
    let isDuplicate = false;
    for (let i = 0; i < saStudents.length; i++) {
        if (i !== selectedIndex && (saStudents[i].saNumber || saStudents[i].familyDetails?.saNumber) === sa) {
            isDuplicate = true;
            break;
        }
    }

    let duplicateBadge = '';
    if (isDuplicate) {
        duplicateBadge = `
            <div style="padding: 4px 8px; border-radius: 6px; background: rgba(239, 83, 80, 0.1); border: 1px solid rgba(239, 83, 80, 0.3); display: inline-flex; align-items: center; gap: 6px;">
                <i class="icon-alert-triangle" style="font-size: 12px; color: var(--error);"></i>
                <span style="font-size: 10px; font-weight: 700; color: var(--error);">Duplicate Hash Network Check: FAILED</span>
            </div>
        `;
    } else {
        duplicateBadge = `
            <div style="padding: 4px 8px; border-radius: 6px; background: rgba(67, 160, 71, 0.1); border: 1px solid rgba(67, 160, 71, 0.3); display: inline-flex; align-items: center; gap: 6px;">
                <i class="icon-file-check-2" style="font-size: 12px; color: var(--success);"></i>
                <span style="font-size: 10px; font-weight: 700; color: var(--success);">Duplicate Hash Network Check: PASSED</span>
            </div>
        `;
    }

    let atmCardHtml = '';
    const atmCardUrl = s.atmCardUrl || (s.documents && s.documents.atmCardUrl);
    const atmCardFileName = s.atmCardFileName || (s.documents && s.documents.atmCardFileName);
    if (atmCardUrl) {
        atmCardHtml = `
            <div style="margin-bottom: 16px; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; background: rgba(0,0,0,0.02);">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; margin-bottom: 8px;"><i class="icon-credit-card" style="font-size: 12px; margin-right: 4px;"></i>ATM Card Proof</div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${atmCardUrl}" style="height: 50px; width: 80px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1); cursor: pointer;" onclick="window.open('${atmCardUrl}', '_blank')" title="Click to view full size">
                    <div style="flex: 1;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${atmCardFileName || 'ATM_Card_Image'}</div>
                        <button style="margin-top: 4px; background: none; border: none; padding: 0; color: var(--primary-color); font-size: 10px; font-weight: 700; cursor: pointer;" onclick="window.open('${atmCardUrl}', '_blank')">VIEW IMAGE <i class="icon-external-link" style="font-size: 10px;"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="padding: 16px;">
            <div style="text-align: center;">
                ${avatarHtml}
                <div style="margin-top: 12px; font-size: 16px; font-weight: 900; letter-spacing: -0.5px;">${name}</div>
                <div style="margin-top: 2px; display: inline-block; padding: 4px 10px; background: rgba(15, 50, 96, 0.06); border-radius: 20px; color: var(--primary-color); font-size: 10px; font-weight: 700;">
                    ${course} - ${year}
                </div>
            </div>
            
            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 12px 0;">
            
            <div style="margin-bottom: 10px;">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Student ID</div>
                <div style="font-size: 13px; font-weight: 700; margin-top: 2px;">${studentId}</div>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Submitted SA Number</div>
                <div style="font-size: 13px; font-weight: 700; margin-top: 2px;">${sa}</div>
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Bank Branch</div>
                <div style="font-size: 13px; font-weight: 700; margin-top: 2px;">Land Bank</div>
            </div>
            
            ${atmCardHtml}

            <div style="margin-bottom: 16px;">
                ${duplicateBadge}
            </div>

            <div style="margin-bottom: 6px; font-size: 13px; font-weight: 700;">Admin Remarks</div>
            <textarea id="sa-remarks" placeholder="e.g. Please re-upload your SA number, current one is blurred." style="width: 100%; height: 60px; padding: 12px 14px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--surface-color); font-family: inherit; font-size: 13px; font-weight: 500; resize: none; margin-bottom: 12px;"></textarea>

            <button class="btn" style="width: 100%; background: var(--success); color: white; border: none; padding: 8px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 8px; cursor: pointer;" onclick="updateStatus('Verified')">Mark as Verified</button>
            <button class="btn btn-outline" style="width: 100%; border: 1.5px solid var(--error); color: var(--error); padding: 8px; border-radius: 10px; font-size: 12px; font-weight: 700; margin-bottom: 2px; cursor: pointer;" onclick="updateStatus('Missing')">Mark as Missing Documents</button>
            <button class="btn" style="width: 100%; background: transparent; color: var(--text-secondary); border: none; padding: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" onclick="updateStatus('Rejected', true)">Permanent Rejection</button>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}

window.selectStudent = function(index) {
    selectedIndex = index;
    renderQueue();
    renderPanel();
};

window.updateStatus = async function(newStatus, isFinalRejection = false) {
    if (isUpdating) return;
    const s = saStudents[selectedIndex];
    if (!s || !s.uid) return;

    const remarks = document.getElementById('sa-remarks').value.trim();

    isUpdating = true;
    try {
        // 1. Update Student
        const { error } = await supabase.from('students').update({
            status: newStatus,
            adminRemarks: remarks,
            requiresResubmission: !isFinalRejection && newStatus === 'Rejected'
        }).eq('uid', s.uid);
        if (error) throw error;

        // 2. Audit Log
        await supabase.from('audit_logs').insert([{
            adminId: (await supabase.auth.getUser()).data.user?.id || 'unknown',
            adminName: 'Admin',
            action: `Verified student SA Number: ${newStatus}`,
            targetUser: s.uid,
            timestamp: new Date().toISOString()
        }]);

        // 3. Notification
        let title = newStatus === 'Verified' ? 'Account Verified' : (newStatus === 'Missing' ? 'Missing Documents' : 'Update on Application');
        let message = newStatus === 'Verified' ? 'Great news! Your SA Number has been verified and your status is now Verified.' : 
                      (newStatus === 'Missing' ? `Issue found: ${remarks}. Your status is now Missing; please submit the required document.` : `Issue found: ${remarks}. Please contact support.`);
        
        await supabase.from('notifications').insert([{
            studentId: s.uid,
            title: title,
            message: message,
            type: newStatus === 'Verified' ? 'success' : 'error',
            isRead: false,
            createdAt: new Date().toISOString()
        }]);

        alert(`Student ${s.fullName} status updated to ${newStatus}.`);
        
        // Remove from local queue instead of full reload to save time, or just reload
        loadSaQueue();
    } catch (e) {
        console.error('Error updating status:', e);
        alert('Failed to update student verification.');
    } finally {
        isUpdating = false;
    }
};

// Init
loadSaQueue();
