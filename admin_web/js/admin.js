// Supabase Configuration
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

// Storage configuration for Admin (isolates Admin session from Super Admin & Student portals)
const ADMIN_STORAGE_KEY = 'scholardoc_admin_auth_token';

// Migrate legacy session if present and belongs to admin
try {
    if (!localStorage.getItem(ADMIN_STORAGE_KEY) && !sessionStorage.getItem(ADMIN_STORAGE_KEY)) {
        const legacy = localStorage.getItem('sb-ywavesulvkqwpsejprxp-auth-token');
        if (legacy) {
            const parsed = JSON.parse(legacy);
            const email = (parsed?.user?.email || '').toLowerCase();
            if (!email.includes('superadmin') && (email.includes('admin') || parsed?.user?.user_metadata?.role === 'Admin')) {
                localStorage.setItem(ADMIN_STORAGE_KEY, legacy);
                sessionStorage.setItem(ADMIN_STORAGE_KEY, legacy);
            }
        }
    }
} catch (_) { }

const adminStorage = {
    getItem: (key) => {
        try {
            return sessionStorage.getItem(key) || localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    },
    setItem: (key, value) => {
        try { sessionStorage.setItem(key, value); } catch (_) { }
        try { localStorage.setItem(key, value); } catch (_) { }
    },
    removeItem: (key) => {
        try { sessionStorage.removeItem(key); } catch (_) { }
        try { localStorage.removeItem(key); } catch (_) { }
    }
};

// Initialize global supabase client with isolated storage
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        storageKey: ADMIN_STORAGE_KEY,
        storage: adminStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

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

        if (profileNameEl) profileNameEl.textContent = username || displayRole;
        if (profileRoleEl) profileRoleEl.textContent = username || displayRole;
        if (profileEmailEl) profileEmailEl.textContent = email || (isSuper ? 'superadmin@scholardoc.com' : 'admin@scholardoc.com');

    } catch (e) {
        console.error('Error loading admin profile:', e);
    }
}

// Role-Based Navigation & View Access Controls
function applyRoleAccessControls() {
    const isSuperAdmin = window.currentAdmin?.displayRole === 'Super Admin';

    // Set active nav item
    const initialView = 'annex5_generator';
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
    'student_records': 'Student Grantees',
    'scholarships': 'Scholarship Management',
    'sa_verification': 'SA Verification',
    'id_validation': 'ID Validation',
    'announcements': 'Announcement Management',
    'audit_logs': 'Activity Logs',
    'reports': 'Reports & Analytics',
    'settings': 'System Settings',
    'masterlist_import': 'Scholar Masterlist Import',
    'annex5_generator': 'CHED Annex 5 TES Generator',
    'view_annex': 'Historical Annex Records (Form 2 & 3)'
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
    'annex5_generator': 'icon-file-spreadsheet',
    'view_annex': 'icon-eye'
};

// Track current view for sync
let currentViewName = 'annex5_generator';

// Current loaded script to clean up
let currentScript = null;

// Load a View
async function loadView(viewName) {
    try {
        if (viewName !== 'settings' && viewName !== 'annex5_generator' && viewName !== 'view_annex') {
            viewName = 'annex5_generator';
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
            try {
                await window.supabaseClient.auth.signOut();
            } catch (_) { }
            try {
                localStorage.removeItem(ADMIN_STORAGE_KEY);
                sessionStorage.removeItem(ADMIN_STORAGE_KEY);
            } catch (_) { }
            window.location.href = window.location.protocol === 'file:' ? '../login.html' : '/login.html';
        }
    });
}

// ── Real-Time Notifications System (Admin Web Interface) ────────────
let systemNotifications = [];
const notificationDropdown = document.getElementById('notification-dropdown');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

window.navigateToView = function (viewName, tabName) {
    if (viewName !== 'settings' && viewName !== 'annex5_generator' && viewName !== 'view_annex') {
        viewName = 'annex5_generator';
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

window.navigateToReportsTab = function (tabName) {
    window.requestedReportTab = tabName;
    if (currentViewName === 'reports' && window.switchReportTab) {
        window.switchReportTab(tabName);
    } else {
        window.navigateToView('reports', tabName);
    }
};

// Cache of processed notification IDs to prevent duplicate alerts
const seenNotificationIds = new Set();
const systemPushShownIds = new Set();

// Register Service Worker for background push delivery if supported
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {
        navigator.serviceWorker.register('../sw.js').catch(() => { });
    });
}

