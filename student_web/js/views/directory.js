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
        const section = (s.section || '').toLowerCase();
        return fullName.includes(query) || course.includes(query) || scholarship.includes(query) || section.includes(query);
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
        const section = s.section ? `• Sec ${s.section}` : '';
        const scholarship = s.scholarshipName || 'Scholar';
        const photoUrl = s.profilePictureUrl;
        const initial = fullName.charAt(0).toUpperCase() || 'S';

        return `
            <div class="card" style="padding: 20px 18px; transition: all 0.25s ease;">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <!-- Avatar Stack with Presence Indicator -->
                    <div style="position: relative; width: 46px; height: 46px; flex-shrink: 0;">
                        <div style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: var(--gradient-primary); color: white; display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 800;">
                            ${photoUrl ? `
                                <img src="${photoUrl}" alt="${fullName}" style="width: 100%; height: 100%; object-fit: cover;">
                            ` : `
                                <span>${initial}</span>
                            `}
                        </div>
                        <div style="position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%; background: ${isOnline ? 'var(--success)' : 'var(--slate-400)'}; border: 2px solid var(--surface);"></div>
                    </div>

                    <!-- Details -->
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-family: 'Outfit', sans-serif; font-size: 14.5px; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.1px;">${fullName}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${course} ${year ? '• ' + year : ''} ${section}</div>
                        <div style="margin-top: 6px;">
                            <span class="badge badge-info" style="padding: 2px 8px; font-size: 9.5px;">${scholarship}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// Search Input Listener
searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderDirectory();
});

// Initial load
loadDirectory();

// Real-time subscription
const channel = sb.channel('directory-view-reload')
    .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students'
    }, () => {
        loadDirectory();
    })
    .subscribe();
