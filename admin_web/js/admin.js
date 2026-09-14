// Supabase Configuration
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

// Initialize global supabase client
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global Current Admin State
window.currentAdmin = null;

// Load Admin Profile Details
async function loadAdminProfile(user) {
    try {
        let adminDoc = null;
        if (user) {
            const { data } = await window.supabaseClient
                .from('admins')
                .select('*')
                .or(`uid.eq.${user.id},email.eq.${user.email}`)
                .limit(1);

            if (data && data.length > 0) {
                adminDoc = data[0];
            }
        }

        const email = user?.email || adminDoc?.email || '';
        const isSuper = (adminDoc?.role === 'Super Admin' || adminDoc?.role === 'SuperAdmin' || email.toLowerCase().includes('superadmin'));
        const displayRole = isSuper ? 'Super Admin' : (adminDoc?.role || 'Admin');
        const username = adminDoc?.username || (isSuper ? 'superadmin' : 'admin');

        window.currentAdmin = {
            uid: user?.id || adminDoc?.uid,
            email: email,
            username: username,
            role: adminDoc?.role || (isSuper ? 'Super Admin' : 'Admin'),
            displayRole: displayRole
        };

        // Update UI Elements
        const profileNameEl = document.getElementById('profile-name');
        const profileRoleEl = document.getElementById('profile-role');
        const profileEmailEl = document.getElementById('profile-email');

        if (profileNameEl) profileNameEl.textContent = displayRole;
        if (profileRoleEl) profileRoleEl.textContent = displayRole;
        if (profileEmailEl) profileEmailEl.textContent = email || (isSuper ? 'superadmin@scholardoc.com' : 'admin@scholardoc.com');

    } catch (e) {
        console.error('Error loading admin profile:', e);
    }
}

