// Supabase Configuration
import { AdminNotificationService } from './services/admin_notification_service.js';

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

// ── Audio Cue: Subtle Activity Chime ───────────────────────────────
function playActivityChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    } catch (_) { }
}

// ── Helpers: Formatting & Escaping ──────────────────────────────────
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const now = Date.now();
    const date = new Date(timestamp).getTime();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Display small pop-up notification in the LOWER-RIGHT corner of the computer screen
window.showDesktopPopupNotification = function ({ id, title, message, type = 'info', category = null, role = 'Registrar', timestamp }) {
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

    // Auto-detect category if not explicitly supplied
    const resolvedCat = category || AdminNotificationService.classifyCategory({ title, message });
    const catLabel = AdminNotificationService.CATEGORY_LABELS[resolvedCat] || 'Activity';

    let iconClass = 'icon-bell';
    let iconBg = 'rgba(15, 50, 96, 0.1)';
    let iconColor = 'var(--primary-color, #0F3260)';
    if (resolvedCat === 'submission') {
        iconClass = 'icon-upload-cloud';
        iconBg = 'rgba(16, 185, 129, 0.12)';
        iconColor = '#059669';
    } else if (resolvedCat === 'status_change') {
        iconClass = 'icon-activity';
        iconBg = 'rgba(245, 158, 11, 0.12)';
        iconColor = '#D97706';
    } else if (resolvedCat === 'record_update') {
        iconClass = 'icon-refresh-cw';
        iconBg = 'rgba(59, 130, 246, 0.12)';
        iconColor = '#2563EB';
    }

    if (type === 'success' && resolvedCat !== 'submission') {
        iconClass = 'icon-check-circle-2';
        iconBg = 'rgba(16, 185, 129, 0.12)';
        iconColor = '#10B981';
    } else if (type === 'error') {
        iconClass = 'icon-alert-octagon';
        iconBg = 'rgba(239, 68, 68, 0.12)';
        iconColor = '#EF4444';
    }

    const timeDisplay = timestamp
        ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

    // Clean title for display
    const cleanTitle = (title || 'Activity Alert').replace(/^(\[[^\]]+\]|\w+ \w+:)\s*/i, '').trim();

    popup.innerHTML = `
        <div class="desktop-popup-inner">
            <div class="desktop-popup-header">
                <span class="desktop-popup-badge" style="${resolvedCat === 'submission' ? 'background: rgba(16,185,129,0.12); color: #059669;' : (resolvedCat === 'status_change' ? 'background: rgba(245,158,11,0.12); color: #D97706;' : '')}">
                    <span class="pulse-dot"></span>
                    ${catLabel}
                </span>
                <span class="desktop-popup-time">${timeDisplay}</span>
                <button type="button" class="desktop-popup-close" title="Dismiss" aria-label="Dismiss">✕</button>
            </div>
            <div class="desktop-popup-body">
                <div class="desktop-popup-icon-wrap" style="background: ${iconBg}; color: ${iconColor};">
                    <i class="${iconClass}" style="font-size: 18px;"></i>
                </div>
                <div class="desktop-popup-content">
                    <h4 class="desktop-popup-title">${escapeHtml(cleanTitle)}</h4>
                    <p class="desktop-popup-msg">${escapeHtml(message)}</p>
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
        window.handleActivityCardClick(id);
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

    // Play subtle audio cue
    playActivityChime();

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
        role: 'Registrar'
    });
};

// ── Activity-Based Notification System State ────────────────────────
let isInitialNotificationLoad = true;
let currentCategoryFilter = 'record_update';
let filterUnreadOnly = false;
let activeModalNotification = null;

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
            .limit(50);

        if (error) throw error;

        // Strict client-side isolation filter: discard any Super Admin notification
        const rawList = (data || []).filter(n => {
            const sid = (n.studentId || '').toLowerCase();
            return sid !== 'superadmin' && (sid === 'admin' || sid === adminUsername.toLowerCase() || sid === adminUid);
        });

        // Registrar interface: Retain ONLY Record Updates (remove submission and status)
        systemNotifications = rawList
            .filter(n => {
                const title = (n.title || '').toLowerCase();
                const msg = (n.message || '').toLowerCase();
                if (title.startsWith('new submission') || title.includes('[submission]')) return false;
                if (title.startsWith('status change') || title.includes('[status]')) return false;
                if (title.includes('sa verification') || title.includes('id validation')) return false;
                if (title.includes('student documents submitted') || msg.includes('submitted documentary requirements')) return false;
                return true;
            })
            .map(n => ({
                ...n,
                category: 'record_update'
            }));

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
                        category: n.category,
                        role: 'Registrar',
                        timestamp: n.timestamp || new Date().toISOString()
                    });
                    window.triggerSystemPushNotification({
                        id: n.id,
                        title: `[Registrar] ${n.title || 'New Activity'}`,
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

        updateCategoryCounts();
        renderNotificationsDropdown();
        updateBellBadge();

        // Update last sync time
        const syncTimeEl = document.getElementById('activity-last-sync-time');
        if (syncTimeEl) {
            syncTimeEl.textContent = `Synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    } catch (e) {
        console.error('Error loading Admin activity notifications:', e);
    }
}

