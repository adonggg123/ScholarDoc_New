// ScholarDoc Student Web — Dashboard Controller
// Handles navigation, session management, notifications, theming

// ─── Supabase Initialization ───
const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ─── Session Check ───
async function checkSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

// ─── DOM Elements ───
const appContent = document.getElementById('app-content');
const topbarTitle = document.getElementById('topbar-title'); // May be null now, handled safely
const topbarIcon = document.getElementById('topbar-icon');   // May be null now, handled safely
const navItems = document.querySelectorAll('.nav-item[data-view]');
const profilePill = document.getElementById('profile-pill');
const profileDropdown = document.getElementById('profile-dropdown');
const profileName = document.getElementById('profile-name');
const profileInitial = document.getElementById('profile-initial');
const profileAvatar = document.getElementById('profile-avatar');
const notificationBtn = document.getElementById('notification-btn');
const notificationCount = document.getElementById('notification-count');
const navNotifBadge = document.getElementById('nav-notif-badge');
const navNotifBadgeMobile = document.getElementById('nav-notif-badge-mobile');
const themeToggle = document.getElementById('theme-toggle');
const themeToggleMobile = document.getElementById('theme-toggle-mobile');
const dropdownThemeToggle = document.getElementById('dropdown-theme-toggle');
const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// ─── View Routing Config ───
const viewTitles = {
    'home': 'Home',
    'status': 'Status Tracking',
    'submit': 'Submit Documents',
    'history': 'Submission History',
    'directory': 'Scholar Directory',
    'notifications': 'Notifications',
    'profile': 'My Profile',
};

const viewIcons = {
    'home': 'icon-home',
    'status': 'icon-clipboard-list',
    'submit': 'icon-upload-cloud',
    'history': 'icon-history',
    'directory': 'icon-users',
    'notifications': 'icon-bell',
    'profile': 'icon-user',
};

// ─── State ───
let currentViewName = 'home';
let currentScript = null;
let currentStudentProfile = null;
let shownNotificationIds = new Set();
let isInitialNotifLoad = true;
let notificationSubscription = null;

