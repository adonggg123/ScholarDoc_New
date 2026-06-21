// Supabase Configuration
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

// Initialize global supabase client
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Check Authentication Session
async function checkSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html'; // Redirect to login if not authenticated
    }
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
    'masterlist_import': 'Scholar Masterlist Import'
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
    'masterlist_import': 'icon-file-text'
};

// Track current view for sync
let currentViewName = 'dashboard';

// Current loaded script to clean up
let currentScript = null;

// Load a View
async function loadView(viewName) {
    try {
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
            window.location.href = 'index.html';
        }
    });
}

// ── Notification Bell (placeholder) ─────────────────────────────────
if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        showToast('No new notifications.', 'bell');
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
    // Load default view (dashboard)
    const initialView = 'dashboard';
    const initialNav = document.querySelector(`.nav-item[data-view="${initialView}"]`);
    if (initialNav) initialNav.classList.add('active');
    loadView(initialView);
    
    // Init icons for main layout
    if (window.lucide) {
        window.lucide.createIcons();
    }
});
