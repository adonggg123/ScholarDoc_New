// ScholarDoc Student Web — Scholar Directory View Logic
// Mirrors user_directory_screen.dart

const sb = window.supabaseClient;
const gridEl = document.getElementById('scholars-grid');
const emptyEl = document.getElementById('directory-empty');
const searchInput = document.getElementById('search-input');

let allScholars = [];
let searchQuery = '';

async function loadDirectory() {
    try {
        const { data, error } = await sb
            .from('students')
            .select()
            .order('fullName', { ascending: true });

        if (error) throw error;

        allScholars = data || [];
        renderDirectory();

    } catch (err) {
        console.error('Error loading directory:', err);
        if (gridEl) {
            gridEl.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Could not load directory.</p>`;
        }
    }
}

function renderDirectory() {
    if (!gridEl) return;

    const query = searchQuery.trim().toLowerCase();
    const filtered = allScholars.filter(s => {
        const fullName = (s.fullName || '').toLowerCase();
        const course = (s.course || '').toLowerCase();
        const scholarship = (s.scholarshipName || '').toLowerCase();
        return fullName.includes(query) || course.includes(query) || scholarship.includes(query);
    });

    if (filtered.length === 0) {
        gridEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    emptyEl?.classList.add('hidden');

    gridEl.innerHTML = filtered.map(s => {
        const isOnline = s.isOnline === true;
        const fullName = s.fullName || 'Anonymous Scholar';
        const course = s.course || 'Unspecified Course';
        const year = s.year || '';
        const scholarship = s.scholarshipName || 'No Scholarship';
        const photoUrl = s.profilePictureUrl;
        const initial = fullName.charAt(0).toUpperCase() || 'S';

        return `
            <div class="card" style="padding: 16px 20px; transition: all 0.3s; position: relative;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <!-- Avatar Stack with Presence Indicator -->
                    <div style="position: relative; width: 48px; height: 48px; flex-shrink: 0;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid ${isOnline ? 'var(--success)' : 'transparent'}; padding: 1.5px; overflow: hidden; background-color: rgba(15, 50, 96, 0.06); display: flex; align-items: center; justify-content: center;">
                            ${photoUrl ? `
                                <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                            ` : `
                                <span style="font-weight: 700; font-size: 15px; color: var(--primary-color);">${initial}</span>
                            `}
                        </div>
                        ${isOnline ? `
                            <div style="position: absolute; bottom: 0; right: 0; width: 14px; height: 14px; background-color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--success); animation: pulse 2s infinite;"></div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Details -->
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fullName}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${course} ${year ? '• ' + year : ''}</div>
                        <div style="margin-top: 6px;">
                            <span style="font-size: 9px; font-weight: 800; color: var(--primary-color); background: rgba(15,50,96,0.06); padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">${scholarship}</span>
                        </div>
                    </div>

                    <!-- Online Status Badge -->
                    <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 8px; background: ${isOnline ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.05)'}; font-size: 9px; font-weight: 900; color: ${isOnline ? 'var(--success)' : 'var(--text-secondary)'}; letter-spacing: 0.3px; flex-shrink: 0;">
                        <div style="width: 5px; height: 5px; border-radius: 50%; background-color: ${isOnline ? 'var(--success)' : 'rgba(107,114,128,0.5)'};"></div>
                        ${isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // CSS Pulse Animation for online dot
    if (!document.getElementById('pulse-animation-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-animation-style';
        style.innerHTML = `
            @keyframes pulse {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
                70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
        `;
        document.head.appendChild(style);
    }

    if (window.lucide) window.lucide.createIcons();
}

// Search Input Listener
searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderDirectory();
});

// Initial load
loadDirectory();

// Real-time subscription to refresh user status or profile details
const channel = sb.channel('directory-view-reload')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students'
    }, () => {
        loadDirectory();
    })
    .subscribe();
