// ScholarDoc Student Web — Login Logic
// Mirrors auth_service.dart loginStudent() flow exactly

const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Initialize Lucide Icons
lucide.createIcons();

// Check if already logged in
(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        // Verify this is a student (not admin)
        const { data } = await supabaseClient
            .from('students')
            .select('uid')
            .eq('uid', session.user.id)
            .limit(1);
        if (data && data.length > 0) {
            window.location.href = 'dashboard.html';
            return;
        }
    }
})();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const studentIdInput = document.getElementById('studentId');
const passwordInput = document.getElementById('password');
const togglePwdBtn = document.getElementById('togglePwd');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginBtnIcon = document.getElementById('loginBtnIcon');
const loginSpinner = document.getElementById('loginSpinner');

// Toggle Password Visibility
let obscurePassword = true;
togglePwdBtn.addEventListener('click', () => {
    obscurePassword = !obscurePassword;
    passwordInput.type = obscurePassword ? 'password' : 'text';
    
    togglePwdBtn.innerHTML = '';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', obscurePassword ? 'eye' : 'eye-off');
    togglePwdBtn.appendChild(icon);
    lucide.createIcons();
});

// Helper to construct Auth email (matching Dart _getAuthEmail)
function getAuthEmail(studentId) {
    return `${studentId.trim().replaceAll(' ', '_')}@scholardoc.com`;
}

// Show error toast
function showError(message) {
    // Remove existing toast
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `<i data-lucide="alert-circle"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Set loading state
function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtnText.style.display = loading ? 'none' : 'block';
    loginBtnIcon.style.display = loading ? 'none' : 'block';
    loginSpinner.classList.toggle('hidden', !loading);
}

// Handle Login — mirrors auth_service.dart loginStudent() exactly
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const studentId = studentIdInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!studentId || !password) return;

    setLoading(true);

    try {
        const authEmail = getAuthEmail(studentId);
        let authResponse = null;

        // --- Step 1: Try ID-based email (new accounts) ---
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: authEmail,
                password: password,
            });
            if (error) throw error;
            authResponse = data;
        } catch (err) {
            const msg = (err.message || '').toLowerCase();
            if (!msg.includes('invalid login') && !msg.includes('not found')) {
                throw err;
            }
            // Fall through to Step 2
        }

        // --- Step 2: Fallback — look up student by ID and try their Gmail ---
        if (!authResponse) {
            const { data: studentRecords, error: queryError } = await supabaseClient
                .from('students')
                .select()
                .eq('studentId', studentId)
                .limit(1);

            if (queryError) throw queryError;

            if (!studentRecords || studentRecords.length === 0) {
                throw new Error(`No account found for Student ID "${studentId}". Please register first using the mobile app.`);
            }

            const studentData = studentRecords[0];
            const gmail = studentData.email;

            if (!gmail) {
                throw new Error('Account data is incomplete. Please contact your administrator.');
            }

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: gmail,
                    password: password,
                });
                if (error) throw error;
                authResponse = data;
            } catch (err) {
                throw new Error('Login failed. Please verify your Student ID and password.');
            }
        }

        // --- Step 3: Verify student record exists ---
        if (authResponse && authResponse.user) {
            const uid = authResponse.user.id;
            const { data: doc, error: docErr } = await supabaseClient
                .from('students')
                .select()
                .eq('uid', uid);

            if (docErr || !doc || doc.length === 0) {
                await supabaseClient.auth.signOut();
                throw new Error('Student record not found. Please register first using the mobile app.');
            }

            // Log activity
            try {
                await supabaseClient.from('audit_logs').insert({
                    action: 'Logged in via Student Web Portal',
                    userName: doc[0].fullName || 'Student',
                    role: 'Student',
                    studentId: studentId,
                });
            } catch (_) { /* non-critical */ }

            // Set presence
            try {
                await supabaseClient.from('presence').upsert({
                    uid: uid,
                    isOnline: true,
                    lastSeen: new Date().toISOString(),
                });
            } catch (_) { /* non-critical */ }

            // Visual feedback before redirect
            await new Promise(r => setTimeout(r, 400));
            window.location.href = 'dashboard.html';
        }

    } catch (err) {
        showError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
        setLoading(false);
    }
});

