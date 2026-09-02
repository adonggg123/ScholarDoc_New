// ScholarDoc Student Web — Profile View Logic
// Mirrors profile_screen.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;
let profileData = window.currentStudentProfile || {
    fullName: 'Jude Student',
    studentId: '2024-00123',
    scholarshipName: 'TES Scholarship Program',
    course: 'BS Information Technology',
    year: '3rd Year',
    gender: 'Male',
    birthdate: '04/15/2003',
    contactNumber: '09123456789',
    section: '3A',
    email: 'jude.student@ustp.edu.ph',
    scholarYearLevel: '2024 - 2025',
    payoutsReceived: 3,
    saNumber: '1234-5678-9012'
};

// ─── Collapsible Sections ───
window.toggleSection = function(sectionKey) {
    const el = document.getElementById(`section-${sectionKey}`);
    if (el) el.classList.toggle('open');
};

// ─── Load Profile Data ───
async function loadProfile() {
    if (window.currentStudentProfile) {
        profileData = window.currentStudentProfile;
    } else if (uid && sb) {
        const { data, error } = await sb.from('students').select('*').eq('uid', uid).limit(1);
        if (!error && data && data.length > 0) {
            profileData = data[0];
            window.currentStudentProfile = profileData;
        }
    } else if (sb) {
        const { data } = await sb.from('students').select('*').eq('studentId', '2023305311').limit(1);
        if (data && data.length > 0) {
            profileData = data[0];
            window.currentStudentProfile = profileData;
        }
    }

    // Header
    const fullName = profileData.fullName || 'Student';
    const studentId = profileData.studentId || '';
    const course = profileData.course || 'BSIT';
    const year = profileData.year || '1st Year';
    const scholarship = profileData.scholarshipName || 'TES';

    document.getElementById('profile-fullname').textContent = fullName;
    document.getElementById('profile-course-year').textContent = `${course} • ${year}`;
    document.getElementById('profile-scholarship-badge').textContent = scholarship;
    document.getElementById('personal-subtitle').textContent = fullName;
    document.getElementById('academic-subtitle').textContent = scholarship;

    // Avatar
    const photoUrl = profileData.profilePictureUrl;
    const avatarEl = document.getElementById('profile-avatar-lg');
    if (photoUrl && avatarEl) {
        avatarEl.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    // Form fields
    document.getElementById('input-fullname').value = profileData.fullName || '';
    document.getElementById('input-gender').value = profileData.gender || 'Not Specified';
    document.getElementById('input-contact').value = profileData.contactNumber || '09123456789';
    document.getElementById('input-section').value = profileData.section || '3A';
    document.getElementById('input-sa').value = profileData.saNumber || '1234-5678-9012';
    
    // Birthdate
    const birthdateInput = document.getElementById('input-birthdate');
    if (profileData.birthdate) {
        let dateStr = profileData.birthdate;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
        birthdateInput.value = dateStr;
    } else {
        birthdateInput.value = '2003-04-15';
    }

    // Read-only fields
    document.getElementById('input-scholarship').value = profileData.scholarshipName || 'TES Scholarship Program';
    document.getElementById('input-studentid').value = profileData.studentId || '2024-00123';
    document.getElementById('input-email').value = profileData.email || 'jude.student@ustp.edu.ph';
    document.getElementById('input-scholar-year').value = profileData.scholarYearLevel || '2024 - 2025';
    document.getElementById('input-payouts').value = profileData.payoutsReceived?.toString() || '3 Grantees Completed';

    if (window.lucide) window.lucide.createIcons();
}

loadProfile();

// ─── Avatar Upload ───
const avatarTrigger = document.getElementById('avatar-upload-trigger');
const avatarInput = document.getElementById('avatar-file-input');

avatarTrigger?.addEventListener('click', () => avatarInput?.click());

avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cameraIcon = document.getElementById('camera-icon');
    if (cameraIcon) {
        cameraIcon.parentElement.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>';
    }

    try {
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

        if (uid && sb) {
            await sb.from('students').update({ profilePictureUrl: photoUrl }).eq('uid', uid);
        }

        const avatarEl = document.getElementById('profile-avatar-lg');
        if (avatarEl) {
            avatarEl.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        const topbarAvatar = document.getElementById('profile-avatar');
        if (topbarAvatar) {
            topbarAvatar.innerHTML = `<img src="${photoUrl}" alt="Avatar">`;
        }

        window.showToast?.('Profile Updated', 'Your profile picture has been updated.', 'success');

    } catch (err) {
        console.error('Avatar upload error:', err);
        window.showToast?.('Upload Feedback', 'Local preview updated', 'info');
    }

    if (cameraIcon?.parentElement) {
        cameraIcon.parentElement.innerHTML = '<i data-lucide="camera" style="width: 16px; height: 16px; color: var(--primary);" id="camera-icon"></i>';
        if (window.lucide) window.lucide.createIcons();
    }
});

// ─── Save Profile ───
const saveBtn = document.getElementById('save-profile-btn');
const saveBtnText = document.getElementById('save-btn-text');
const saveSpinner = document.getElementById('save-spinner');

saveBtn?.addEventListener('click', async () => {
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

        const birthdateVal = document.getElementById('input-birthdate').value;
        if (birthdateVal) {
            const d = new Date(birthdateVal);
            updates.birthdate = `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
        }

        if (uid && sb) {
            await sb.from('students').update(updates).eq('uid', uid);
        }

        window.currentStudentProfile = { ...(window.currentStudentProfile || {}), ...updates };

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
        if (uid && sb) {
            await sb.from('presence').upsert({ uid, isOnline: false, lastSeen: new Date().toISOString() });
            await sb.auth.signOut();
        }
    } catch (_) {}
    window.location.href = window.location.protocol === 'file:' ? '../admin_web/login.html' : '/login.html';
});

if (window.lucide) window.lucide.createIcons();
