// ScholarDoc Unified Web Login Controller
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

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

// Toast notification helper
function showError(message) {
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `<i data-lucide="alert-circle"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function setLoading(loading) {
    if (loginBtn) loginBtn.disabled = loading;
    if (loginBtnText) loginBtnText.style.display = loading ? 'none' : 'block';
    if (loginBtnIcon) loginBtnIcon.style.display = loading ? 'none' : 'block';
    if (loginSpinner) loginSpinner.classList.toggle('hidden', !loading);
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
        // Check if student record exists in DB by uid or studentId or email
        let studentData = null;
        const { data: byUid } = await supabaseClient
            .from('students')
            .select('*')
            .eq('uid', uid)
            .limit(1);

        if (byUid && byUid.length > 0) {
            studentData = byUid[0];
        } else {
            const cleanId = rawIdentifier.trim();
            const { data: byId } = await supabaseClient
                .from('students')
                .select('*')
                .or(`studentId.eq.${cleanId},authEmail.eq.${cleanId},email.eq.${cleanId}`)
                .limit(1);
            if (byId && byId.length > 0) {
                studentData = byId[0];
            }
        }

        // Log student activity
        try {
            await supabaseClient.from('audit_logs').insert({
                action: 'Logged in via Portal',
                userName: studentData?.fullName || 'Student',
                role: 'Student',
                studentId: studentData?.studentId || rawIdentifier,
            });
        } catch (_) {}

        await new Promise(r => setTimeout(r, 300));

        // Route to Student Dashboard with session tokens in hash
        const tokenHash = authSession ? `#access_token=${encodeURIComponent(authSession.access_token)}&refresh_token=${encodeURIComponent(authSession.refresh_token)}&student_id=${encodeURIComponent(studentData?.studentId || rawIdentifier)}` : '';

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

        await new Promise(r => setTimeout(r, 300));
        
        // Route to Admin Dashboard
        if (window.location.protocol === 'file:') {
            window.location.href = '../admin_web/admin.html';
        } else {
            window.location.href = '/admin_web/admin.html';
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

            // Strategy 1: Attempt Student login via ID email (e.g. 2023305311@scholardoc.com)
            if (!rawIdentifier.includes('@') && lowerId !== 'admin' && lowerId !== 'superadmin') {
                const studentEmail = getStudentEmail(rawIdentifier);
                try {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: studentEmail,
                        password: password,
                    });
                    if (!error && data.user) {
                        authResponse = data;
                    }
                } catch (_) {}
            }

            // Strategy 2: Attempt Admin / Super Admin login (e.g. superadmin@scholardoc.com or admin@scholardoc.com)
            if (!authResponse) {
                const adminEmail = getAdminEmail(rawIdentifier);
                try {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: adminEmail,
                        password: password,
                    });
                    if (!error && data.user) {
                        authResponse = data;
                    }
                } catch (_) {}
            }

            // Strategy 3: Lookup student by studentId to get Gmail / authEmail
            if (!authResponse && !rawIdentifier.includes('@')) {
                const { data: studentRecords } = await supabaseClient
                    .from('students')
                    .select('*')
                    .eq('studentId', rawIdentifier)
                    .limit(1);

                if (studentRecords && studentRecords.length > 0) {
                    const s = studentRecords[0];
                    const emailsToTry = [s.authEmail, s.email].filter(Boolean);
                    for (const em of emailsToTry) {
                        try {
                            const { data, error } = await supabaseClient.auth.signInWithPassword({
                                email: em,
                                password: password,
                            });
                            if (!error && data.user) {
                                authResponse = data;
                                break;
                            }
                        } catch (_) {}
                    }
                }
            }

            // Strategy 4: Direct email login fallback
            if (!authResponse && rawIdentifier.includes('@')) {
                try {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: rawIdentifier.toLowerCase(),
                        password: password,
                    });
                    if (!error && data.user) {
                        authResponse = data;
                    }
                } catch (_) {}
            }

            if (!authResponse || !authResponse.user) {
                throw new Error('Invalid credentials. Please verify your Student ID/Username and password.');
            }

            // Automatically route user to the appropriate dashboard based on their account role
            await routeUserByRole(authResponse.user, rawIdentifier, authResponse.session);

        } catch (err) {
            showError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    });
}
