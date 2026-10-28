// ScholarDoc Unified Web Login Controller
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

// Isolated storage keys per role
const SUPERADMIN_STORAGE_KEY = 'scholardoc_superadmin_auth_token';
const ADMIN_STORAGE_KEY = 'scholardoc_admin_auth_token';
const STUDENT_STORAGE_KEY = 'scholardoc_student_auth_token';

// During login check, avoid auto-writing to shared storage until role is verified
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
}) : null;

// Initialize Lucide Icons
if (window.lucide) {
    lucide.createIcons();
}

// DOM Elements
const loginForm = document.getElementById('loginForm');
const identifierInput = document.getElementById('username') || document.getElementById('studentId');
const passwordInput = document.getElementById('password');
const togglePwdBtn = document.getElementById('togglePwd');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginBtnIcon = document.getElementById('loginBtnIcon');
const loginSpinner = document.getElementById('loginSpinner');

// Password toggle
let obscurePassword = true;
if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
        obscurePassword = !obscurePassword;
        passwordInput.type = obscurePassword ? 'password' : 'text';
        togglePwdBtn.innerHTML = '';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', obscurePassword ? 'eye' : 'eye-off');
        togglePwdBtn.appendChild(icon);
        if (window.lucide) lucide.createIcons();
    });
}