function updateCategoryCounts() {
    const totalRecordUpdate = systemNotifications.length;

    const countAllEl = document.getElementById('count-all');
    const countSubEl = document.getElementById('count-submission');
    const countRecEl = document.getElementById('count-record_update');
    const countStatEl = document.getElementById('count-status_change');

    if (countAllEl) countAllEl.textContent = totalRecordUpdate;
    if (countSubEl) countSubEl.textContent = 0;
    if (countRecEl) countRecEl.textContent = totalRecordUpdate;
    if (countStatEl) countStatEl.textContent = 0;
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

    // Filter by category
    let filtered = systemNotifications;
    if (currentCategoryFilter !== 'all') {
        filtered = filtered.filter(n => n.category === currentCategoryFilter);
    }
    if (filterUnreadOnly) {
        filtered = filtered.filter(n => !n.isRead);
    }

    // Update filter label (Registrar interface only shows Record Updates)
    const filterLabel = document.getElementById('activity-active-filter-label');
    if (filterLabel) {
        filterLabel.textContent = `Record Updates${filterUnreadOnly ? ' (Unread)' : ''} • ${filtered.length}`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding: 36px 16px; text-align: center; color: var(--text-secondary); font-size: 12px; font-family: inherit;">
                <i class="icon-inbox" style="font-size: 28px; opacity: 0.35; display: block; margin: 0 auto 8px auto;"></i>
                ${filterUnreadOnly ? 'No unread record update activities.' : 'No record update activities yet.'}
            </div>
        `;
        if (window.lucide) {
            try { window.lucide.createIcons(); } catch (_) { }
        }
        return;
    }

    // Temporal Grouping: Group into Today, Yesterday, Earlier
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups = {
        'Today': [],
        'Yesterday': [],
        'Earlier': []
    };

    filtered.forEach(n => {
        if (!n.timestamp) {
            groups['Earlier'].push(n);
            return;
        }
        const notifDate = new Date(n.timestamp);
        const dStr = notifDate.toDateString();
        if (dStr === todayStr) {
            groups['Today'].push(n);
        } else if (dStr === yesterdayStr) {
            groups['Yesterday'].push(n);
        } else {
            groups['Earlier'].push(n);
        }
    });

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        if (items.length === 0) continue;

        html += `<div class="activity-group-title">${groupName}</div>`;

        items.forEach(n => {
            const timeAgo = formatTimeAgo(n.timestamp);
            const category = n.category || AdminNotificationService.classifyCategory(n);
            const badgeLabel = AdminNotificationService.CATEGORY_LABELS[category] || 'Activity';

            let iconClass = 'icon-info';
            let iconColor = 'var(--primary-color, #0F3260)';
            let iconBg = 'rgba(15, 50, 96, 0.1)';

            if (category === 'submission') {
                iconClass = 'icon-upload-cloud';
                iconColor = '#059669';
                iconBg = 'rgba(16, 185, 129, 0.12)';
            } else if (category === 'record_update') {
                iconClass = 'icon-refresh-cw';
                iconColor = '#2563EB';
                iconBg = 'rgba(59, 130, 246, 0.12)';
            } else if (category === 'status_change') {
                iconClass = 'icon-activity';
                iconColor = '#D97706';
                iconBg = 'rgba(245, 158, 11, 0.12)';
            }

            if (n.type === 'success' && category !== 'submission') {
                iconClass = 'icon-check-circle-2';
                iconColor = '#10B981';
                iconBg = 'rgba(16, 185, 129, 0.12)';
            } else if (n.type === 'error') {
                iconClass = 'icon-alert-octagon';
                iconColor = '#EF4444';
                iconBg = 'rgba(239, 68, 68, 0.12)';
            }

            // Clean title for display
            const displayTitle = (n.title || 'Activity Alert').replace(/^(\[[^\]]+\]|\w+ \w+:)\s*/i, '').trim();

            html += `
                <div class="activity-card ${n.isRead ? '' : 'unread'}" data-id="${n.id}" onclick="handleActivityCardClick('${n.id}')">
                    ${!n.isRead ? '<span class="activity-unread-indicator" title="Unread activity"></span>' : ''}
                    <div class="activity-icon-container" style="background: ${iconBg}; color: ${iconColor};">
                        <i class="${iconClass}" style="font-size: 16px;"></i>
                    </div>
                    <div class="activity-body">
                        <div class="activity-top-row">
                            <span class="activity-cat-badge ${category}">
                                <i class="${category === 'submission' ? 'icon-upload-cloud' : (category === 'status_change' ? 'icon-check-circle' : 'icon-refresh-cw')}" style="font-size: 10px;"></i>
                                ${badgeLabel}
                            </span>
                            <span class="activity-timestamp">${timeAgo}</span>
                        </div>
                        <div class="activity-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
                        <div class="activity-message">${escapeHtml(n.message || '')}</div>
                        <div class="activity-item-actions" onclick="event.stopPropagation()">
                            <button type="button" class="activity-read-toggle-btn" onclick="toggleReadStatus('${n.id}', ${!n.isRead})" title="${n.isRead ? 'Mark as unread' : 'Mark as read'}">
                                <i class="${n.isRead ? 'icon-circle' : 'icon-check'}" style="font-size: 10px;"></i> ${n.isRead ? 'Unread' : 'Mark Read'}
                            </button>
                            <button type="button" class="activity-read-toggle-btn" onclick="openActivityDetails('${n.id}')" title="View complete details">
                                <i class="icon-eye" style="font-size: 10px;"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) { }
    }
}

