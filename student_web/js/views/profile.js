// ScholarDoc Student Web — Profile Management Logic
// Mirrors lib/screens/profile/profile_screen.dart & lib/services/auth_service.dart

const sb = window.supabaseClient;
const uid = window.currentStudentUid;

// Exact top-level columns verified on live Supabase student_grantees table
const VALID_GRANTEE_COLUMNS = new Set([
    'uid', 'student_no', 'full_name', 'program_name', 'year_level', 'date_of_birth',
    'age', 'gender', 'civil_status', 'religion', 'mobile_number', 'email_address',
    'father_full_name', 'father_occupation', 'mother_full_name', 'mother_occupation',
    'status', 'scholarship_name', 'role', 'created_at', 'updated_at', 'studentId',
    'fullName', 'course', 'year', 'birthdate', 'email', 'contactNumber', 'createdAt',
    'updatedAt', 'saNumber', 'sa_number', 'submissionPdfUrl', 'submission_pdf_url',
    'submissionPdfName', 'submission_pdf_name', 'documents', 'idFrontUrl',
    'id_front_url', 'idBackUrl', 'id_back_url', 'atmCardUrl', 'atm_card_url',
    'atmCardFileName', 'pdfVerified', 'academicYear', 'academic_year', 'semester',
    'stickerValidated', 'sticker_validated', 'submittedAt', 'submitted_at',
    'requiresResubmission', 'adminRemarks', 'admin_remarks', 'familyDetails',
    'idValidationStatus', 'id_validation_status', 'saVerificationStatus',
    'sa_verification_status', 'profilePictureUrl', 'profile_picture_url'
]);

let profileData = window.currentStudentProfile || {};

function pickNonEmpty(candidates, fallback = '') {
    for (const c of candidates) {
        if (c !== null && c !== undefined) {
            const s = String(c).trim();
            if (s !== '' && s.toLowerCase() !== 'null') return s;
        }
    }
    return fallback;
}

function pickValidEmail(candidates) {
    for (const c of candidates) {
        if (c !== null && c !== undefined) {
            const s = String(c).trim();
            if (s && s.includes('@') && !s.toLowerCase().endsWith('@scholardoc.com')) {
                return s;
            }
        }
    }
    return '';
}

function pickValidSa(candidates) {
    for (const c of candidates) {
        if (c !== null && c !== undefined) {
            const s = String(c).trim();
            if (s && s.toLowerCase() !== 'null' && s.toUpperCase() !== 'N/A') {
                return s;
            }
        }
    }
    return '';
}

function toIsoDateOrNull(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str || str.toLowerCase() === 'null' || str.toUpperCase() === 'N/A') return null;
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            if (parts[0].trim().length === 4) {
                return `${parts[0].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[2].trim().padStart(2, '0')}`;
            }
            return `${parts[2].trim()}-${parts[0].trim().padStart(2, '0')}-${parts[1].trim().padStart(2, '0')}`;
        }
    }
    return null;
}

function normalizePhMobile(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (/^9\d{9}$/.test(digits)) return `0${digits}`;
    return trimmed;
}

// ─── Collapsible Sections & Focus Helpers ───
window.toggleSection = function (sectionKey) {
    const el = document.getElementById(`section-${sectionKey}`);
    if (el) el.classList.toggle('open');
};

window.focusSection = function (sectionKey, inputId) {
    const el = document.getElementById(`section-${sectionKey}`);
    if (el && !el.classList.contains('open')) {
        el.classList.add('open');
    }
    const input = document.getElementById(inputId);
    if (input) {
        setTimeout(() => {
            input.focus();
            if (typeof input.select === 'function' && input.tagName === 'INPUT') {
                input.select();
            }
        }, 60);
    }
};

