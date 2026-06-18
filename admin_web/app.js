// Supabase Configuration
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Initialize Lucide Icons
lucide.createIcons();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
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
    
    // Update Icon
    togglePwdBtn.innerHTML = '';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', obscurePassword ? 'eye' : 'eye-off');
    togglePwdBtn.appendChild(icon);
    lucide.createIcons();
});

// Helper to construct Auth email (matching Dart implementation)
function getAdminEmail(username) {
    if (username.includes('@')) {
        return username.toLowerCase();
    }
    if (username.toLowerCase() === 'admin') {
        return 'admin@scholardoc.com';
    }
    return `${username.toLowerCase()}@scholardoc.com`;
}

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) return;

    // Set Loading State
    loginBtn.disabled = true;
    loginBtnText.style.display = 'none';
    loginBtnIcon.style.display = 'none';
    loginSpinner.classList.remove('hidden');

    try {
        const adminEmail = getAdminEmail(username);
        
        // 1. Attempt to sign in
        const { data, error } = await supabase.auth.signInWithPassword({
            email: adminEmail,
            password: password,
        });

        if (error) throw error;

        // Wait a moment for visual feedback
        await new Promise(r => setTimeout(r, 500));
        
        // Redirect to admin main layout
        window.location.href = 'admin.html';

    } catch (err) {
        alert(err.message || "Failed to login. Please check your credentials.");
    } finally {
        // Reset Loading State
        loginBtn.disabled = false;
        loginBtnText.style.display = 'block';
        loginBtnIcon.style.display = 'block';
        loginSpinner.classList.add('hidden');
    }
});
