// js/views/settings.js
const supabase = window.supabaseClient;
const SUPABASE_URL = 'https://ywavesulvkqwpsejprxp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

const accounts = {
    admin: {
        role: 'Admin',
        email: 'admin@scholardoc.com',
        username: 'admin',
        badge: 'Registrar & Billing',
        color: 'linear-gradient(135deg, #1E88E5, #0288D1)',
        icon: 'icon-shield'
    },
    superadmin: {
        role: 'Super Admin',
        email: 'superadmin@scholardoc.com',
        username: 'superadmin',
        badge: 'Platform Master',
        color: 'linear-gradient(135deg, #0F3260, #D4AF37)',
        icon: 'icon-shield-check'
    }
};

let activeTarget = 'admin';

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
                const isSuper = (adm.role === 'Super Admin' || adm.role === 'SuperAdmin' || (adm.username && adm.username.toLowerCase() === 'superadmin') || (adm.email && adm.email.toLowerCase().includes('superadmin')));
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

    const profileName = document.getElementById('profile-name');
    if (profileName && admin.username) profileName.textContent = admin.username;
    const profileRole = document.getElementById('profile-role');
    if (profileRole && admin.username) profileRole.textContent = admin.username;
}

function updateActiveAccountView() {
    const acc = accounts[activeTarget];
    if (!acc) return;

    const roleNameEl = document.getElementById('target-account-role-name');
    const emailEl = document.getElementById('target-account-email');
    const badgeEl = document.getElementById('target-account-badge');
    const usernameDisplayEl = document.getElementById('target-account-username-display');
    const inputUsername = document.getElementById('input-edit-username');
    const inputEmail = document.getElementById('input-edit-email');
    const inputEmailPw = document.getElementById('input-email-current-password');
    const avatarEl = document.getElementById('target-account-avatar');
    const iconEl = document.getElementById('target-account-icon');

    if (roleNameEl) roleNameEl.textContent = acc.role;
    if (emailEl) emailEl.textContent = acc.email;
    if (badgeEl) badgeEl.textContent = acc.badge;
    if (usernameDisplayEl) usernameDisplayEl.textContent = acc.username;
    if (inputUsername) inputUsername.value = acc.username;
    if (inputEmail) inputEmail.value = acc.email;
    if (inputEmailPw) inputEmailPw.value = '';
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

async function handleSaveEmail() {
    const inputEmail = document.getElementById('input-edit-email');
    const inputPw = document.getElementById('input-email-current-password');
    const btn = document.getElementById('btn-submit-email');

    const newEmail = (inputEmail?.value || '').trim().toLowerCase();
    const currentPw = inputPw?.value || '';

    if (!newEmail) {
        showToast('Please enter a new email address.', 'error');
        if (inputEmail) inputEmail.focus();
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        showToast('Please enter a valid email address (e.g. name@domain.com).', 'error');
        if (inputEmail) inputEmail.focus();
        return;
    }

    const acc = accounts[activeTarget];
    if (newEmail === (acc.email || '').toLowerCase()) {
        showToast('The new email must be different from current email.', 'error');
        if (inputEmail) inputEmail.focus();
        return;
    }

    if (!currentPw) {
        showToast('Please enter the current password to authorize this email update.', 'error');
        if (inputPw) inputPw.focus();
        return;
    }

    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';

    try {
        // 1. Check if new email is already assigned to an admin account
        const { data: existingAdmins } = await supabase
            .from('admins')
            .select('email, role')
            .ilike('email', newEmail)
            .limit(1);

        if (existingAdmins && existingAdmins.length > 0) {
            throw new Error(`The email "${newEmail}" is already assigned to ${existingAdmins[0].role}.`);
        }

        // 2. Verify current credentials using an isolated client
        const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false }
        });

        const { error: curAuthErr } = await tempClient.auth.signInWithPassword({
            email: acc.email,
            password: currentPw
        });

        if (curAuthErr) {
            throw new Error(`Current password for ${acc.role} is incorrect.`);
        }

        // 3. Provision the new email in Supabase Auth with current password
        let newUid = null;
        const { data: signData, error: signErr } = await tempClient.auth.signUp({
            email: newEmail,
            password: currentPw,
            options: {
                data: {
                    role: acc.role,
                    username: acc.username
                }
            }
        });

        if (signErr) {
            if (signErr.message && (signErr.message.includes('already registered') || signErr.status === 422)) {
                const { data: existAuth, error: existErr } = await tempClient.auth.signInWithPassword({
                    email: newEmail,
                    password: currentPw
                });
                if (existErr || !existAuth?.user) {
                    throw new Error(`The email "${newEmail}" already exists with a different password. Please choose another email.`);
                }
                newUid = existAuth.user.id;
            } else {
                throw signErr;
            }
        } else if (signData?.user) {
            newUid = signData.user.id;
        }

        if (!newUid) {
            throw new Error('Unable to configure authentication credentials for the new email.');
        }

        // 4. Update the admins table in Supabase
        const oldEmail = acc.email;
        let updateQuery = supabase.from('admins').update({
            email: newEmail,
            uid: newUid
        });
        if (acc.uid) {
            updateQuery = updateQuery.eq('uid', acc.uid);
        } else {
            updateQuery = updateQuery.eq('email', oldEmail);
        }

        const { error: dbErr } = await updateQuery;
        if (dbErr) throw dbErr;

        // 5. Update local state
        acc.email = newEmail;
        acc.uid = newUid;

        const emailDisplay = document.getElementById('target-account-email');
        if (emailDisplay) emailDisplay.textContent = newEmail;

        const isSelf = window.currentAdmin && (
            window.currentAdmin.email === oldEmail ||
            (activeTarget === 'admin' && window.currentAdmin.displayRole === 'Admin') ||
            (activeTarget === 'superadmin' && window.currentAdmin.displayRole === 'Super Admin')
        );

        if (isSelf) {
            window.currentAdmin.email = newEmail;
            window.currentAdmin.uid = newUid;
            const profileEmail = document.getElementById('profile-email');
            if (profileEmail) profileEmail.textContent = newEmail;
            const accountEmail = document.getElementById('settings-account-email');
            if (accountEmail) accountEmail.textContent = newEmail;

            // Update active session with new email
            try {
                await window.supabaseClient.auth.signInWithPassword({
                    email: newEmail,
                    password: currentPw
                });
            } catch (_) {}
        }

        if (inputPw) inputPw.value = '';

        // 6. Audit log
        try {
            await supabase.from('audit_logs').insert([{
                action: `Updated email for ${acc.role} from "${oldEmail}" to "${newEmail}"`,
                userName: window.currentAdmin?.username || window.currentAdmin?.displayRole || 'Admin',
                role: window.currentAdmin?.displayRole || 'Admin',
                timestamp: new Date().toISOString()
            }]);
        } catch (_) {}

        showToast(`Email for ${acc.role} updated successfully!`, 'success');
    } catch (err) {
        console.error('Save email error:', err);
        showToast(err.message || 'Failed to update email.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
    }
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

    if (!/^[a-zA-Z0-9_\- ]+$/.test(newUsername)) {
        showToast('Username may only contain letters, numbers, spaces, hyphens, and underscores.', 'error');
        if (input) input.focus();
        return;
    }

    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';

    try {
        const acc = accounts[activeTarget];

        // Check if username is already taken by another admin
        const { data: existingUsers } = await supabase
            .from('admins')
            .select('username, email, role')
            .ilike('username', newUsername)
            .limit(2);

        if (existingUsers && existingUsers.some(u => (u.email || '').toLowerCase() !== (acc.email || '').toLowerCase())) {
            showToast(`Username "${newUsername}" is already taken by another admin.`, 'error');
            if (input) input.focus();
            return;
        }

        let updateQuery = supabase.from('admins').update({ username: newUsername });
        if (acc.uid) {
            updateQuery = updateQuery.eq('uid', acc.uid);
        } else {
            updateQuery = updateQuery.eq('email', acc.email);
        }

        const { error } = await updateQuery;
        if (error) throw error;

        acc.username = newUsername;
        const usernameDisplay = document.getElementById('target-account-username-display');
        if (usernameDisplay) usernameDisplay.textContent = newUsername;

        // If updating the active logged-in admin's username
        if (window.currentAdmin && (
            window.currentAdmin.email === acc.email ||
            (activeTarget === 'admin' && window.currentAdmin.displayRole === 'Admin') ||
            (activeTarget === 'superadmin' && window.currentAdmin.displayRole === 'Super Admin')
        )) {
            window.currentAdmin.username = newUsername;
            const profileName = document.getElementById('profile-name');
            if (profileName) profileName.textContent = newUsername;
            const profileRole = document.getElementById('profile-role');
            if (profileRole) profileRole.textContent = newUsername;
            const accountUsername = document.getElementById('settings-account-username');
            if (accountUsername) accountUsername.textContent = newUsername;
        }

        // Log in audit_logs
        try {
            await supabase.from('audit_logs').insert([{
                action: `Updated username for ${acc.role} to "${newUsername}"`,
                userName: window.currentAdmin?.username || window.currentAdmin?.displayRole || 'Admin',
                role: window.currentAdmin?.displayRole || 'Admin',
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
            // Update other admin account using an isolated client (without clearing current Admin session)
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
                userName: window.currentAdmin?.username || window.currentAdmin?.displayRole || 'Admin',
                role: window.currentAdmin?.displayRole || 'Admin',
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

async function loadNotificationSettings() {
    try {
        const emailCb = document.getElementById('set-email');
        const smsCb = document.getElementById('set-sms');
        const desktopCb = document.getElementById('set-desktop-notif');

        const savedEmail = localStorage.getItem('scholardoc_email_notifs');
        const savedSms = localStorage.getItem('scholardoc_sms_alerts');
        const savedDesktop = localStorage.getItem('scholardoc_desktop_notifs');

        if (emailCb) emailCb.checked = savedEmail !== null ? savedEmail === 'true' : true;
        if (smsCb) smsCb.checked = savedSms !== null ? savedSms === 'true' : false;
        if (desktopCb) desktopCb.checked = savedDesktop !== null ? savedDesktop === 'true' : true;

        const { data } = await supabase.from('system_settings').select('*').eq('key', 'notification_preferences').maybeSingle();
        if (data && data.value) {
            if (emailCb && data.value.email_notifications !== undefined) {
                emailCb.checked = data.value.email_notifications;
                localStorage.setItem('scholardoc_email_notifs', data.value.email_notifications);
            }
            if (smsCb && data.value.sms_alerts !== undefined) {
                smsCb.checked = data.value.sms_alerts;
                localStorage.setItem('scholardoc_sms_alerts', data.value.sms_alerts);
            }
        }
    } catch (err) {
        console.warn('Could not load notification settings from DB:', err);
    }
}

async function saveNotificationSettings(key, value) {
    try {
        localStorage.setItem(key === 'email' ? 'scholardoc_email_notifs' : (key === 'desktop' ? 'scholardoc_desktop_notifs' : 'scholardoc_sms_alerts'), value);

        if (key === 'desktop') {
            if (value && window.requestDesktopNotificationPermission) {
                window.requestDesktopNotificationPermission();
            }
            showToast(`Desktop Push Notifications ${value ? 'enabled' : 'disabled'}!`, 'success');
            return;
        }

        const emailVal = document.getElementById('set-email')?.checked ?? true;
        const smsVal = document.getElementById('set-sms')?.checked ?? false;

        try {
            await supabase.from('system_settings').upsert({
                key: 'notification_preferences',
                value: {
                    email_notifications: emailVal,
                    sms_alerts: smsVal,
                    updated_at: new Date().toISOString()
                }
            });
        } catch (_) {}

        try {
            await supabase.from('audit_logs').insert([{
                action: `Toggled ${key === 'email' ? 'Email Notifications' : 'SMS Critical Alerts'} to ${value ? 'Enabled' : 'Disabled'}`,
                userName: window.currentAdmin?.username || window.currentAdmin?.displayRole || 'Admin',
                role: window.currentAdmin?.displayRole || 'Admin',
                timestamp: new Date().toISOString()
            }]);
        } catch (_) {}

        showToast(`${key === 'email' ? 'Email Notifications' : 'SMS Critical Alerts'} ${value ? 'enabled' : 'disabled'}!`, 'success');
    } catch (err) {
        console.error('Error saving notification setting:', err);
        showToast(`${key === 'email' ? 'Email Notifications' : 'SMS Critical Alerts'} ${value ? 'enabled' : 'disabled'}`, 'success');
    }
}

function setupListeners() {
    // Notification settings checkboxes
    const setEmailCb = document.getElementById('set-email');
    if (setEmailCb) {
        setEmailCb.addEventListener('change', (e) => {
            saveNotificationSettings('email', e.target.checked);
        });
    }

    const setSmsCb = document.getElementById('set-sms');
    if (setSmsCb) {
        setSmsCb.addEventListener('change', (e) => {
            saveNotificationSettings('sms', e.target.checked);
        });
    }

    const setDesktopCb = document.getElementById('set-desktop-notif');
    if (setDesktopCb) {
        setDesktopCb.addEventListener('change', (e) => {
            saveNotificationSettings('desktop', e.target.checked);
        });
    }

    const testDesktopBtn = document.getElementById('btn-test-desktop-notif');
    if (testDesktopBtn) {
        testDesktopBtn.addEventListener('click', async () => {
            if (window.requestDesktopNotificationPermission) {
                await window.requestDesktopNotificationPermission();
            }
            if (window.showDesktopPopupNotification) {
                window.showDesktopPopupNotification({
                    id: 'test_admin_' + Date.now(),
                    title: 'Admin Push Alert Test',
                    message: 'Desktop notifications are active and working properly in the lower-right corner!',
                    type: 'success',
                    role: 'Admin'
                });
            }
            if (window.triggerSystemPushNotification) {
                window.triggerSystemPushNotification({
                    id: 'test_admin_os_' + Date.now(),
                    title: '[Admin] Push Notification Active',
                    message: 'Your Admin dashboard is connected and receiving real-time desktop push notifications.',
                    role: 'admin'
                });
            }
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
    const btnSaveEmail = document.getElementById('btn-submit-email');
    if (btnSaveEmail) {
        btnSaveEmail.addEventListener('click', handleSaveEmail);
    }

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
loadNotificationSettings();

