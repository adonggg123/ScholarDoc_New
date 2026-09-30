// js/views/settings.js
const supabase = window.supabaseClient;
const SUPABASE_URL = 'https://ywavesulvkqwpsejprxp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

const accounts = {
    superadmin: {
        role: 'Super Admin',
        email: 'superadmin@scholardoc.com',
        username: 'superadmin',
        badge: 'Platform Master',
        color: 'linear-gradient(135deg, #0F3260, #D4AF37)',
        icon: 'icon-shield-check'
    },
    admin: {
        role: 'Admin',
        email: 'admin@scholardoc.com',
        username: 'admin',
        badge: 'Registrar & Billing',
        color: 'linear-gradient(135deg, #1E88E5, #0288D1)',
        icon: 'icon-shield'
    }
};

let activeTarget = 'superadmin';

function showToast(message, type = 'success') {
    let toast = document.getElementById('settings-toast-popup');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'settings-toast-popup';
        toast.style.cssText = 'position: fixed; bottom: 28px; right: 28px; z-index: 99999; padding: 14px 22px; border-radius: 12px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(14px); font-family: inherit;';
        document.body.appendChild(toast);
    }
    const isError = type === 'error';
    toast.style.background = isError ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)';
    toast.style.color = '#FFFFFF';
    toast.innerHTML = `<i class="${isError ? 'icon-alert-circle' : 'icon-check-circle'}" style="font-size: 18px;"></i> <span>${message}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(14px)';
    }, 4500);
}

async function loadAdminsData() {
    try {
        const { data, error } = await supabase.from('admins').select('*');
        if (data && data.length > 0) {
            data.forEach(adm => {
                const isSuper = (adm.role === 'Super Admin' || adm.role === 'SuperAdmin' || (adm.email && adm.email.includes('superadmin')));
                const key = isSuper ? 'superadmin' : 'admin';
                if (accounts[key]) {
                    accounts[key].username = adm.username || accounts[key].username;
                    accounts[key].email = adm.email || accounts[key].email;
                    accounts[key].uid = adm.uid;
                }
            });
        }
        updateActiveAccountView();
        updateProfileCard();
    } catch (err) {
        console.error('Error fetching admins table:', err);
    }
}

function updateProfileCard() {
    const admin = window.currentAdmin;
    if (!admin) return;

    const roleEl = document.getElementById('settings-account-role');
    const emailEl = document.getElementById('settings-account-email');
    const usernameEl = document.getElementById('settings-account-username');
    const scopeEl = document.getElementById('settings-access-scope');

    const isSuper = admin.displayRole === 'Super Admin';

    if (roleEl) roleEl.textContent = admin.displayRole || 'Administrator';
    if (emailEl) emailEl.textContent = admin.email || (isSuper ? 'superadmin@scholardoc.com' : 'admin@scholardoc.com');
    if (usernameEl) usernameEl.textContent = admin.username || (isSuper ? 'superadmin' : 'admin');
    if (scopeEl) {
        scopeEl.textContent = isSuper
            ? 'Full Platform Management'
            : 'Annex 5 TES Generator & Settings';
    }
}

function updateActiveAccountView() {
    const acc = accounts[activeTarget];
    if (!acc) return;

    const roleNameEl = document.getElementById('target-account-role-name');
    const emailEl = document.getElementById('target-account-email');
    const badgeEl = document.getElementById('target-account-badge');
    const usernameDisplayEl = document.getElementById('target-account-username-display');
    const inputUsername = document.getElementById('input-edit-username');
    const avatarEl = document.getElementById('target-account-avatar');
    const iconEl = document.getElementById('target-account-icon');

    if (roleNameEl) roleNameEl.textContent = acc.role;
    if (emailEl) emailEl.textContent = acc.email;
    if (badgeEl) badgeEl.textContent = acc.badge;
    if (usernameDisplayEl) usernameDisplayEl.textContent = acc.username;
    if (inputUsername) inputUsername.value = acc.username;
    if (avatarEl) avatarEl.style.background = acc.color;
    if (iconEl) iconEl.className = acc.icon;

    // Reset password fields
    const curPw = document.getElementById('input-current-password');
    const newPw = document.getElementById('input-new-password');
    const confPw = document.getElementById('input-confirm-password');
    if (curPw) curPw.value = '';
    if (newPw) newPw.value = '';
    if (confPw) confPw.value = '';

    if (window.lucide) window.lucide.createIcons();
}

async function handleSaveUsername() {
    const input = document.getElementById('input-edit-username');
    const btn = document.getElementById('btn-submit-username');
    const newUsername = (input?.value || '').trim();

    if (!newUsername || newUsername.length < 3) {
        showToast('Username must be at least 3 characters.', 'error');
        if (input) input.focus();
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        showToast('Username may only contain letters, numbers, hyphens, and underscores.', 'error');
        if (input) input.focus();
        return;
    }

    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';

    try {
        const acc = accounts[activeTarget];
        const { error } = await supabase
            .from('admins')
            .update({ username: newUsername })
            .eq('email', acc.email);

        if (error) throw error;

        acc.username = newUsername;
        const usernameDisplay = document.getElementById('target-account-username-display');
        if (usernameDisplay) usernameDisplay.textContent = newUsername;

        // If updating the active logged-in admin's username
        if (window.currentAdmin && (window.currentAdmin.email === acc.email || (activeTarget === 'superadmin' && window.currentAdmin.displayRole === 'Super Admin'))) {
            window.currentAdmin.username = newUsername;
            const profileName = document.getElementById('profile-name');
            if (profileName) profileName.textContent = window.currentAdmin.displayRole;
            const accountUsername = document.getElementById('settings-account-username');
            if (accountUsername) accountUsername.textContent = newUsername;
        }

        // Log in audit_logs
        try {
            await supabase.from('audit_logs').insert([{
                action: `Updated username for ${acc.role} to "${newUsername}"`,
                userName: window.currentAdmin?.username || 'Super Admin',
                role: 'Super Admin',
                timestamp: new Date().toISOString()
            }]);
        } catch (_) { }

        showToast(`Username for ${acc.role} updated successfully!`, 'success');
    } catch (err) {
        console.error('Save username error:', err);
        showToast('Failed to save username: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function handleSavePassword() {
    const curPwInput = document.getElementById('input-current-password');
    const newPwInput = document.getElementById('input-new-password');
    const confPwInput = document.getElementById('input-confirm-password');
    const btn = document.getElementById('btn-submit-password');

    const currentPw = curPwInput?.value || '';
    const newPw = newPwInput?.value || '';
    const confPw = confPwInput?.value || '';

    if (!currentPw) {
        showToast('Please enter the current password (default: admin123).', 'error');
        curPwInput?.focus();
        return;
    }

    if (!newPw || newPw.length < 6) {
        showToast('New password must be at least 6 characters long.', 'error');
        newPwInput?.focus();
        return;
    }

    if (newPw !== confPw) {
        showToast('New password and confirmation do not match.', 'error');
        confPwInput?.focus();
        return;
    }

    if (newPw === currentPw) {
        showToast('New password must be different from current password.', 'error');
        newPwInput?.focus();
        return;
    }

    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Updating...';

    try {
        const acc = accounts[activeTarget];
        const isSelf = window.currentAdmin?.email === acc.email;

        if (isSelf) {
            // Update currently logged-in user password
            const { error: testErr } = await supabase.auth.signInWithPassword({
                email: acc.email,
                password: currentPw
            });
            if (testErr) {
                throw new Error('Current password is incorrect.');
            }

            const { error: updateErr } = await supabase.auth.updateUser({
                password: newPw
            });
            if (updateErr) throw updateErr;
        } else {
            // Update other admin account using an isolated client (without clearing current Super Admin session)
            const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false }
            });

            const { error: loginErr } = await tempClient.auth.signInWithPassword({
                email: acc.email,
                password: currentPw
            });
            if (loginErr) {
                throw new Error(`Current password for ${acc.role} is incorrect. (Default is admin123)`);
            }

            const { error: updateErr } = await tempClient.auth.updateUser({
                password: newPw
            });
            if (updateErr) throw updateErr;
        }

        // Log in audit_logs
        try {
            await supabase.from('audit_logs').insert([{
                action: `Updated password for ${acc.role} account`,
                userName: window.currentAdmin?.username || 'Super Admin',
                role: 'Super Admin',
                timestamp: new Date().toISOString()
            }]);
        } catch (_) { }

        showToast(`Password for ${acc.role} successfully changed!`, 'success');
        if (curPwInput) curPwInput.value = '';
        if (newPwInput) newPwInput.value = '';
        if (confPwInput) confPwInput.value = '';
    } catch (err) {
        console.error('Update password error:', err);
        showToast(err.message || 'Failed to update password.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
    }
}

function setupListeners() {
    // Tab switching for Super Admin / Admin accounts
    const tabSuper = document.getElementById('tab-account-superadmin');
    const tabAdmin = document.getElementById('tab-account-admin');

    if (tabSuper) {
        tabSuper.addEventListener('click', () => {
            activeTarget = 'superadmin';
            tabSuper.classList.add('active');
            if (tabAdmin) tabAdmin.classList.remove('active');
            updateActiveAccountView();
        });
    }

    if (tabAdmin) {
        tabAdmin.addEventListener('click', () => {
            activeTarget = 'admin';
            tabAdmin.classList.add('active');
            if (tabSuper) tabSuper.classList.remove('active');
            updateActiveAccountView();
        });
    }

    // Password visibility toggles
    document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const isPw = input.type === 'password';
            input.type = isPw ? 'text' : 'password';

            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isPw ? 'icon-eye-off' : 'icon-eye';
            }
        });
    });

    // Save buttons
    const btnSaveUsername = document.getElementById('btn-submit-username');
    if (btnSaveUsername) {
        btnSaveUsername.addEventListener('click', handleSaveUsername);
    }

    const btnSavePassword = document.getElementById('btn-submit-password');
    if (btnSavePassword) {
        btnSavePassword.addEventListener('click', handleSavePassword);
    }

    // Quick scroll to password section from Security card
    const quickPw = document.getElementById('btn-quick-change-pw');
    if (quickPw) {
        quickPw.addEventListener('click', () => {
            const pwInput = document.getElementById('input-current-password');
            if (pwInput) {
                pwInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                pwInput.focus();
            }
        });
    }
}

// Init
setupListeners();
loadAdminsData();
setupListeners();
loadAdminsData();