// Listen for service worker notification clicks
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICKED') {
            window.handleWebNotificationClick(event.data.notificationId, event.data.title);
        }
    });
}

// Request desktop notification permission gracefully
window.requestDesktopNotificationPermission = async function () {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission !== 'denied') {
        try {
            const perm = await Notification.requestPermission();
            return perm;
        } catch (_) {
            return Notification.permission;
        }
    }
    return Notification.permission;
};

// Trigger OS/Browser native desktop notification (visible even when dashboard tab is in background)
window.triggerSystemPushNotification = function ({ id, title, message, role = 'admin' }) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (id && systemPushShownIds.has(String(id))) return;
    if (id) systemPushShownIds.add(String(id));

    const iconUrl = window.location.protocol === 'file:' ? '../app_logo3.png' : '/app_logo3.png';
    const tag = `scholardoc_${role}_${id || Date.now()}`;

    // Prefer Service Worker registration for reliable delivery when tab is in background
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
                body: message,
                icon: iconUrl,
                badge: iconUrl,
                tag: tag,
                data: { notificationId: id, role, title },
                renotify: true
            }).catch(() => {
                _fallbackDirectNotification(title, message, iconUrl, tag, id);
            });
        }).catch(() => {
            _fallbackDirectNotification(title, message, iconUrl, tag, id);
        });
    } else {
        _fallbackDirectNotification(title, message, iconUrl, tag, id);
    }
};

function _fallbackDirectNotification(title, message, iconUrl, tag, id) {
    try {
        const notif = new Notification(title, {
            body: message,
            icon: iconUrl,
            badge: iconUrl,
            tag: tag,
            renotify: true,
            silent: false
        });

        notif.onclick = function () {
            window.focus();
            notif.close();
            window.handleWebNotificationClick(id, title);
        };
    } catch (e) {
        console.warn('Native desktop notification notice:', e);
    }
}

// Display small pop-up notification in the LOWER-RIGHT corner of the computer screen
window.showDesktopPopupNotification = function ({ id, title, message, type = 'info', role = 'Admin', timestamp }) {
    let container = document.getElementById('desktop-notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'desktop-notifications-container';
        container.className = 'desktop-notifications-container';
        document.body.appendChild(container);
    }

    // Deduplication check: do not display if a popup with this ID is already visible
    if (id && container.querySelector(`[data-id="${id}"]`)) return;

    // Prevent overlapping: cap max simultaneous visible popups to 3
    while (container.children.length >= 3) {
        const oldest = container.firstElementChild;
        if (oldest) oldest.remove();
        else break;
    }

    const popup = document.createElement('div');
    popup.className = 'desktop-popup-notification';
    popup.setAttribute('role', 'alert');
    if (id) popup.dataset.id = String(id);

    let iconClass = 'icon-bell';
    let iconBg = 'rgba(15, 50, 96, 0.1)';
    let iconColor = 'var(--primary-color, #0F3260)';
    if (type === 'success') {
        iconClass = 'icon-check-circle-2';
        iconBg = 'rgba(16, 185, 129, 0.12)';
        iconColor = '#10B981';
    } else if (type === 'warning') {
        iconClass = 'icon-alert-triangle';
        iconBg = 'rgba(245, 158, 11, 0.12)';
        iconColor = '#F59E0B';
    } else if (type === 'error') {
        iconClass = 'icon-alert-octagon';
        iconBg = 'rgba(239, 68, 68, 0.12)';
        iconColor = '#EF4444';
    }

    const timeDisplay = timestamp
        ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

    popup.innerHTML = `
        <div class="desktop-popup-inner">
            <div class="desktop-popup-header">
                <span class="desktop-popup-badge">
                    <span class="pulse-dot"></span>
                    ${role} Alert
                </span>
                <span class="desktop-popup-time">${timeDisplay}</span>
                <button type="button" class="desktop-popup-close" title="Dismiss" aria-label="Dismiss">✕</button>
            </div>
            <div class="desktop-popup-body">
                <div class="desktop-popup-icon-wrap" style="background: ${iconBg}; color: ${iconColor};">
                    <i class="${iconClass}" style="font-size: 18px;"></i>
                </div>
                <div class="desktop-popup-content">
                    <h4 class="desktop-popup-title">${title}</h4>
                    <p class="desktop-popup-msg">${message}</p>
                </div>
            </div>
            <div class="desktop-popup-footer">
                <span class="desktop-popup-action">
                    Click to view details <i class="icon-arrow-right" style="font-size: 12px; margin-left: 2px;"></i>
                </span>
            </div>
        </div>
        <div class="desktop-popup-progress">
            <div class="desktop-popup-progress-bar"></div>
        </div>
    `;

    function dismiss() {
        clearTimeout(dismissTimeout);
        if (popup.classList.contains('dismissing')) return;
        popup.classList.add('dismissing');
        setTimeout(() => popup.remove(), 320);
    }

    popup.addEventListener('click', (e) => {
        if (e.target.closest('.desktop-popup-close')) return;
        dismiss();
        window.handleWebNotificationClick(id, title);
    });

    const closeBtn = popup.querySelector('.desktop-popup-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
    }

    let dismissTimeout;
    const progressBar = popup.querySelector('.desktop-popup-progress-bar');

    function startTimer() {
        dismissTimeout = setTimeout(dismiss, 6500);
        if (progressBar) progressBar.style.animationPlayState = 'running';
    }

    function pauseTimer() {
        clearTimeout(dismissTimeout);
        if (progressBar) progressBar.style.animationPlayState = 'paused';
    }

    popup.addEventListener('mouseenter', pauseTimer);
    popup.addEventListener('mouseleave', startTimer);

    container.appendChild(popup);
    startTimer();

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) { }
    }
};