// Toast notification helper for general authentication errors
function showError(message) {
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <div class="toast-icon-box">
            <i data-lucide="alert-circle"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">Sign In Failed</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button type="button" class="toast-close-btn" aria-label="Dismiss">&times;</button>
    `;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    // Trigger entrance transition
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismissToast = () => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    };
    if (closeBtn) closeBtn.onclick = dismissToast;

    setTimeout(() => {
        if (document.body.contains(toast)) {
            dismissToast();
        }
    }, 6000);
}

// Modern, educational Grantee Access Denied Modal presenter
function showGranteeAccessDeniedModal(enteredId) {
    const cleanId = (enteredId || '').trim();

    let modal = document.getElementById('granteeDeniedModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'granteeDeniedModal';
        modal.className = 'grantee-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="grantee-modal-card">
                <div class="grantee-modal-handle"></div>
                <button type="button" class="grantee-modal-close" id="granteeModalCloseBtn" aria-label="Close modal">
                    <i data-lucide="x"></i>
                </button>
                <div class="grantee-hero-icon-wrapper">
                    <div class="grantee-hero-icon">
                        <i data-lucide="shield-alert"></i>
                    </div>
                </div>
                <div class="grantee-eyebrow-wrapper">
                    <span class="grantee-eyebrow-badge">
                        <i data-lucide="lock"></i> OFFICIAL GRANTEE RESTRICTION
                    </span>
                </div>
                <h2 class="grantee-modal-title">Grantee Record Not Found</h2>
                <p class="grantee-modal-subtitle">
                    ScholarDoc is strictly reserved for verified scholars listed in the official scholarship database.
                </p>
                <div class="grantee-id-box">
                    <div class="grantee-id-content">
                        <i data-lucide="badge-check" class="grantee-id-icon"></i>
                        <span class="grantee-id-label">Entered ID:</span>
                        <strong class="grantee-id-value" id="granteeModalEnteredId">None provided</strong>
                    </div>
                    <span class="grantee-status-badge">Not in Masterlist</span>
                </div>
                <div class="grantee-info-card">
                    <div class="grantee-card-header">
                        <i data-lucide="info" class="text-primary-navy"></i>
                        <h4>Why was access denied?</h4>
                    </div>
                    <div class="grantee-bullet">
                        <i data-lucide="graduation-cap"></i>
                        <div>
                            <strong>Eligible Grantees Only</strong>
                            <p>Only officially enrolled scholars (TES, UniFAST, and university grant recipients) can sign in to submit documents and verify Landbank accounts.</p>
                        </div>
                    </div>
                    <div class="grantee-bullet">
                        <i data-lucide="file-spreadsheet"></i>
                        <div>
                            <strong>Official Masterlist Sync</strong>
                            <p>Your student credentials do not match any active record in the verified grantee billing registry for AY 2026-2027.</p>
                        </div>
                    </div>
                </div>
                <div class="grantee-action-card">
                    <div class="grantee-card-header text-amber">
                        <i data-lucide="help-circle"></i>
                        <h4>What can you do?</h4>
                    </div>
                    <ol class="grantee-steps-list">
                        <li>Double-check your entered Student ID for any typographical error.</li>
                        <li>If you are a qualified grantee, visit the Scholarship & Student Affairs Unit at USTP Oroquieta Campus (Mobod).</li>
                        <li>Or contact the scholarship coordinator via email:</li>
                    </ol>
                    <div class="grantee-email-wrapper">
                        <button type="button" class="grantee-email-chip" id="granteeCopyEmailBtn" title="Click to copy email address">
                            <i data-lucide="mail"></i>
                            <span>scholarships.oroquieta@ustp.edu.ph</span>
                            <i data-lucide="copy" class="copy-icon"></i>
                        </button>
                        <span id="granteeCopyFeedback" class="copy-feedback-pill hidden">Copied to clipboard!</span>
                    </div>
                </div>
                <div class="grantee-modal-actions">
                    <button type="button" class="grantee-btn-primary" id="granteeRetryBtn">
                        <i data-lucide="refresh-cw"></i> Check & Re-enter Student ID
                    </button>
                    <button type="button" class="grantee-btn-secondary" id="granteeDismissBtn">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Populate dynamic student ID
    const enteredIdEl = modal.querySelector('#granteeModalEnteredId');
    if (enteredIdEl) {
        enteredIdEl.textContent = cleanId || 'None provided';
    }

    if (window.lucide) lucide.createIcons();

    // Show modal with animation
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    const closeBtn = modal.querySelector('#granteeModalCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    const dismissBtn = modal.querySelector('#granteeDismissBtn');
    if (dismissBtn) dismissBtn.onclick = closeModal;

    // Retry action: close modal, focus Student ID field, select text for immediate re-entry
    const retryBtn = modal.querySelector('#granteeRetryBtn');
    if (retryBtn) {
        retryBtn.onclick = () => {
            closeModal();
            if (identifierInput) {
                identifierInput.focus();
                identifierInput.select();
            }
        };
    }

    // One-tap copyable email button
    const copyBtn = modal.querySelector('#granteeCopyEmailBtn');
    const feedback = modal.querySelector('#granteeCopyFeedback');
    if (copyBtn) {
        copyBtn.onclick = async () => {
            const email = 'scholarships.oroquieta@ustp.edu.ph';
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(email);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = email;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                }
                if (feedback) {
                    feedback.classList.remove('hidden');
                    setTimeout(() => feedback.classList.add('hidden'), 2500);
                }
            } catch (_) {
                if (feedback) {
                    feedback.textContent = 'Copied!';
                    feedback.classList.remove('hidden');
                    setTimeout(() => feedback.classList.add('hidden'), 2500);
                }
            }
        };
    }

    // Close on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };

    // Close on Escape key
    const onKeydown = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
            document.removeEventListener('keydown', onKeydown);
        }
    };
    document.addEventListener('keydown', onKeydown);
}

function setLoading(loading) {
    if (loginBtn) loginBtn.disabled = loading;
    if (loginBtnText) loginBtnText.style.display = loading ? 'none' : 'block';
    if (loginBtnIcon) loginBtnIcon.style.display = loading ? 'none' : 'block';
    if (loginSpinner) loginSpinner.classList.toggle('hidden', !loading);
}

// Helper to format password to satisfy Supabase Auth's minimum 6-character requirement
function formatAuthPassword(pwd) {
    const clean = (pwd || '').trim();
    if (clean.length > 0 && clean.length < 6) {
        return clean.padStart(6, '0');
    }
    return clean;
}

// Helper email formatters
function getAdminEmail(raw) {
    const clean = raw.trim().toLowerCase();
    if (clean.includes('@')) return clean;
    if (clean === 'superadmin') return 'superadmin@scholardoc.com';
    if (clean === 'admin') return 'admin@scholardoc.com';
    return `${clean}@scholardoc.com`;
}

function getStudentEmail(raw) {
    const clean = raw.trim();
    if (clean.includes('@')) return clean;
    return `${clean.replaceAll(' ', '_')}@scholardoc.com`;
}

/**
 * Validates whether an identifier belongs to an authorized student grantee in student_grantees.
 * Returns the grantee record if eligible, or null if not in student_grantees.
 */
async function checkGranteeRecord(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim();
    const cleanNo = cleanId.replace(/[- ]/g, '');

    // 1. Try server backend endpoint first if available
    try {
        const res = await fetch('/api/auth/validate-grantee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanId })
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.isEligible && data.grantee) {
                return data.grantee;
            } else if (data && data.isEligible === false) {
                return null;
            }
        } else if (res.status === 403) {
            return null;
        }
    } catch (_) {}

    // 2. Direct Supabase query fallback strictly on student_grantees table
    try {
        const filterTerms = [
            `student_no.eq.${encodeURIComponent(cleanId)}`,
            `studentId.eq.${encodeURIComponent(cleanId)}`
        ];
        if (cleanNo && cleanNo !== cleanId) {
            filterTerms.push(`student_no.eq.${encodeURIComponent(cleanNo)}`);
            filterTerms.push(`studentId.eq.${encodeURIComponent(cleanNo)}`);
        }
        if (cleanId.includes('@')) {
            filterTerms.push(`email_address.eq.${encodeURIComponent(cleanId)}`);
            filterTerms.push(`email.eq.${encodeURIComponent(cleanId)}`);
        }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)) {
            filterTerms.push(`id.eq.${encodeURIComponent(cleanId)}`);
            filterTerms.push(`uid.eq.${encodeURIComponent(cleanId)}`);
        }

        const { data, error } = await supabaseClient
            .from('student_grantees')
            .select('*')
            .or(filterTerms.join(','))
            .limit(1);

        if (!error && data && data.length > 0) {
            return data[0];
        }
    } catch (e) {
        console.error('Error querying student_grantees table:', e);
    }

    return null;
}

// Automatic Routing Helper based on Database Role
async function routeUserByRole(authUser, rawIdentifier, authSession) {
    const uid = authUser.id;
    const userEmail = (authUser.email || '').toLowerCase();
    
    // Check if user exists in admins table
    let adminData = null;
    try {
        const { data: adminRows } = await supabaseClient
            .from('admins')
            .select('*')
            .or(`uid.eq.${uid},email.eq.${userEmail}`)
            .limit(1);
        if (adminRows && adminRows.length > 0) {
            adminData = adminRows[0];
        }
    } catch (_) {}

    const isAdminAccount = !!adminData || userEmail.includes('admin') || userEmail.includes('superadmin');

    if (!isAdminAccount) {
        // STRICT POST-LOGIN VALIDATION: Verify student is listed in student_grantees table
        let studentData = await checkGranteeRecord(uid);
        if (!studentData) {
            studentData = await checkGranteeRecord(rawIdentifier);
        }
        if (!studentData && userEmail) {
            studentData = await checkGranteeRecord(userEmail);
        }

        // If NOT in student_grantees table, strictly deny login and sign out!
        if (!studentData) {
            try {
                await supabaseClient.auth.signOut();
                localStorage.removeItem(STUDENT_STORAGE_KEY);
                sessionStorage.removeItem(STUDENT_STORAGE_KEY);
            } catch (_) {}
            throw new Error(`Access denied. Student ID "${rawIdentifier}" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.`);
        }

        // Log student activity
        try {
            await supabaseClient.from('audit_logs').insert({
                action: 'Logged in via Portal',
                userName: studentData?.full_name || studentData?.fullName || 'Student Grantee',
                role: 'Student',
                studentId: studentData?.student_no || studentData?.studentId || rawIdentifier,
            });
        } catch (_) {}

        await new Promise(r => setTimeout(r, 300));

        // Save Student session to student storage key
        if (authSession) {
            try {
                localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(authSession));
                sessionStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(authSession));
            } catch (_) {}
        }

        // Route to Student Dashboard with session tokens in hash
        const primaryStudentId = studentData?.student_no || studentData?.studentId || rawIdentifier;
        const tokenHash = authSession ? `#access_token=${encodeURIComponent(authSession.access_token)}&refresh_token=${encodeURIComponent(authSession.refresh_token)}&student_id=${encodeURIComponent(primaryStudentId)}` : '';

        if (window.location.protocol === 'file:') {
            window.location.href = `../student_web/dashboard.html${tokenHash}`;
        } else {
            window.location.href = `/student_web/dashboard.html${tokenHash}`;
        }
    } else {
        // User is Admin / Super Admin!
        const isSuper = (adminData?.role === 'Super Admin' || adminData?.role === 'SuperAdmin' || userEmail.includes('superadmin'));
        const roleLabel = isSuper ? 'Super Admin' : (adminData?.role || 'Admin');
        const adminName = adminData?.username || (isSuper ? 'Super Admin' : 'Admin');

        try {
            await supabaseClient.from('audit_logs').insert({
                action: 'Logged in via Admin Portal',
                userName: adminName,
                role: roleLabel,
                studentId: isSuper ? 'superadmin' : 'admin',
            });
        } catch (_) {}

        // Persist session to the specific role's isolated storage
        if (authSession) {
            try {
                if (isSuper) {
                    localStorage.setItem(SUPERADMIN_STORAGE_KEY, JSON.stringify(authSession));
                    sessionStorage.setItem(SUPERADMIN_STORAGE_KEY, JSON.stringify(authSession));
                } else {
                    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(authSession));
                    sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(authSession));
                }
            } catch (_) {}
        }

        await new Promise(r => setTimeout(r, 300));
        
        // Route to respective portal
        if (isSuper) {
            if (window.location.protocol === 'file:') {
                window.location.href = '../superadmin_web/superadmin.html';
            } else {
                window.location.href = '/superadmin_web/superadmin.html';
            }
        } else {
            if (window.location.protocol === 'file:') {
                window.location.href = '../admin_web/admin.html';
            } else {
                window.location.href = '/admin_web/admin.html';
            }
        }
    }
}