// Toggle read/unread status for an individual notification
window.toggleReadStatus = async function (notificationId, targetState) {
    try {
        if (!notificationId) return;

        // Optimistically update local array
        const notif = systemNotifications.find(n => String(n.id) === String(notificationId));
        if (notif) notif.isRead = targetState;

        updateBellBadge();
        renderNotificationsDropdown();

        // Persist to Supabase
        await window.supabaseClient
            .from('notifications')
            .update({ isRead: targetState })
            .eq('id', notificationId);

    } catch (err) {
        console.error('Error toggling notification read status:', err);
    }
};

window.handleActivityCardClick = async function (id, fallbackData = null) {
    let notif = systemNotifications.find(n => String(n.id) === String(id));
    if (!notif && fallbackData) notif = fallbackData;
    if (!notif && window.supabaseClient) {
        try {
            const { data } = await window.supabaseClient.from('notifications').select('*').eq('id', id).single();
            if (data) notif = data;
        } catch (_) {}
    }
    if (!notif) return;

    // Mark as read if currently unread
    if (!notif.isRead) {
        await toggleReadStatus(id, true);
    }

    // Close dropdown and modal
    if (notificationDropdown) notificationDropdown.classList.add('hidden');
    const modal = document.getElementById('activity-details-modal');
    if (modal) modal.classList.remove('open');

    // Context-aware navigation for Registrar (Admin)
    const targetTitle = (notif.title || '').toLowerCase();
    const targetMsg = (notif.message || '').toLowerCase();
    const combined = `${targetTitle} ${targetMsg}`;

    // 1. Historical Archived Annex 5 Exports
    if (combined.includes('historical') || combined.includes('view annex') || combined.includes('past records') || combined.includes('archived')) {
        if (currentViewName !== 'view_annex') {
            window.navigateToView('view_annex');
        }
        return;
    }

    // 2. Settings & Security
    if (combined.includes('setting') || combined.includes('password') || combined.includes('email') || combined.includes('preference')) {
        if (currentViewName !== 'settings') {
            window.navigateToView('settings');
        }
        return;
    }

    // 3. New Grantees Masterlist Uploaded by Super Admin (ready for Annex 5 Billing review)
    if (combined.includes('new grantees masterlist') || (combined.includes('super admin') && combined.includes('grantees')) || (combined.includes('masterlist') && combined.includes('uploaded'))) {
        window.requestedAnnexSection = 'superadmin';
        if (currentViewName !== 'annex5_generator') {
            window.navigateToView('annex5_generator');
        }

        const tryFocusSuperAdminList = (attempts = 0) => {
            const superCard = document.getElementById('card-source-superadmin');
            if (superCard) {
                superCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                superCard.style.outline = '3px solid var(--primary-color)';
                superCard.style.outlineOffset = '2px';
                setTimeout(() => {
                    superCard.style.transition = 'outline 0.8s ease';
                    superCard.style.outline = '3px solid transparent';
                }, 1500);
            } else if (attempts < 15) {
                setTimeout(() => tryFocusSuperAdminList(attempts + 1), 100);
            }
        };
        tryFocusSuperAdminList();
        return;
    }

    // 4. School Enrollment List / School Student Records Uploaded
    if (combined.includes('school enrollment') || combined.includes('school student') || combined.includes('enrollment list')) {
        window.requestedAnnexSection = 'school';
        if (currentViewName !== 'annex5_generator') {
            window.navigateToView('annex5_generator');
        }

        const tryFocusSchoolList = (attempts = 0) => {
            const schoolCard = document.getElementById('card-source-school');
            if (schoolCard) {
                schoolCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                schoolCard.style.outline = '3px solid #1E88E5';
                schoolCard.style.outlineOffset = '2px';
                setTimeout(() => {
                    schoolCard.style.transition = 'outline 0.8s ease';
                    schoolCard.style.outline = '3px solid transparent';
                }, 1500);
            } else if (attempts < 15) {
                setTimeout(() => tryFocusSchoolList(attempts + 1), 100);
            }
        };
        tryFocusSchoolList();
        return;
    }

    // 5. Annex 5 Form 2 Generated / Form 2 Billing
    if (combined.includes('form 2') || combined.includes('form2') || combined.includes('billing generated')) {
        window.requestedAnnexTab = 'form2';
        if (currentViewName !== 'annex5_generator') {
            window.navigateToView('annex5_generator');
        }

        const trySwitchToForm2 = (attempts = 0) => {
            const btn2 = document.getElementById('tab-btn-form2');
            const pane2 = document.getElementById('tab-pane-form2');
            if (typeof window.activateAnnexTab === 'function' && btn2 && pane2) {
                window.activateAnnexTab(btn2, pane2);
                btn2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (btn2) {
                btn2.click();
                btn2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempts < 15) {
                setTimeout(() => trySwitchToForm2(attempts + 1), 100);
            }
        };
        trySwitchToForm2();
        return;
    }

    // 6. Annex 5 Form 3 Generated / Form 3 Exceptions
    if (combined.includes('form 3') || combined.includes('form3') || combined.includes('exceptions') || combined.includes('not enrolled')) {
        window.requestedAnnexTab = 'form3';
        if (currentViewName !== 'annex5_generator') {
            window.navigateToView('annex5_generator');
        }

        const trySwitchToForm3 = (attempts = 0) => {
            const btn3 = document.getElementById('tab-btn-form3');
            const pane3 = document.getElementById('tab-pane-form3');
            if (typeof window.activateAnnexTab === 'function' && btn3 && pane3) {
                window.activateAnnexTab(btn3, pane3);
                btn3.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (btn3) {
                btn3.click();
                btn3.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempts < 15) {
                setTimeout(() => trySwitchToForm3(attempts + 1), 100);
            }
        };
        trySwitchToForm3();
        return;
    }

    // 7. Review Queue / Cross-Verification
    if (combined.includes('review') || combined.includes('cross-verification') || combined.includes('cross-matched') || combined.includes('resolved') || combined.includes('queue')) {
        window.requestedAnnexTab = 'review';
        if (currentViewName !== 'annex5_generator') {
            window.navigateToView('annex5_generator');
        }

        const trySwitchToReview = (attempts = 0) => {
            const btnRev = document.getElementById('tab-btn-review');
            const paneRev = document.getElementById('tab-pane-review');
            if (typeof window.activateAnnexTab === 'function' && btnRev && paneRev) {
                window.activateAnnexTab(btnRev, paneRev);
                btnRev.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (btnRev) {
                btnRev.click();
                btnRev.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempts < 15) {
                setTimeout(() => trySwitchToReview(attempts + 1), 100);
            }
        };
        trySwitchToReview();
        return;
    }

    // Default: Student Records / Annex 5 Generator
    if (currentViewName !== 'annex5_generator') {
        window.navigateToView('annex5_generator');
    }
};

// Backward-compatible alias for existing callers
window.handleWebNotificationClick = function (notificationId, title) {
    window.handleActivityCardClick(notificationId);
};

window.openActivityDetails = function (id) {
    const notif = systemNotifications.find(n => String(n.id) === String(id));
    if (!notif) return;

    activeModalNotification = notif;
    const modal = document.getElementById('activity-details-modal');
    if (!modal) return;

    const category = notif.category || AdminNotificationService.classifyCategory(notif);
    const badgeLabel = AdminNotificationService.CATEGORY_LABELS[category] || 'Activity';

    const modalBadge = document.getElementById('modal-activity-badge');
    const modalTypeBadge = document.getElementById('modal-activity-type-badge');
    const modalTitle = document.getElementById('modal-activity-title');
    const modalMessage = document.getElementById('modal-activity-message');
    const modalTimestamp = document.getElementById('modal-activity-timestamp');
    const modalScope = document.getElementById('modal-activity-scope');
    const markReadBtn = document.getElementById('modal-mark-read-btn');
    const actionBtn = document.getElementById('modal-action-btn');

    if (modalBadge) {
        modalBadge.className = `activity-cat-badge ${category}`;
        modalBadge.innerHTML = `<i class="${category === 'submission' ? 'icon-upload-cloud' : (category === 'status_change' ? 'icon-check-circle' : 'icon-refresh-cw')}" style="font-size: 11px;"></i> ${badgeLabel}`;
    }

    if (modalTypeBadge) {
        const typeMap = { 'success': 'Success', 'warning': 'Warning', 'error': 'Critical Alert', 'info': 'Information' };
        modalTypeBadge.textContent = typeMap[notif.type] || 'Information';
        modalTypeBadge.style.color = notif.type === 'success' ? '#10B981' : (notif.type === 'warning' ? '#F59E0B' : (notif.type === 'error' ? '#EF4444' : 'var(--text-secondary)'));
    }

    if (modalTitle) modalTitle.textContent = (notif.title || 'Activity Alert').replace(/^(\[[^\]]+\]|\w+ \w+:)\s*/i, '').trim();
    if (modalMessage) modalMessage.textContent = notif.message || '';
    if (modalTimestamp) modalTimestamp.textContent = notif.timestamp ? new Date(notif.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
    if (modalScope) modalScope.textContent = notif.studentId === 'admin' ? 'Registrar / Billing Interface' : 'ScholarDoc Platform';

    if (markReadBtn) {
        markReadBtn.textContent = notif.isRead ? 'Mark as Unread' : 'Mark as Read';
        markReadBtn.onclick = async () => {
            await toggleReadStatus(notif.id, !notif.isRead);
            modal.classList.remove('open');
        };
    }

    if (actionBtn) {
        actionBtn.innerHTML = '<i class="icon-arrow-right" style="font-size: 12px; margin-right: 4px;"></i> View Activity';
        actionBtn.onclick = () => {
            modal.classList.remove('open');
            window.handleActivityCardClick(notif.id);
        };
    }

    modal.classList.add('open');
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) { }
    }
};

function setupActivityTabsAndFilters() {
    const tabs = document.querySelectorAll('.notif-tab[data-category]');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategoryFilter = tab.dataset.category || 'all';
            renderNotificationsDropdown();
        });
    });

    const unreadCheckbox = document.getElementById('filter-unread-only');
    if (unreadCheckbox) {
        unreadCheckbox.addEventListener('change', (e) => {
            filterUnreadOnly = e.target.checked;
            renderNotificationsDropdown();
        });
    }

    const refreshBtn = document.getElementById('refresh-notifs-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            refreshBtn.classList.add('syncing');
            await loadNotifications({ checkNewAlerts: false });
            setTimeout(() => refreshBtn.classList.remove('syncing'), 600);
        });
    }

    // Modal close listeners
    const closeActivityModalBtn = document.getElementById('close-activity-modal-btn');
    if (closeActivityModalBtn) {
        closeActivityModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('activity-details-modal');
            if (modal) modal.classList.remove('open');
        });
    }

    const activityModal = document.getElementById('activity-details-modal');
    if (activityModal) {
        activityModal.addEventListener('click', (e) => {
            if (e.target === activityModal) {
                activityModal.classList.remove('open');
            }
        });
    }
}