// Backward-compatible alias for existing callers
window.showWebPopupNotification = function (title, message, notificationId) {
    window.showDesktopPopupNotification({
        id: notificationId,
        title: title,
        message: message,
        type: 'info',
        role: 'Admin'
    });
};

// ── Role-Specific Notifications (Admin Web Interface ONLY) ────────────
let isInitialNotificationLoad = true;

async function loadNotifications(options = {}) {
    try {
        const adminUsername = (window.currentAdmin?.username || 'admin').trim();
        const adminUid = window.currentAdmin?.uid;

        // Query ONLY notifications targeted to Admin (never Super Admin)
        const filterParts = ['studentId.eq.admin'];
        if (adminUsername && adminUsername.toLowerCase() !== 'admin' && adminUsername.toLowerCase() !== 'superadmin') {
            filterParts.push(`studentId.eq.${adminUsername}`);
        }
        if (adminUid) {
            filterParts.push(`studentId.eq.${adminUid}`);
        }

        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .or(filterParts.join(','))
            .order('timestamp', { ascending: false })
            .limit(30);

        if (error) throw error;

        // Strict client-side isolation filter: discard any Super Admin notification
        systemNotifications = (data || []).filter(n => {
            const sid = (n.studentId || '').toLowerCase();
            return sid !== 'superadmin' && (sid === 'admin' || sid === adminUsername.toLowerCase() || sid === adminUid);
        });

        // If background polling detects an unseen unread notification, trigger the alerts
        if (options.checkNewAlerts && !isInitialNotificationLoad) {
            for (const n of systemNotifications) {
                if (n.id && !seenNotificationIds.has(String(n.id)) && !n.isRead) {
                    seenNotificationIds.add(String(n.id));
                    window.showDesktopPopupNotification({
                        id: n.id,
                        title: n.title || 'Admin Notification',
                        message: n.message || '',
                        type: n.type || 'info',
                        role: 'Admin',
                        timestamp: n.timestamp || new Date().toISOString()
                    });
                    window.triggerSystemPushNotification({
                        id: n.id,
                        title: `[Admin] ${n.title || 'New Notification'}`,
                        message: n.message || '',
                        role: 'admin'
                    });
                }
            }
        }

        // On initial load, mark existing notifications as seen so we don't spam popups on login/refresh
        if (isInitialNotificationLoad) {
            systemNotifications.forEach(n => {
                if (n.id) seenNotificationIds.add(String(n.id));
            });
            isInitialNotificationLoad = false;
        }

        renderNotificationsDropdown();
        updateBellBadge();
    } catch (e) {
        console.error('Error loading Admin notifications:', e);
    }
}