function renderSummaryStrip() {
    const sch = document.getElementById('input-scholarship')?.value || 'TES';
    const yr = document.getElementById('input-year')?.value.trim() || 'Not Set';
    const sec = document.getElementById('input-section')?.value.trim() || '';
    const sa = document.getElementById('input-sa')?.value.trim() || '';
    const payouts = document.getElementById('input-payouts')?.value.trim() || '';

    const grantEl = document.getElementById('summary-grant');
    const yrSecEl = document.getElementById('summary-year-section');
    const disbEl = document.getElementById('summary-disbursement');

    if (grantEl) grantEl.textContent = sch;
    if (yrSecEl) yrSecEl.textContent = sec ? `${yr} • ${sec}` : yr;
    if (disbEl) {
        disbEl.textContent = sa
            ? (payouts ? `SA Set • ${payouts} Payouts` : 'SA Recorded')
            : 'SA Not Set';
    }
}

// ─── Load Profile Data ───
async function loadProfile(forceFetch = false) {
    if (!forceFetch && window.currentStudentProfile && Object.keys(window.currentStudentProfile).length > 0) {
        profileData = window.currentStudentProfile;
    } else if (uid && sb) {
        const { data, error } = await sb.from('student_grantees').select('*').eq('uid', uid).limit(1);
        if (!error && data && data.length > 0) {
            profileData = data[0];
            window.currentStudentProfile = profileData;
        }
    } else if (sb) {
        const { data } = await sb
            .from('student_grantees')
            .select('*')
            .or('student_no.eq.2023305311,studentId.eq.2023305311')
            .limit(1);
        if (data && data.length > 0) {
            profileData = data[0];
            window.currentStudentProfile = profileData;
        }
    }

    const fam = (profileData.familyDetails && typeof profileData.familyDetails === 'object')
        ? profileData.familyDetails
        : {};
    const docs = (profileData.documents && typeof profileData.documents === 'object')
        ? profileData.documents
        : {};

    const fullName = pickNonEmpty([profileData.fullName, profileData.full_name], 'Student Scholar');
    const studentId = pickNonEmpty([profileData.studentId, profileData.student_no], '—');
    const course = pickNonEmpty([profileData.course, profileData.program_name], 'BS in Information Technology');
    const year = pickNonEmpty([profileData.year, profileData.year_level], '1st Year');
    const rawScholarship = pickNonEmpty([profileData.scholarship_name, profileData.scholarshipName], 'TES');
    const scholarship = rawScholarship.toUpperCase().includes('TES') ? 'TES' : rawScholarship;
    const status = pickNonEmpty([profileData.status], 'Active Scholar');

    // Header
    const fnEl = document.getElementById('profile-fullname');
    const cyEl = document.getElementById('profile-course-year');
    const idPillEl = document.getElementById('profile-id-pill');
    const schBadgeEl = document.getElementById('profile-scholarship-badge');
    const statusBadgeEl = document.getElementById('profile-status-badge');

    if (fnEl) fnEl.textContent = fullName;
    if (cyEl) cyEl.textContent = `${course} • ${year}`;
    if (idPillEl) idPillEl.textContent = `ID: ${studentId}`;
    if (schBadgeEl) schBadgeEl.textContent = scholarship;
    if (statusBadgeEl) statusBadgeEl.textContent = status;

    const personalSub = document.getElementById('personal-subtitle');
    const academicSub = document.getElementById('academic-subtitle');
    if (personalSub) personalSub.textContent = `${fullName} • Contact & identity`;
    if (academicSub) academicSub.textContent = `${scholarship} • ${year}`;

    // Avatar
    const photoUrl = pickNonEmpty([profileData.profilePictureUrl, profileData.profile_picture_url]);
    const avatarEl = document.getElementById('profile-avatar-lg');
    if (photoUrl && avatarEl) {
        avatarEl.innerHTML = `<img src="${photoUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    // Personal Info Inputs
    document.getElementById('input-fullname').value = fullName === 'Student Scholar' ? '' : fullName;

    const genderSelect = document.getElementById('input-gender');
    const rawGender = pickNonEmpty([profileData.gender, fam.gender], 'Male');
    let normalizedGender = 'Male';
    if (rawGender.toLowerCase().startsWith('f')) normalizedGender = 'Female';
    else if (rawGender.toLowerCase().includes('prefer')) normalizedGender = 'Prefer not to say';
    else if (rawGender && rawGender !== 'Not Specified' && rawGender !== 'N/A') normalizedGender = rawGender;
    if (genderSelect) {
        if (![...genderSelect.options].some((o) => o.value === normalizedGender)) {
            const opt = document.createElement('option');
            opt.value = normalizedGender;
            opt.textContent = normalizedGender;
            genderSelect.appendChild(opt);
        }
        genderSelect.value = normalizedGender;
    }

    document.getElementById('input-email').value = pickValidEmail([
        profileData.email,
        profileData.email_address,
        fam.email
    ]);
    document.getElementById('input-contact').value = pickNonEmpty([
        profileData.contactNumber,
        profileData.mobile_number,
        fam.contactNumber
    ]);
    document.getElementById('input-section').value = pickNonEmpty([
        profileData.section,
        fam.section,
        fam.section_name
    ]);

    const birthdateInput = document.getElementById('input-birthdate');
    const isoDob = toIsoDateOrNull(pickNonEmpty([profileData.date_of_birth, profileData.birthdate, fam.birthdate]));
    if (birthdateInput) {
        birthdateInput.value = isoDob || '';
    }

    // Academic Management Inputs
    document.getElementById('input-studentid').value = studentId;
    const schSelect = document.getElementById('input-scholarship');
    if (schSelect) {
        if (![...schSelect.options].some((o) => o.value === scholarship)) {
            const opt = document.createElement('option');
            opt.value = scholarship;
            opt.textContent = scholarship;
            schSelect.appendChild(opt);
        }
        schSelect.value = scholarship;
    }
    document.getElementById('input-course').value = pickNonEmpty([profileData.course, profileData.program_name]);
    document.getElementById('input-year').value = pickNonEmpty([profileData.year, profileData.year_level]);

    const scholarYr = pickNonEmpty([
        profileData.scholarYearLevel,
        profileData.yearBecameScholar,
        profileData.year_became_scholar,
        fam.scholarYearLevel,
        fam.yearBecameScholar,
        fam.year_became_scholar
    ]);
    document.getElementById('input-scholar-year').value = scholarYr;

    const pRec = profileData.payoutsReceived ?? fam.payoutsReceived ?? profileData.payouts_received ?? fam.payouts_received;
    const hasP = pRec !== null && pRec !== undefined && String(pRec).trim() !== '' && String(pRec).toLowerCase() !== 'null';
    document.getElementById('input-payouts').value = hasP ? String(pRec).trim() : '';

    // Banking Input
    const resolvedSa = pickValidSa([
        profileData.saNumber,
        profileData.sa_number,
        fam.saNumber,
        docs.saNumber,
        docs.sa_number,
        docs.atmExtractedSaNumber
    ]);
    document.getElementById('input-sa').value = resolvedSa;
    const bankingSub = document.getElementById('banking-subtitle');
    if (bankingSub) {
        bankingSub.textContent = resolvedSa
            ? `SA Account: ${resolvedSa}`
            : 'Registered Landbank Savings Account (SA) information';
    }

    renderSummaryStrip();
    if (window.lucide) window.lucide.createIcons();
}

loadProfile();

// ─── Refresh & Copy Student ID ───
document.getElementById('refresh-profile-btn')?.addEventListener('click', async () => {
    await loadProfile(true);
    window.showToast?.('Profile Synced', 'Loaded latest scholarship and profile records.', 'success');
});

document.getElementById('copy-student-id-btn')?.addEventListener('click', async () => {
    const studentId = pickNonEmpty([profileData.studentId, profileData.student_no]);
    if (!studentId) return;
    try {
        await navigator.clipboard.writeText(studentId);
        window.showToast?.('Copied', `Student ID (${studentId}) copied to clipboard.`, 'info');
    } catch (_) {}
});

// ─── Avatar Upload ───
const avatarTrigger = document.getElementById('avatar-upload-trigger');
const avatarInput = document.getElementById('avatar-file-input');

avatarTrigger?.addEventListener('click', () => avatarInput?.click());

avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cameraIcon = document.getElementById('camera-icon');
    const cameraBadge = cameraIcon?.parentElement;
    if (cameraBadge) {
        cameraBadge.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>';
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
            await sb.from('student_grantees').update({
                profilePictureUrl: photoUrl,
                profile_picture_url: photoUrl,
            }).eq('uid', uid);
        }

        profileData.profilePictureUrl = photoUrl;
        profileData.profile_picture_url = photoUrl;
        window.currentStudentProfile = profileData;

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
        window.showToast?.('Upload Failed', 'Unable to upload profile image.', 'error');
    } finally {
        if (cameraBadge) {
            cameraBadge.innerHTML = '<i data-lucide="camera" style="width: 16px; height: 16px; color: var(--primary);" id="camera-icon"></i>';
            if (window.lucide) window.lucide.createIcons();
        }
    }
});

// ─── Unified Safe Persist Helper (Personal, Academic, Banking, or All) ───
async function persistSectionChanges({ sectionScope, buttonEl, textEl, defaultLabel, auditAction, successTitle }) {
    const fullNameVal = document.getElementById('input-fullname')?.value.trim() || '';
    const genderVal = document.getElementById('input-gender')?.value || 'Male';
    const birthdateVal = document.getElementById('input-birthdate')?.value || '';
    const emailVal = document.getElementById('input-email')?.value.trim() || '';
    const contactRaw = document.getElementById('input-contact')?.value.trim() || '';
    const sectionVal = document.getElementById('input-section')?.value.trim() || '';

    const scholarshipVal = document.getElementById('input-scholarship')?.value || 'TES';
    const courseVal = document.getElementById('input-course')?.value.trim() || '';
    const yearVal = document.getElementById('input-year')?.value.trim() || '';
    const scholarYearVal = document.getElementById('input-scholar-year')?.value.trim() || '';
    const payoutsVal = document.getElementById('input-payouts')?.value.trim() || '';
    const saVal = document.getElementById('input-sa')?.value.trim() || '';

    // Section-scoped validation
    if (sectionScope === 'personal' || sectionScope === 'all') {
        if (!fullNameVal) {
            window.showToast?.('Validation Error', 'Full Name cannot be empty.', 'error');
            return;
        }
        if (emailVal && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailVal)) {
            window.showToast?.('Validation Error', 'Please enter a valid email address.', 'error');
            return;
        }
    }
    if (sectionScope === 'academic' || sectionScope === 'all') {
        if (!courseVal) {
            window.showToast?.('Validation Error', 'Degree Program / Course is required.', 'error');
            return;
        }
        if (!yearVal) {
            window.showToast?.('Validation Error', 'Current Year Level is required.', 'error');
            return;
        }
    }
    if (sectionScope === 'banking' || sectionScope === 'all') {
        if (saVal) {
            const digits = saVal.replace(/[\s\-]/g, '');
            if (!/^\d{8,16}$/.test(digits)) {
                window.showToast?.('Validation Error', 'Enter a valid SA number (8–16 digits).', 'error');
                return;
            }
        }
    }

    if (buttonEl) buttonEl.disabled = true;
    if (textEl) textEl.textContent = 'Saving...';
    const masterSpinner = sectionScope === 'all' ? document.getElementById('save-spinner') : null;
    masterSpinner?.classList.remove('hidden');

    try {
        const currentFam = (profileData.familyDetails && typeof profileData.familyDetails === 'object')
            ? { ...profileData.familyDetails }
            : {};
        const currentDocs = (profileData.documents && typeof profileData.documents === 'object')
            ? { ...profileData.documents }
            : {};

        const rawUpdates = {};
        const nowIso = new Date().toISOString();

        if (sectionScope === 'personal' || sectionScope === 'all') {
            const normalizedMobile = normalizePhMobile(contactRaw);
            const isoDob = toIsoDateOrNull(birthdateVal);
            rawUpdates.fullName = fullNameVal;
            rawUpdates.full_name = fullNameVal;
            rawUpdates.gender = genderVal;
            rawUpdates.contactNumber = normalizedMobile;
            rawUpdates.mobile_number = normalizedMobile;
            rawUpdates.birthdate = isoDob || '';
            rawUpdates.date_of_birth = isoDob;
            if (emailVal) {
                rawUpdates.email = emailVal;
                rawUpdates.email_address = emailVal;
            }
            if (sectionVal) {
                currentFam.section = sectionVal;
            } else {
                delete currentFam.section;
            }
        }

        if (sectionScope === 'academic' || sectionScope === 'all') {
            const pNum = payoutsVal !== '' ? parseInt(payoutsVal, 10) : null;
            rawUpdates.scholarship_name = scholarshipVal;
            rawUpdates.course = courseVal;
            rawUpdates.program_name = courseVal;
            rawUpdates.year = yearVal;
            rawUpdates.year_level = yearVal;

            if (scholarYearVal) {
                currentFam.scholarYearLevel = scholarYearVal;
                currentFam.yearBecameScholar = scholarYearVal;
                currentFam.year_became_scholar = scholarYearVal;
            } else {
                delete currentFam.scholarYearLevel;
                delete currentFam.yearBecameScholar;
                delete currentFam.year_became_scholar;
            }

            if (pNum !== null && !Number.isNaN(pNum)) {
                currentFam.payoutsReceived = pNum;
                currentFam.payouts_received = String(pNum);
            } else {
                delete currentFam.payoutsReceived;
                delete currentFam.payouts_received;
            }
        }

        if (sectionScope === 'banking' || sectionScope === 'all') {
            rawUpdates.saNumber = saVal;
            rawUpdates.sa_number = saVal;
            if (saVal) {
                currentFam.saNumber = saVal;
                currentDocs.saNumber = saVal;
                currentDocs.sa_number = saVal;
            } else {
                delete currentFam.saNumber;
                delete currentDocs.saNumber;
                delete currentDocs.sa_number;
            }
            rawUpdates.documents = currentDocs;
        }

        rawUpdates.familyDetails = currentFam;
        rawUpdates.updated_at = nowIso;
        rawUpdates.updatedAt = nowIso;

        // Filter strictly to valid student_grantees columns so PostgREST NEVER fails with PGRST204
        const cleanUpdates = {};
        for (const [k, v] of Object.entries(rawUpdates)) {
            if (VALID_GRANTEE_COLUMNS.has(k)) {
                cleanUpdates[k] = v;
            }
        }

        const studentNo = pickNonEmpty([profileData.studentId, profileData.student_no]);
        const studentEmail = pickValidEmail([profileData.email, profileData.email_address]);
        const fullNameStr = fullNameVal || pickNonEmpty([profileData.fullName, profileData.full_name], 'Student');

        if (sb) {
            let updatedPrimary = false;
            if (profileData.id) {
                const { error } = await sb.from('student_grantees').update(cleanUpdates).eq('id', profileData.id);
                if (error) throw error;
                updatedPrimary = true;
            }
            if (uid) {
                const { error } = await sb.from('student_grantees').update(cleanUpdates).eq('uid', uid);
                if (error && !updatedPrimary) throw error;
                updatedPrimary = true;
            }

            if (studentNo && studentNo !== 'N/A') {
                try {
                    await sb.from('student_grantees').update(cleanUpdates).or(`student_no.eq.${studentNo},studentId.eq.${studentNo}`);
                } catch (_) {}

                try {
                    const schoolUpdates = { updated_at: nowIso };
                    if ('full_name' in cleanUpdates) schoolUpdates.full_name = cleanUpdates.full_name;
                    if ('mobile_number' in cleanUpdates) schoolUpdates.mobile_number = cleanUpdates.mobile_number;
                    if ('email_address' in cleanUpdates) schoolUpdates.email_address = cleanUpdates.email_address;
                    if ('date_of_birth' in cleanUpdates) schoolUpdates.date_of_birth = cleanUpdates.date_of_birth;
                    if ('gender' in cleanUpdates) schoolUpdates.gender = cleanUpdates.gender;
                    if ('program_name' in cleanUpdates) schoolUpdates.program_name = cleanUpdates.program_name;
                    if ('year_level' in cleanUpdates) schoolUpdates.year_level = cleanUpdates.year_level;
                    if (Object.keys(schoolUpdates).length > 1) {
                        await sb.from('school_students').update(schoolUpdates).eq('student_no', studentNo);
                    }
                } catch (_) {}
            }

            if (studentEmail) {
                try {
                    await sb.from('student_grantees').update(cleanUpdates).or(`email_address.eq.${studentEmail},email.eq.${studentEmail}`);
                } catch (_) {}
            }

            // Audit Log
            try {
                await sb.from('audit_logs').insert([{
                    action: auditAction,
                    userName: fullNameStr,
                    role: 'Student',
                    studentId: studentNo || 'N/A',
                    ipAddress: 'Web Browser'
                }]);
            } catch (_) {}

            // Notify Super Admin & Student
            try {
                await sb.from('notifications').insert([{
                    studentId: 'superadmin',
                    title: 'Student Profile Updated',
                    message: `${fullNameStr} (${auditAction.toLowerCase()}).`,
                    type: 'info',
                    isRead: false,
                    timestamp: nowIso
                }]);
            } catch (_) {}

            if (uid) {
                try {
                    await sb.from('notifications').insert([{
                        studentId: uid,
                        title: 'Profile Updated',
                        message: `${successTitle} saved successfully.`,
                        type: 'success',
                        isRead: false,
                        timestamp: nowIso
                    }]);
                } catch (_) {}

                try {
                    await sb.from('notifications').delete().eq('studentId', uid).ilike('title', '%Missing Requirements%');
                } catch (_) {}
            }
        }

        profileData = {
            ...profileData,
            ...cleanUpdates,
            scholarshipName: cleanUpdates.scholarship_name || profileData.scholarshipName || scholarshipVal,
            section: sectionVal,
            scholarYearLevel: scholarYearVal,
            payoutsReceived: currentFam.payoutsReceived ?? null,
        };
        window.currentStudentProfile = profileData;

        const firstName = (fullNameStr || 'Student').split(' ')[0].replace(',', '');
        const topbarNameEl = document.getElementById('profile-name');
        if (topbarNameEl) topbarNameEl.textContent = firstName;

        await loadProfile(true);
        window.showToast?.(successTitle, 'Changes saved and synced across your scholarship record.', 'success');
    } catch (err) {
        console.error('Save error:', err);
        window.showToast?.('Save Failed', err.message || 'Unable to save profile changes.', 'error');
    } finally {
        if (buttonEl) buttonEl.disabled = false;
        if (textEl) textEl.textContent = defaultLabel;
        masterSpinner?.classList.add('hidden');
    }
}

// Wire up individual section Save buttons + Master Save button
document.getElementById('save-personal-btn')?.addEventListener('click', () =>
    persistSectionChanges({
        sectionScope: 'personal',
        buttonEl: document.getElementById('save-personal-btn'),
        textEl: document.getElementById('save-personal-text'),
        defaultLabel: 'Save Personal Information',
        auditAction: 'Updated Personal Information',
        successTitle: 'Personal Information'
    })
);

document.getElementById('save-academic-btn')?.addEventListener('click', () =>
    persistSectionChanges({
        sectionScope: 'academic',
        buttonEl: document.getElementById('save-academic-btn'),
        textEl: document.getElementById('save-academic-text'),
        defaultLabel: 'Save Academic Changes',
        auditAction: 'Updated Academic Management',
        successTitle: 'Academic Management'
    })
);

document.getElementById('save-banking-btn')?.addEventListener('click', () =>
    persistSectionChanges({
        sectionScope: 'banking',
        buttonEl: document.getElementById('save-banking-btn'),
        textEl: document.getElementById('save-banking-text'),
        defaultLabel: 'Update Banking Details',
        auditAction: 'Updated Banking & Disbursement Details',
        successTitle: 'Banking Details'
    })
);

document.getElementById('save-profile-btn')?.addEventListener('click', () =>
    persistSectionChanges({
        sectionScope: 'all',
        buttonEl: document.getElementById('save-profile-btn'),
        textEl: document.getElementById('save-btn-text'),
        defaultLabel: 'Save All Profile Changes',
        auditAction: 'Updated complete student profile',
        successTitle: 'Profile Changes'
    })
);

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