function setupRealtimeNotifications() {
    // Request desktop push notification permission on startup
    requestDesktopNotificationPermission();

    // 1. Isolated real-time channel for Admin notifications
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
                    const notifTitle = (notif.title || '').toLowerCase();
                    const notifMsg = (notif.message || '').toLowerCase();

                    // Registrar interface: ignore non-update notifications (submissions and status changes)
                    if (notifTitle.startsWith('new submission') || notifTitle.includes('[submission]')) return;
                    if (notifTitle.startsWith('status change') || notifTitle.includes('[status]')) return;
                    if (notifTitle.includes('sa verification') || notifTitle.includes('id validation')) return;
                    if (notifTitle.includes('student documents submitted') || notifMsg.includes('submitted documentary requirements')) return;

                    // Deduplicate
                    const notifIdStr = String(notif.id || '');
                    if (notifIdStr && seenNotificationIds.has(notifIdStr)) {
                        loadNotifications();
                        return;
                    }
                    if (notifIdStr) seenNotificationIds.add(notifIdStr);

                    const category = 'record_update';

                    // 1. Display desktop pop-up notification in LOWER-RIGHT corner of screen with activity category
                    window.showDesktopPopupNotification({
                        id: notif.id,
                        title: notif.title || 'Admin Notification',
                        message: notif.message || '',
                        type: notif.type || 'info',
                        category: category,
                        role: 'Registrar',
                        timestamp: notif.timestamp || new Date().toISOString()
                    });

                    // 2. Trigger native OS desktop push notification (supports background delivery)
                    window.triggerSystemPushNotification({
                        id: notif.id,
                        title: `[Registrar] ${notif.title || 'New Activity'}`,
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

    // 2. Real-time grantee watcher (detects live status changes or profile updates)
    window.supabaseClient
        .channel('admin-portal-grantees-watcher')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'student_grantees'
            },
            (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
                    const oldStatus = payload.old.applicationStatus || payload.old.status;
                    const newStatus = payload.new.applicationStatus || payload.new.status;
                    const studentName = payload.new.fullName || payload.new.full_name || 'Student';

                    // If status changed externally
                    if (oldStatus && newStatus && oldStatus !== newStatus) {
                        window.showDesktopPopupNotification({
                            id: `grantee_status_${payload.new.id}_${Date.now()}`,
                            title: `Record Update: ${studentName}`,
                            message: `Grantee application record updated from "${oldStatus}" to "${newStatus}".`,
                            type: newStatus.toLowerCase().includes('approved') ? 'success' : 'info',
                            category: 'record_update',
                            role: 'Registrar',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        )
        .subscribe();

    // 3. Listen for internal tab custom activity event
    window.addEventListener('admin_activity_logged', (e) => {
        loadNotifications();
    });
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
    setupActivityTabsAndFilters();
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
