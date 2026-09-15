// js/views/settings.js
(function initSettings() {
    const admin = window.currentAdmin;
    if (!admin) return;

    const roleEl = document.getElementById('settings-account-role');
    const emailEl = document.getElementById('settings-account-email');
    const scopeEl = document.getElementById('settings-access-scope');

    const isSuper = admin.displayRole === 'Super Admin';

    if (roleEl) roleEl.textContent = admin.displayRole || 'Administrator';
    if (emailEl) emailEl.textContent = admin.email || (isSuper ? 'superadmin@scholardoc.com' : 'admin@scholardoc.com');
    if (scopeEl) {
        scopeEl.textContent = isSuper 
            ? 'Full Platform Management' 
            : 'Annex 5 TES Generator & Settings';
    }
})();