// Role-Based Navigation & View Access Controls
function applyRoleAccessControls() {
    const isSuperAdmin = window.currentAdmin?.displayRole === 'Super Admin';
    
    // Hide or show superadmin-only feature items in sidebar
    const superAdminItems = document.querySelectorAll('[data-role-req="superadmin"]');
    superAdminItems.forEach(el => {
        el.style.display = isSuperAdmin ? '' : 'none';
    });

    // Hide or show admin-only feature items in sidebar
    const adminItems = document.querySelectorAll('[data-role-req="admin"]');
    adminItems.forEach(el => {
        el.style.display = isSuperAdmin ? 'none' : '';
    });

    const divider = document.getElementById('sidebar-divider');
    if (divider) {
        divider.style.display = '';
    }

    // Determine initial view based on role
    const initialView = isSuperAdmin ? 'dashboard' : 'annex5_generator';
    
    // Set active nav item
    navItems.forEach(nav => nav.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-view="${initialView}"]`);
    if (targetNav) targetNav.classList.add('active');

    // Load initial view
    loadView(initialView);
}

// Check Authentication Session
async function checkSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
        return;
    }
    await loadAdminProfile(session.user);
    applyRoleAccessControls();
}

// Elements
const appContent = document.getElementById('app-content');
const topbarTitle = document.getElementById('topbar-title');
const topbarIcon = document.getElementById('topbar-icon');
const navItems = document.querySelectorAll('.nav-item[data-view]');
const validationMenuBtn = document.getElementById('validation-menu-btn');
const syncBtn = document.getElementById('sync-btn');
const syncStatus = document.getElementById('sync-status');
const profilePill = document.getElementById('profile-pill');
const profileDropdown = document.getElementById('profile-dropdown');
const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
const notificationBtn = document.getElementById('notification-btn');

// View Routing Map
const viewTitles = {
    'dashboard': 'Dashboard Overview',
    'student_records': 'Student Records',
    'scholarships': 'Scholarship Management',
    'sa_verification': 'SA Verification',
    'id_validation': 'ID Validation',
    'announcements': 'Announcement Management',
    'audit_logs': 'Activity Logs',
    'reports': 'Reports & Analytics',
    'settings': 'System Settings',
    'masterlist_import': 'Scholar Masterlist Import',
    'annex5_generator': 'CHED Annex 5 TES Generator'
};

// Icon class map matching Flutter's _getPageIcon()
const viewIcons = {
    'dashboard': 'icon-layout-dashboard',
    'student_records': 'icon-users',
    'scholarships': 'icon-graduation-cap',
    'sa_verification': 'icon-landmark',
    'id_validation': 'icon-badge-check',
    'announcements': 'icon-megaphone',
    'audit_logs': 'icon-history',
    'reports': 'icon-bar-chart-4',
    'settings': 'icon-settings',
    'masterlist_import': 'icon-file-text',
    'annex5_generator': 'icon-file-spreadsheet'
};

// Track current view for sync
let currentViewName = 'dashboard';

// Current loaded script to clean up
let currentScript = null;

// Load a View
async function loadView(viewName) {
    try {
        const isSuperAdmin = window.currentAdmin?.displayRole === 'Super Admin';

        // Restrict standard Admin to annex5_generator and settings
        if (window.currentAdmin && !isSuperAdmin && viewName !== 'settings' && viewName !== 'annex5_generator') {
            viewName = 'annex5_generator';
        }

        // Redirect masterlist_import to reports view with import tab selected
        if (viewName === 'masterlist_import') {
            window.requestedReportTab = 'import';
            viewName = 'reports';
        }

        // Fetch HTML partial
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error('View not found');
        const html = await response.text();
        
        // Inject HTML
        appContent.innerHTML = html;
        topbarTitle.textContent = viewTitles[viewName] || 'Admin';

        // Update page icon
        if (topbarIcon) {
            topbarIcon.className = viewIcons[viewName] || 'icon-layout-dashboard';
            topbarIcon.style.fontSize = '16px';
            topbarIcon.style.color = 'white';
        }

        // Track current view
        currentViewName = viewName;

        // Initialize Lucide icons for the newly injected HTML
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Remove old script if exists
        if (currentScript) {
            currentScript.remove();
        }

        // Load new JS module
        const script = document.createElement('script');
        script.type = 'module';
        script.src = `js/views/${viewName}.js?t=${Date.now()}`; // Add timestamp to prevent caching during dev
        document.body.appendChild(script);
        currentScript = script;

    } catch (err) {
        console.error('Error loading view:', err);
        appContent.innerHTML = `
            <div style="padding: 24px; color: var(--error);">
                <h2>Error Loading View</h2>
                <p>Could not load the requested screen: ${viewName}</p>
            </div>
        `;
    }
}

// ── Sync Button Handler (matches Flutter's _refreshSystem) ──────────
let isSyncing = false;

function showToast(message, icon = 'check-circle') {
    // Remove any existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="icon-${icon}" style="font-size: 18px;"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

window.showToast = showToast;


if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
        if (isSyncing) return;
        isSyncing = true;

        // Show syncing state
        syncBtn.classList.add('syncing');
        if (syncStatus) syncStatus.style.display = 'flex';

        // Simulate a brief delay (like Flutter's 600ms)
        await new Promise(resolve => setTimeout(resolve, 600));

        // Reload the current view
        await loadView(currentViewName);

        // Clear syncing state
        syncBtn.classList.remove('syncing');
        if (syncStatus) syncStatus.style.display = 'none';
        isSyncing = false;

        // Show success toast (matches Flutter's SnackBar)
        showToast('System synchronized with database.');
    });
}

// ── Theme Toggle System ──────────────────────────────────────────────
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');

function updateThemeToggleIcon(theme) {
    if (!themeToggleIcon) return;
    if (theme === 'dark') {
        themeToggleIcon.className = 'icon-sun';
    } else {
        themeToggleIcon.className = 'icon-moon';
    }
}

// Initial set based on localStorage/body class
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    updateThemeToggleIcon('dark');
} else {
    document.body.classList.remove('dark');
    updateThemeToggleIcon('light');
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        const theme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        updateThemeToggleIcon(theme);
        
        // Dispatch theme change event so that other elements (like charts) can respond
        window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: theme } }));
    });
}

// ── Profile Dropdown Toggle ─────────────────────────────────────────
if (profilePill && profileDropdown) {
    profilePill.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('profile-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}

// ── Logout (via dropdown) ───────────────────────────────────────────
if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out of the Admin Panel?')) {
            await window.supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        }
    });
}

// ── Real-Time Notifications System (Admin Web Interface) ────────────
let systemNotifications = [];
const notificationDropdown = document.getElementById('notification-dropdown');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

window.navigateToView = function(viewName, tabName) {
    const isSuperAdmin = window.currentAdmin?.displayRole === 'Super Admin';
    if (!isSuperAdmin && viewName !== 'settings' && viewName !== 'annex5_generator') {
        viewName = 'annex5_generator';
    }

    if (viewName === 'masterlist_import') {
        window.requestedReportTab = 'import';
        viewName = 'reports';
    } else if (tabName) {
        window.requestedReportTab = tabName;
    }

    // Find the nav item
    const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (targetNav) {
        navItems.forEach(nav => nav.classList.remove('active'));
        targetNav.classList.add('active');
        
        // Expand the validation sub-menu if targeting a validation sub-screen
        if (viewName === 'sa_verification' || viewName === 'id_validation') {
            const valMenu = document.getElementById('validation-menu-btn');
            if (valMenu && !valMenu.classList.contains('expanded')) {
                valMenu.click();
            }
        }
    }
    loadView(viewName);
};

window.navigateToReportsTab = function(tabName) {
    window.requestedReportTab = tabName;
    if (currentViewName === 'reports' && window.switchReportTab) {
        window.switchReportTab(tabName);
    } else {
        window.navigateToView('reports', tabName);
    }
};

async function loadNotifications() {
    try {
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .or('studentId.eq.admin,studentId.eq.superadmin')
            .order('timestamp', { ascending: false })
            .limit(20);
        if (error) throw error;

        systemNotifications = data || [];
        renderNotificationsDropdown();
        updateBellBadge();
    } catch (e) {
        console.error('Error loading notifications:', e);
    }
}

function updateBellBadge() {
    const unreadCount = systemNotifications.filter(n => !n.isRead).length;
    const badge = document.getElementById('bell-badge');
    if (!badge) return;

    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderNotificationsDropdown() {
    const container = document.getElementById('notification-items-container');
    if (!container) return;

    if (systemNotifications.length === 0) {
        container.innerHTML = `
            <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 12px; font-family: inherit;">
                No notifications yet.
            </div>
        `;
        return;
    }

    container.innerHTML = systemNotifications.map(n => {
        let iconClass = 'icon-info';
        let colorClass = 'var(--primary-color, #0F3260)';
        if (n.type === 'success') {
            iconClass = 'icon-check-circle-2';
            colorClass = 'var(--success, #4CAF50)';
        } else if (n.type === 'warning') {
            iconClass = 'icon-alert-circle';
            colorClass = 'var(--warning, #FF9800)';
        } else if (n.type === 'error') {
            iconClass = 'icon-x-circle';
            colorClass = 'var(--error, #F44336)';
        }

        const dateStr = n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const bg = n.isRead ? 'transparent' : 'var(--notification-unread-bg)';
        const border = n.isRead ? '1px solid transparent' : '1px solid var(--notification-unread-border)';

        return `
            <div class="notification-item" style="padding: 10px; border-radius: 10px; background: ${bg}; border: ${border}; display: flex; gap: 10px; cursor: pointer; transition: background 0.15s;" onclick="handleWebNotificationClick('${n.id}', '${n.title}')" onmouseover="this.style.background='var(--notification-unread-border)'" onmouseout="this.style.background='${bg}'">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: ${colorClass}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="${iconClass}" style="color: ${colorClass}; font-size: 14px;"></i>
                </div>
                <div style="flex: 1; min-width: 0; font-family: inherit;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                        <span style="font-weight: ${n.isRead ? '600' : '700'}; font-size: 12px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${n.title}</span>
                        <span style="font-size: 9px; color: var(--text-secondary); flex-shrink: 0;">${dateStr}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${n.message}</div>
                </div>
            </div>
        `;
    }).join('');

    // Re-initialize lucide icons for injected items
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

window.handleWebNotificationClick = async function(notificationId, title) {
    try {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ isRead: true })
            .eq('id', notificationId);
        if (error) throw error;

        // Close dropdown
        if (notificationDropdown) notificationDropdown.classList.add('hidden');

        // Redirect based on the notification title
        if (title.includes('SA Number')) {
            window.navigateToView('sa_verification');
        } else if (title.includes('ID Validation')) {
            window.navigateToView('id_validation');
        } else if (title.includes('Student Registered') || title.includes('Application')) {
            window.navigateToView('student_records');
        }

        // Reload notifications list
        loadNotifications();
    } catch (e) {
        console.error('Error handling notification click:', e);
    }
};

window.showWebPopupNotification = function(title, message, notificationId) {
    // Remove existing top toasts
    document.querySelectorAll('.top-toast-notification').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'top-toast-notification';
    toast.innerHTML = `
        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(15, 50, 96, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="icon-bell-ring" style="color: var(--primary-color); font-size: 16px;"></i>
        </div>
        <div style="flex: 1; min-width: 0; font-family: inherit;">
            <div style="font-weight: 800; font-size: 13px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${title}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.3;">${message}</div>
        </div>
        <i class="icon-chevron-right" style="color: var(--primary-color); font-size: 14px; flex-shrink: 0;"></i>
    `;

    toast.addEventListener('click', () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
        window.handleWebNotificationClick(notificationId, title);
    });

    document.body.appendChild(toast);

    if (window.lucide) {
        window.lucide.createIcons();
    }

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

function setupRealtimeNotifications() {
    window.supabaseClient
        .channel('admin-notifications')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications'
            },
            (payload) => {
                const target = payload.new?.studentId || payload.old?.studentId;
                if (target === 'admin' || target === 'superadmin') {
                    loadNotifications();
                    if (payload.eventType === 'INSERT') {
                        window.showWebPopupNotification(payload.new.title, payload.new.message, payload.new.id);
                    }
                }
            }
        )
        .subscribe();
}

if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
        loadNotifications();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('notification-dropdown-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            notificationDropdown.classList.add('hidden');
        }
    });
}

if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async () => {
        try {
            const unreadIds = systemNotifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadIds.length === 0) return;

            const { error } = await window.supabaseClient
                .from('notifications')
                .update({ isRead: true })
                .in('id', unreadIds);
            if (error) throw error;

            loadNotifications();
        } catch (e) {
            console.error('Error marking all as read:', e);
        }
    });
}


// Sidebar Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active class
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Load view
        const viewName = item.getAttribute('data-view');
        if (viewName) {
            loadView(viewName);
        }
    });
});

// Expandable Menus
if (validationMenuBtn) {
    validationMenuBtn.addEventListener('click', () => {
        validationMenuBtn.classList.toggle('expanded');
        const icon = validationMenuBtn.querySelector('.icon-chevron-down');
        if (icon) {
            icon.style.transform = validationMenuBtn.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Init notifications
    loadNotifications();
    setupRealtimeNotifications();

    // Init icons for main layout
    if (window.lucide) {
        window.lucide.createIcons();
    }
});