// ─── View Loader ───
async function loadView(viewName) {
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error('View not found');
        const html = await response.text();

        // Add content with a smooth fade-in
        appContent.style.opacity = '0';
        appContent.style.transform = 'translateY(8px)';
        appContent.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

        setTimeout(() => {
            appContent.innerHTML = html;
            appContent.style.opacity = '1';
            appContent.style.transform = 'translateY(0)';
            if (window.lucide) {
                window.lucide.createIcons();
            }

            // Remove old script
            if (currentScript) {
                currentScript.remove();
            }

            // Load new JS module
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `js/views/${viewName}.js?t=${Date.now()}`;
            document.body.appendChild(script);
            currentScript = script;
        }, 150);

        if (topbarTitle) {
            topbarTitle.textContent = viewTitles[viewName] || 'Dashboard';
        }

        if (topbarIcon) {
            topbarIcon.className = viewIcons[viewName] || 'icon-home';
        }

        currentViewName = viewName;

        // Update active nav items (desktop + mobile)
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Close mobile sidebar if open
        closeMobileSidebar();

    } catch (err) {
        console.error(`Error loading view ${viewName}:`, err);
        appContent.innerHTML = `
            <div class="empty-state">
                <i data-lucide="alert-triangle"></i>
                <h3>Unable to load page</h3>
                <p>${err.message}</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

// ─── Navigation Handlers ───
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) loadView(view);
    });
});

// Dropdown nav items
profileDropdown?.querySelectorAll('.dropdown-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
        loadView(item.dataset.view);
        profileDropdown.classList.add('hidden');
    });
});

// ─── Profile Pill & Dropdown ───
profilePill?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!profileDropdown?.contains(e.target) && !profilePill?.contains(e.target)) {
        profileDropdown?.classList.add('hidden');
    }
});

// ─── Notification Button ───
notificationBtn?.addEventListener('click', () => {
    loadView('notifications');
});

// ─── Logout ───
async function handleLogout() {
    try {
        const session = await window.supabaseClient.auth.getSession();
        const uid = session?.data?.session?.user?.id;
        if (uid) {
            try {
                await window.supabaseClient.from('presence').upsert({
                    uid: uid,
                    isOnline: false,
                    lastSeen: new Date().toISOString(),
                });
            } catch (_) { }
        }
        await window.supabaseClient.auth.signOut();
    } catch (_) { }
    window.location.href = 'http://localhost:8080/login.html';
}

dropdownLogoutBtn?.addEventListener('click', handleLogout);
document.getElementById('nav-logout-mobile')?.addEventListener('click', handleLogout);

// ─── Mobile Sidebar ───
function closeMobileSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
}

mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open');
});

sidebarOverlay?.addEventListener('click', closeMobileSidebar);

// ─── Theme Toggle ───
function updateThemeIcons(isDark) {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    }
    const mobileThemeIcon = themeToggleMobile?.querySelector('i');
    if (mobileThemeIcon) {
        mobileThemeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    }
    const dropdownToggleIcon = dropdownThemeToggle?.querySelector('i');
    if (dropdownToggleIcon) {
        dropdownToggleIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Initial theme icon sync
setTimeout(() => {
    const isDark = document.body.classList.contains('dark');
    updateThemeIcons(isDark);
}, 200);

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('scholardoc_theme', isDark ? 'dark' : 'light');
    updateThemeIcons(isDark);
}

themeToggle?.addEventListener('click', toggleTheme);
themeToggleMobile?.addEventListener('click', toggleTheme);
dropdownThemeToggle?.addEventListener('click', () => {
    toggleTheme();
    profileDropdown?.classList.add('hidden');
});

// ─── Hash Token & Session Initialization ───
async function initSessionFromHash() {
    if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('student_id='))) {
        try {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const studentId = params.get('student_id');

            if (accessToken && refreshToken) {
                await window.supabaseClient.auth.setSession({
                    access_token: decodeURIComponent(accessToken),
                    refresh_token: decodeURIComponent(refreshToken),
                });
            }
            if (studentId) {
                sessionStorage.setItem('scholardoc_student_id', decodeURIComponent(studentId));
            }
            // Clean up the URL hash without page reload
            history.replaceState(null, '', window.location.pathname);
        } catch (e) {
            console.error('Error setting session from URL hash:', e);
        }
    }
}

// ─── Session Check ───
async function checkSession() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        return session;
    } catch (_) {
        return null;
    }
}

// ─── Load Profile Data ───
async function loadProfileData() {
    await initSessionFromHash();
    const session = await checkSession();
    const storedStudentId = sessionStorage.getItem('scholardoc_student_id');

    let studentRecord = null;
    let uid = session?.user?.id;

    // 1. Attempt lookup by authenticated user ID
    if (uid) {
        const { data, error } = await window.supabaseClient
            .from('students')
            .select('*')
            .eq('uid', uid)
            .limit(1);
        if (!error && data && data.length > 0) {
            studentRecord = data[0];
        }
    }

    // 2. Attempt lookup by student ID or email from session or storage
    if (!studentRecord) {
        let queryTarget = storedStudentId;
        if (!queryTarget && session?.user?.email) {
            queryTarget = session.user.email.split('@')[0];
        }
        if (queryTarget) {
            const { data } = await window.supabaseClient
                .from('students')
                .select('*')
                .or(`studentId.eq.${queryTarget},authEmail.eq.${queryTarget}@scholardoc.com,email.eq.${session?.user?.email}`)
                .limit(1);
            if (data && data.length > 0) {
                studentRecord = data[0];
                uid = studentRecord.uid;
            }
        }
    }

    // 3. Fallback: Fetch default active student from database (2023305311)
    if (!studentRecord) {
        const { data: defaultStudent } = await window.supabaseClient
            .from('students')
            .select('*')
            .eq('studentId', '2023305311')
            .limit(1);
        if (defaultStudent && defaultStudent.length > 0) {
            studentRecord = defaultStudent[0];
            uid = studentRecord.uid;
        }
    }

    if (studentRecord) {
        currentStudentProfile = studentRecord;
        window.currentStudentProfile = currentStudentProfile;
        window.currentStudentUid = uid || studentRecord.uid;

        // Update topbar profile
        const fullName = currentStudentProfile.fullName || 'Student';
        const firstName = fullName.split(' ')[0];
        if (profileName) profileName.textContent = firstName;
        if (profileInitial) profileInitial.textContent = firstName[0]?.toUpperCase() || 'S';

        // Profile picture
        const photoUrl = currentStudentProfile.profilePictureUrl;
        if (photoUrl && profileAvatar) {
            profileAvatar.innerHTML = `<img src="${photoUrl}" alt="Avatar">`;
        }
    }
}

// ─── Real-Time Notification Listener ───
async function setupNotificationListener() {
    const session = await window.supabaseClient.auth.getSession();
    const uid = session?.data?.session?.user?.id;
    if (!uid) return;

    // Initial fetch
    const { data: initialNotifs } = await window.supabaseClient
        .from('notifications')
        .select()
        .eq('studentId', uid)
        .order('timestamp', { ascending: false });

    if (initialNotifs) {
        updateNotificationBadge(initialNotifs);
        // Mark all current unread as "seen" to prevent startup spam
        initialNotifs.filter(n => !n.isRead).forEach(n => shownNotificationIds.add(n.id?.toString()));
        isInitialNotifLoad = false;
    }

    // Realtime subscription
    notificationSubscription = window.supabaseClient
        .channel('student-notifications')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `studentId=eq.${uid}`
        }, (payload) => {
            handleNotificationChange(payload, uid);
        })
        .subscribe();
}

async function handleNotificationChange(payload, uid) {
    // Re-fetch all notifications for count
    const { data } = await window.supabaseClient
        .from('notifications')
        .select()
        .eq('studentId', uid)
        .order('timestamp', { ascending: false });

    if (data) {
        updateNotificationBadge(data);

        // Show toast for new notifications
        if (!isInitialNotifLoad && payload.eventType === 'INSERT') {
            const newNotif = payload.new;
            if (newNotif && !shownNotificationIds.has(newNotif.id?.toString())) {
                shownNotificationIds.add(newNotif.id?.toString());
                showToast(
                    newNotif.title || 'Notification',
                    newNotif.message || '',
                    newNotif.type || 'info'
                );
            }
        }
    }
}

function updateNotificationBadge(notifications) {
    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (notificationCount) {
        notificationCount.textContent = unreadCount;
        notificationCount.classList.toggle('hidden', unreadCount === 0);
    }

    if (navNotifBadge) {
        navNotifBadge.textContent = unreadCount;
        navNotifBadge.classList.toggle('hidden', unreadCount === 0);
    }

    if (navNotifBadgeMobile) {
        navNotifBadgeMobile.textContent = unreadCount;
        navNotifBadgeMobile.classList.toggle('hidden', unreadCount === 0);
    }
}

// ─── Toast Helper ───
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
        'success': 'check-circle',
        'warning': 'alert-triangle',
        'error': 'x-circle',
        'info': 'bell-ring',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconMap[type] || 'bell-ring'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    toast.addEventListener('click', () => {
        toast.remove();
        loadView('notifications');
    });

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    // Auto-dismiss after 5s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Make showToast globally available for views
window.showToast = showToast;

// ─── Initialize ───
(async () => {
    await loadProfileData();
    await setupNotificationListener();
    loadView('home');
})();