function updateBellBadge() {
    const unreadCount = systemNotifications.filter(n => !n.isRead).length;
    const badge = document.getElementById('bell-badge');
    if (!badge) return;

    if (unreadCount > 0) {
        badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
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
            <div style="padding: 24px 16px; text-align: center; color: var(--text-secondary); font-size: 12px; font-family: inherit;">
                <i class="icon-bell-off" style="font-size: 24px; opacity: 0.4; display: block; margin: 0 auto 8px auto;"></i>
                No notifications for Admin yet.
            </div>
        `;
        if (window.lucide) {
            try { window.lucide.createIcons(); } catch (_) { }
        }
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

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) { }
    }
}

window.handleWebNotificationClick = async function (notificationId, title) {
    try {
        if (notificationId) {
            await window.supabaseClient
                .from('notifications')
                .update({ isRead: true })
                .eq('id', notificationId);
        }

        // Close dropdown
        if (notificationDropdown) notificationDropdown.classList.add('hidden');

        // Context-aware navigation for Admin Dashboard
        const lowerTitle = (title || '').toLowerCase();
        if (lowerTitle.includes('view') || lowerTitle.includes('annex')) {
            window.navigateToView('view_annex');
        } else if (lowerTitle.includes('setting') || lowerTitle.includes('password') || lowerTitle.includes('account')) {
            window.navigateToView('settings');
        } else {
            // Default: Student Records / Annex 5 Generator
            window.navigateToView('annex5_generator');
        }

        // Reload notifications list
        loadNotifications();
    } catch (e) {
        console.error('Error handling notification click:', e);
    }
};

function setupRealtimeNotifications() {
    // Request desktop push notification permission on startup
    requestDesktopNotificationPermission();

    // Isolated real-time channel for Admin
    window.supabaseClient
        .channel('admin-portal-notifications-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications'
            },
            (payload) => {
                const target = (payload.new?.studentId || payload.old?.studentId || '').toLowerCase();
                const adminUsername = (window.currentAdmin?.username || 'admin').toLowerCase();
                const adminUid = window.currentAdmin?.uid;

                // STRICT SEPARATION: Only proceed if this notification is intended for Admin
                const isForAdmin = (target === 'admin' || target === adminUsername || (adminUid && target === adminUid));
                if (!isForAdmin || target === 'superadmin') {
                    return; // Ignore Super Admin notifications completely!
                }

                if (payload.eventType === 'INSERT' && payload.new) {
                    const notif = payload.new;

                    // Deduplicate
                    const notifIdStr = String(notif.id || '');
                    if (notifIdStr && seenNotificationIds.has(notifIdStr)) {
                        loadNotifications();
                        return;
                    }
                    if (notifIdStr) seenNotificationIds.add(notifIdStr);

                    // 1. Display desktop pop-up notification in LOWER-RIGHT corner of screen
                    window.showDesktopPopupNotification({
                        id: notif.id,
                        title: notif.title || 'Admin Notification',
                        message: notif.message || '',
                        type: notif.type || 'info',
                        role: 'Admin',
                        timestamp: notif.timestamp || new Date().toISOString()
                    });

                    // 2. Trigger native OS desktop push notification (supports background delivery)
                    window.triggerSystemPushNotification({
                        id: notif.id,
                        title: `[Admin] ${notif.title || 'New Notification'}`,
                        message: notif.message || '',
                        role: 'admin'
                    });

                    // 3. Refresh dropdown & bell badge
                    loadNotifications();
                } else {
                    loadNotifications();
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
        requestDesktopNotificationPermission();
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
            // Strictly mark only Admin's unread notifications
            const unreadIds = systemNotifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadIds.length === 0) return;

            const { error } = await window.supabaseClient
                .from('notifications')
                .update({ isRead: true })
                .in('id', unreadIds);

            if (error) throw error;

            loadNotifications();
        } catch (e) {
            console.error('Error marking Admin notifications as read:', e);
        }
    });
}

// Background tab sync: refresh notifications when returning to tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        loadNotifications({ checkNewAlerts: true });
    }
});

// Periodic background check every 25 seconds for reliable background delivery
setInterval(() => {
    loadNotifications({ checkNewAlerts: true });
}, 25000);

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

// Reliable Initialization (handles DOMContentLoaded already fired in module scripts)
function initDashboard() {
    checkSession();
    loadNotifications();
    setupRealtimeNotifications();

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) { }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