// Handle Form Submission
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const rawIdentifier = identifierInput ? identifierInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';

        if (!rawIdentifier || !password) return;

        setLoading(true);

        try {
            let authResponse = null;
            const lowerId = rawIdentifier.toLowerCase();
            let isAdmin = lowerId === 'admin' || lowerId === 'superadmin' || lowerId.includes('admin@');
            let matchedAdminEmail = null;

            // Strategy 0: Check if identifier matches an admin username (custom or default)
            if (!rawIdentifier.includes('@')) {
                try {
                    const { data: adminRows } = await supabaseClient
                        .from('admins')
                        .select('email, username')
                        .ilike('username', rawIdentifier.trim())
                        .limit(1);
                    if (adminRows && adminRows.length > 0 && adminRows[0].email) {
                        matchedAdminEmail = adminRows[0].email;
                        isAdmin = true;
                    }
                } catch (_) {}

                if (!matchedAdminEmail) {
                    if (lowerId === 'superadmin') {
                        matchedAdminEmail = 'superadmin@scholardoc.com';
                        isAdmin = true;
                    } else if (lowerId === 'admin') {
                        matchedAdminEmail = 'admin@scholardoc.com';
                        isAdmin = true;
                    }
                }
            } else {
                try {
                    const { data: adminRows } = await supabaseClient
                        .from('admins')
                        .select('email, username')
                        .ilike('email', rawIdentifier.trim())
                        .limit(1);
                    if (adminRows && adminRows.length > 0) {
                        isAdmin = true;
                        matchedAdminEmail = adminRows[0].email;
                    }
                } catch (_) {}
            }

            if (isAdmin) {
                // Admin / Super Admin login flow
                const adminEmailToUse = matchedAdminEmail || getAdminEmail(rawIdentifier);
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: adminEmailToUse,
                    password: password,
                });
                if (error || !data.user) {
                    throw new Error('Invalid administrator credentials.');
                }
                authResponse = data;
            } else {
                // --- MANDATORY STUDENT GRANTEE VALIDATION ---
                // STRICT CHECK: Student MUST exist in student_grantees table before attempting login!
                const cleanId = rawIdentifier.trim();
                const granteeRecord = await checkGranteeRecord(cleanId);

                if (!granteeRecord) {
                    throw new Error(`Access denied. Student ID "${cleanId}" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.`);
                }

                // --- FIRST-LOGIN SECURITY VERIFICATION: SMS OTP GATE ---
                // Validate student credentials and check if first-login OTP is required
                const otpRes = await fetch('/api/auth/student-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId: cleanId,
                        password: password
                    })
                });
                const otpData = await otpRes.json();

                if (!otpRes.ok) {
                    if (otpRes.status === 403) {
                        throw new Error(`Access denied. Student ID "${cleanId}" is not registered as an eligible grantee in the scholarship database. Only official student grantees can log in.`);
                    }
                    if (otpRes.status === 401) {
                        throw new Error(otpData.error || 'Invalid initial credentials. On your first login, please enter your Student ID as both your username and password.');
                    }
                    if (otpRes.status === 429) {
                        throw new Error(otpData.error || 'Too many OTP requests. Please wait before trying again.');
                    }
                    throw new Error(otpData.error || otpData.message || 'Login failed. Please check your credentials.');
                }

                // If First Login: DO NOT ALLOW ACCESS TO SYSTEM. Redirect to OTP verification page!
                if (otpData.requiresOtp === true) {
                    try {
                        sessionStorage.setItem('scholardoc_pending_otp_student', JSON.stringify({
                            studentId: cleanId,
                            password: password,
                            maskedPhone: otpData.maskedPhone,
                            expiresIn: otpData.expiresIn || 300,
                            resendCooldown: otpData.resendCooldown || 60
                        }));
                    } catch (_) {}
                    window.location.href = `/otp.html?student_id=${encodeURIComponent(cleanId)}&phone=${encodeURIComponent(otpData.maskedPhone || '')}`;
                    return;
                }

                // Returning Student: Proceed with existing authentication flow
                // Legitimate student grantee verified! Gather candidate credentials
                const primaryNo = (granteeRecord.student_no || granteeRecord.studentId || cleanId).trim();
                const primaryEmail = getStudentEmail(primaryNo);

                const candidateEmails = new Set();
                const candidatePasswords = new Set();

                candidateEmails.add(primaryEmail);
                candidateEmails.add(getStudentEmail(cleanId));
                if (granteeRecord.email_address) candidateEmails.add(granteeRecord.email_address.trim());
                if (granteeRecord.email) candidateEmails.add(granteeRecord.email.trim());
                if (granteeRecord.authEmail) candidateEmails.add(granteeRecord.authEmail.trim());

                function addCandidatePassword(p) {
                    if (!p) return;
                    const c = String(p).trim();
                    if (c.length >= 6) candidatePasswords.add(c);
                    candidatePasswords.add(formatAuthPassword(c));
                }

                addCandidatePassword(password);
                addCandidatePassword(cleanId);
                addCandidatePassword(primaryNo);

                // Attempt sign-in with candidate credentials
                for (const em of candidateEmails) {
                    for (const pwd of candidatePasswords) {
                        if (pwd.length < 6) continue;
                        try {
                            const { data, error } = await supabaseClient.auth.signInWithPassword({
                                email: em,
                                password: pwd,
                            });
                            if (!error && data.user) {
                                authResponse = data;
                                break;
                            }
                        } catch (_) {}
                    }
                    if (authResponse && authResponse.user) break;
                }

                // Auto-provision if legitimate student grantee exists in DB but has no Auth account yet
                if (!authResponse || !authResponse.user) {
                    const autoPwd = formatAuthPassword(password || primaryNo);
                    try {
                        const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
                            email: primaryEmail,
                            password: autoPwd,
                        });
                        if (!signUpErr && signUpData && signUpData.user) {
                            authResponse = signUpData;
                            try {
                                await supabaseClient
                                    .from('student_grantees')
                                    .update({ uid: signUpData.user.id })
                                    .or(`student_no.eq.${encodeURIComponent(primaryNo)},studentId.eq.${encodeURIComponent(primaryNo)}`);
                            } catch (_) {}
                        } else if (signUpErr) {
                            const errMsg = (signUpErr.message || '').toLowerCase();
                            if (errMsg.includes('already registered') || errMsg.includes('user already exists')) {
                                throw new Error(`Incorrect password for Student ID "${cleanId}". Please enter your registered password.`);
                            }
                        }
                    } catch (spErr) {
                        if (spErr.message && spErr.message.includes('Incorrect password')) {
                            throw spErr;
                        }
                    }
                }
            }

            if (!authResponse || !authResponse.user) {
                throw new Error('Invalid credentials. Please verify your Student ID/Username and password.');
            }

            // Automatically route user to the appropriate dashboard based on their verified account role
            await routeUserByRole(authResponse.user, rawIdentifier, authResponse.session);

        } catch (err) {
            const rawMsg = (err.message || '').replace(/^Exception:\s*/i, '').trim();
            const lower = rawMsg.toLowerCase();
            const isGranteeError = lower.includes('eligible grantee') ||
                                   lower.includes('access denied') ||
                                   lower.includes('student_grantees') ||
                                   lower.includes('not registered as an eligible grantee');

            if (isGranteeError) {
                showGranteeAccessDeniedModal(rawIdentifier);
            } else {
                showError(rawMsg || 'Failed to sign in. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    });
}

// Adjust input placeholder dynamically according to viewport size
function updateResponsivePlaceholder() {
    if (identifierInput) {
        if (window.innerWidth <= 768) {
            identifierInput.placeholder = 'e.g. 2024-00123';
        } else {
            identifierInput.placeholder = 'e.g. 2024-00123 or admin';
        }
    }
}
window.addEventListener('resize', updateResponsivePlaceholder);
updateResponsivePlaceholder();
