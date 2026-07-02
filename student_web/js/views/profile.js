// ScholarDoc Student Web — Profile View Logic
// Mirrors profile_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;
let profileData = window.currentStudentProfile;

// ─── Collapsible Sections ───
window.toggleSection = function(sectionKey) {
    const el = document.getElementById(`section-${sectionKey}`);
    if (el) el.classList.toggle('open');
};

// ─── Load Profile Data ───
async function loadProfile() {
    if (!uid) return;

    const { data, error } = await sb.from('students').select().eq('uid', uid);
    if (error || !data || data.length === 0) return;

    profileData = data[0];

    // Header
    const fullName = profileData.fullName || 'Student Name';
    document.getElementById('profile-fullname').textContent = fullName;
    document.getElementById('profile-course-year').textContent = 
        `${profileData.course || 'Course'} • ${profileData.year || 'Year'}`;
    document.getElementById('profile-scholarship-badge').textContent = 
        profileData.scholarshipName || 'No Scholarship';
    document.getElementById('personal-subtitle').textContent = fullName;
    document.getElementById('academic-subtitle').textContent = 
        profileData.scholarshipName || 'Scholarship details';

    // Avatar
    const photoUrl = profileData.profilePictureUrl;
    const avatarEl = document.getElementById('profile-avatar-lg');
    if (photoUrl && avatarEl) {
        avatarEl.innerHTML = `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    // Form fields
    document.getElementById('input-fullname').value = profileData.fullName || '';
    document.getElementById('input-gender').value = profileData.gender || 'Not Specified';
    document.getElementById('input-contact').value = profileData.contactNumber || '';
    document.getElementById('input-section').value = profileData.section || '';
    document.getElementById('input-sa').value = profileData.saNumber || '';
    
    // Birthdate
    const birthdateInput = document.getElementById('input-birthdate');
    if (profileData.birthdate) {
        // Parse MM/DD/YYYY or YYYY-MM-DD
        let dateStr = profileData.birthdate;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
        birthdateInput.value = dateStr;
    }

    // Read-only fields
    document.getElementById('input-scholarship').value = profileData.scholarshipName || 'Not Assigned';
    document.getElementById('input-studentid').value = profileData.studentId || '...';
    document.getElementById('input-email').value = profileData.email || '...';
    document.getElementById('input-scholar-year').value = profileData.scholarYearLevel || 'N/A';
    document.getElementById('input-payouts').value = profileData.payoutsReceived?.toString() || '0';

    if (window.lucide) window.lucide.createIcons();
}

loadProfile();

// ─── Avatar Upload ───
const avatarTrigger = document.getElementById('avatar-upload-trigger');
const avatarInput = document.getElementById('avatar-file-input');

avatarTrigger?.addEventListener('click', () => avatarInput?.click());

avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    const cameraIcon = document.getElementById('camera-icon');
    if (cameraIcon) {
        cameraIcon.parentElement.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>';
    }

    try {
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'scholardoc_profiles');
        formData.append('folder', 'profile_pictures');

        const resp = await fetch('https://api.cloudinary.com/v1_1/dc2wi71nx/image/upload', {
            method: 'POST',
            body: formData,
        });

        if (!resp.ok) throw new Error('Upload failed');
        const result = await resp.json();
        const photoUrl = result.secure_url;

        // Update DB
        await sb.from('students').update({ profilePictureUrl: photoUrl }).eq('uid', uid);

        // Update UI
        const avatarEl = document.getElementById('profile-avatar-lg');
        if (avatarEl) {
            avatarEl.innerHTML = `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        // Update topbar avatar too
        const topbarAvatar = document.getElementById('profile-avatar');
        if (topbarAvatar) {
            topbarAvatar.innerHTML = `<img src="${photoUrl}" alt="Avatar">`;
        }

        window.showToast?.('Profile Updated', 'Your profile picture has been updated.', 'success');

        // Log activity
        try {
            await sb.from('audit_logs').insert({
                action: 'Updated profile picture via Web Portal',
                userName: profileData?.fullName || 'Student',
                role: 'Student',
            });
        } catch (_) {}

    } catch (err) {
        console.error('Avatar upload error:', err);
        window.showToast?.('Upload Failed', err.message, 'error');
    }

    // Restore camera icon
    if (cameraIcon?.parentElement) {
        cameraIcon.parentElement.innerHTML = '<i data-lucide="camera" style="width: 14px; height: 14px; color: #0F3260;" id="camera-icon"></i>';
        if (window.lucide) window.lucide.createIcons();
    }
});

// ─── Save Profile ───
const saveBtn = document.getElementById('save-profile-btn');
const saveBtnText = document.getElementById('save-btn-text');
const saveSpinner = document.getElementById('save-spinner');

saveBtn?.addEventListener('click', async () => {
    if (!uid) return;

    saveBtn.disabled = true;
    saveBtnText.textContent = 'Saving...';
    saveSpinner?.classList.remove('hidden');

    try {
        const updates = {
            fullName: document.getElementById('input-fullname').value.trim(),
            contactNumber: document.getElementById('input-contact').value.trim(),
            section: document.getElementById('input-section').value.trim(),
            saNumber: document.getElementById('input-sa').value.trim(),
        };

        // Birthdate
        const birthdateVal = document.getElementById('input-birthdate').value;
        if (birthdateVal) {
            const d = new Date(birthdateVal);
            updates.birthdate = `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
        }

        await sb.from('students').update(updates).eq('uid', uid);

        // Log activity
        try {
            await sb.from('audit_logs').insert({
                action: 'Updated profile information via Web Portal',
                userName: updates.fullName || 'Student',
                role: 'Student',
            });
        } catch (_) {}

        // Update global profile
        window.currentStudentProfile = { ...window.currentStudentProfile, ...updates };

        // Update topbar
        const firstName = (updates.fullName || 'Student').split(' ')[0];
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) profileNameEl.textContent = firstName;

        window.showToast?.('Profile Saved', 'Your profile changes have been saved successfully.', 'success');

    } catch (err) {
        console.error('Save error:', err);
        window.showToast?.('Save Failed', err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtnText.textContent = 'Save Profile Changes';
        saveSpinner?.classList.add('hidden');
    }
});

// ─── Logout ───
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
        if (uid) {
            await sb.from('presence').upsert({ uid, isOnline: false, lastSeen: new Date().toISOString() });
        }
        await sb.auth.signOut();
    } catch (_) {}
    window.location.href = 'index.html';
});

if (window.lucide) window.lucide.createIcons();
