// js/views/announcements.js
const supabase = window.supabaseClient;

// DOM Elements
const cardsGrid = document.getElementById('announcements-cards-grid');
const statTotal = document.getElementById('ann-stat-total');
const statLive = document.getElementById('ann-stat-live');
const statDeadlines = document.getElementById('ann-stat-deadlines');
const statArchived = document.getElementById('ann-stat-archived');
const searchInput = document.getElementById('ann-search-input');
const searchClearBtn = document.getElementById('ann-search-clear');
const resultsCount = document.getElementById('ann-results-count');
const sortSelect = document.getElementById('ann-sort-select');
const filterPills = document.querySelectorAll('.ann-filter-pill');
const refreshBtn = document.getElementById('btn-ann-refresh');

// Modal Elements
const modal = document.getElementById('ann-modal');
const form = document.getElementById('ann-form');
const inpTitle = document.getElementById('ann-inp-title');
const inpContent = document.getElementById('ann-inp-content');
const modalTitle = document.getElementById('ann-modal-title');
const modalAvatar = document.getElementById('ann-modal-avatar');
const modalSaveBtn = document.getElementById('ann-modal-save-btn');
const charCounter = document.getElementById('ann-char-counter');

// State
let allAnnouncements = [];
let modalMode = 'add';
let currentEditId = null;
let currentFilter = 'all'; // 'all' | 'General' | 'Update' | 'Deadline' | 'archived'
let currentSearch = '';
let currentSort = 'newest';

// Category Style Map
const categoryStyles = {
    'Deadline': {
        gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
        accentColor: '#DC2626',
        badgeClass: 'deadline',
        icon: 'icon-calendar-clock',
        label: 'Deadline Alert'
    },
    'Update': {
        gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
        accentColor: '#059669',
        badgeClass: 'update',
        icon: 'icon-refresh-cw',
        label: 'System Update'
    },
    'General': {
        gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
        accentColor: '#2563EB',
        badgeClass: 'general',
        icon: 'icon-megaphone',
        label: 'General Notice'
    }
};

function getCategoryStyle(type) {
    return categoryStyles[type] || categoryStyles['General'];
}

// Format Date & Time cleanly
function formatDateTime(isoString) {
    if (!isoString) return 'Recent';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return 'Recent';
        
        const datePart = d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timePart = d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${datePart} • ${timePart}`;
    } catch (_) {
        return 'Recent';
    }
}

// Render Skeleton Loaders
function renderSkeletons() {
    if (!cardsGrid) return;
    cardsGrid.innerHTML = Array.from({ length: 4 }).map(() => `
        <div class="ann-skeleton-card sch-skeleton-card">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div class="sch-shimmer" style="width: 100px; height: 24px; border-radius: 20px;"></div>
                <div class="sch-shimmer" style="width: 65px; height: 22px; border-radius: 20px;"></div>
            </div>
            <div class="sch-shimmer" style="width: 75%; height: 20px; border-radius: 6px; margin-top: 4px;"></div>
            <div class="sch-shimmer" style="width: 35%; height: 14px; border-radius: 6px;"></div>
            <div class="sch-shimmer" style="width: 100%; height: 80px; border-radius: 12px; margin-top: 4px;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 12px;">
                <div class="sch-shimmer" style="width: 90px; height: 22px; border-radius: 6px;"></div>
                <div class="sch-shimmer" style="width: 80px; height: 30px; border-radius: 8px;"></div>
            </div>
        </div>
    `).join('');
}

// Load Announcements from Supabase
async function loadAnnouncements() {
    renderSkeletons();
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        allAnnouncements = data || [];
        updateMetrics();
        filterAndRenderCards();
    } catch (e) {
        console.error('Error loading announcements:', e);
        if (cardsGrid) {
            cardsGrid.innerHTML = `
                <div class="sch-empty-state">
                    <div class="sch-empty-icon" style="background: rgba(239, 68, 68, 0.1); color: #EF4444;">
                        <i class="icon-alert-triangle"></i>
                    </div>
                    <h3 class="sch-empty-title">Failed to load announcements</h3>
                    <p class="sch-empty-desc">${e.message || 'Table announcements might not exist or be accessible.'}</p>
                    <button class="btn btn-primary" onclick="loadAnnouncements()" style="margin-top: 8px;">
                        <i class="icon-refresh-cw"></i> Retry
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// Update Top Metrics
function updateMetrics() {
    const total = allAnnouncements.length;
    const live = allAnnouncements.filter(a => a.isActive !== false).length;
    const archived = total - live;
    const deadlines = allAnnouncements.filter(a => a.type === 'Deadline' && a.isActive !== false).length;

    if (statTotal) statTotal.textContent = total;
    if (statLive) statLive.textContent = live;
    if (statArchived) statArchived.textContent = archived;
    if (statDeadlines) statDeadlines.textContent = deadlines;
}

// Filter, Sort, and Render Cards
function filterAndRenderCards() {
    if (!cardsGrid) return;

    let filtered = [...allAnnouncements];

    // Filter by Tab
    if (currentFilter === 'archived') {
        filtered = filtered.filter(a => a.isActive === false);
    } else if (currentFilter === 'General' || currentFilter === 'Update' || currentFilter === 'Deadline') {
        filtered = filtered.filter(a => a.type === currentFilter && a.isActive !== false);
    }

    // Filter by Search Query
    if (currentSearch.trim()) {
        const q = currentSearch.trim().toLowerCase();
        filtered = filtered.filter(a => {
            const titleMatch = (a.title || '').toLowerCase().includes(q);
            const contentMatch = (a.content || '').toLowerCase().includes(q);
            const typeMatch = (a.type || '').toLowerCase().includes(q);
            return titleMatch || contentMatch || typeMatch;
        });
    }

    // Sort
    if (currentSort === 'newest') {
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (currentSort === 'oldest') {
        filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (currentSort === 'deadline-first') {
        filtered.sort((a, b) => {
            const aIsDead = a.type === 'Deadline' ? 1 : 0;
            const bIsDead = b.type === 'Deadline' ? 1 : 0;
            if (bIsDead !== aIsDead) return bIsDead - aIsDead;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    } else if (currentSort === 'title-asc') {
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    // Update Counter
    if (resultsCount) {
        resultsCount.textContent = `Showing ${filtered.length} of ${allAnnouncements.length} announcements`;
    }

    // Empty State
    if (filtered.length === 0) {
        cardsGrid.innerHTML = `
            <div class="sch-empty-state">
                <div class="sch-empty-icon">
                    <i class="icon-megaphone"></i>
                </div>
                <h3 class="sch-empty-title">No announcements found</h3>
                <p class="sch-empty-desc">
                    ${currentSearch.trim() ? `No broadcasts match "${escapeHtml(currentSearch)}".` : 'No announcements currently match the selected filter.'}
                </p>
                <div style="display: flex; gap: 10px; margin-top: 6px;">
                    <button class="btn btn-outline" onclick="resetSearchAndFilters()">
                        <i class="icon-refresh-cw"></i> Clear Filters
                    </button>
                    <button class="btn btn-primary" onclick="document.getElementById('btn-add-ann').click()">
                        <i class="icon-plus"></i> Post Update
                    </button>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Render Announcement Cards Grid
    cardsGrid.innerHTML = filtered.map(a => {
        const isActive = a.isActive !== false;
        const style = getCategoryStyle(a.type);
        const formattedDate = formatDateTime(a.createdAt);

        return `
            <div class="announcement-card ${!isActive ? 'archived-card' : ''}" id="ann-card-${a.id}">
                <!-- Accent Line -->
                <div class="ann-card-accent-bar" style="background: ${style.gradient};"></div>

                <!-- Header -->
                <div class="ann-card-header">
                    <div class="ann-badge ${style.badgeClass}">
                        <i class="${style.icon}"></i>
                        <span>${escapeHtml(a.type || 'General')}</span>
                    </div>

                    <div class="ann-status-pill ${isActive ? 'live' : 'archived'}">
                        <span class="ann-status-dot"></span>
                        <span>${isActive ? 'LIVE' : 'ARCHIVED'}</span>
                    </div>
                </div>

                <!-- Title & Meta -->
                <div>
                    <h3 class="ann-card-title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</h3>
                    <div class="ann-card-meta" style="margin-top: 4px;">
                        <i class="icon-calendar" style="font-size: 12px;"></i>
                        <span>${escapeHtml(formattedDate)}</span>
                    </div>
                </div>

                <!-- Message Body -->
                <div class="ann-card-content" title="${escapeHtml(a.content)}">
                    ${escapeHtml(a.content)}
                </div>

                <!-- Footer & Actions -->
                <div class="ann-card-footer">
                    <!-- Quick Toggle Archive -->
                    <button type="button" class="ann-quick-toggle" onclick="toggleStatus('${a.id}', ${!isActive})" title="${isActive ? 'Archive this notice' : 'Restore this notice to Live'}">
                        <i class="${isActive ? 'icon-archive' : 'icon-radio'}" style="font-size: 13px; color: ${isActive ? 'var(--text-secondary)' : '#059669'};"></i>
                        <span>${isActive ? 'Archive' : 'Restore'}</span>
                    </button>

                    <!-- Action Buttons -->
                    <div class="ann-card-actions">
                        <button class="ann-btn-action" title="Edit Announcement" onclick="editAnnouncement('${a.id}')">
                            <i class="icon-pencil" style="font-size: 13px;"></i>
                            <span>Edit</span>
                        </button>
                        <button class="ann-btn-action delete" title="Delete Announcement" onclick="deleteAnnouncement('${a.id}')">
                            <i class="icon-trash-2" style="font-size: 13px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// HTML escape helper
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Reset Search & Filters
window.resetSearchAndFilters = function() {
    currentSearch = '';
    currentFilter = 'all';
    currentSort = 'newest';
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.style.display = 'none';
    if (sortSelect) sortSelect.value = 'newest';
    filterPills.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
    });
    filterAndRenderCards();
};

// Modal Functions
function hideModal() {
    if (modal) modal.classList.add('hidden');
}

function updateCharCounter() {
    if (charCounter && inpContent) {
        const len = inpContent.value.length;
        charCounter.textContent = `${len} ${len === 1 ? 'char' : 'chars'}`;
    }
}

// Add Announcement Trigger
const btnAddAnn = document.getElementById('btn-add-ann');
if (btnAddAnn) {
    btnAddAnn.addEventListener('click', () => {
        modalMode = 'add';
        currentEditId = null;
        if (modalTitle) modalTitle.textContent = 'Post Announcement';
        if (modalSaveBtn) modalSaveBtn.textContent = 'Post Announcement';
        if (modalAvatar) modalAvatar.style.background = 'linear-gradient(135deg, #0A1E3F 0%, #1E355A 100%)';
        form.reset();
        
        const generalRadio = document.querySelector('input[name="ann-type"][value="General"]');
        if (generalRadio) generalRadio.checked = true;
        
        updateCharCounter();
        modal.classList.remove('hidden');
        inpTitle.focus();
    });
}

// Edit Announcement Trigger
window.editAnnouncement = function(id) {
    const a = allAnnouncements.find(x => String(x.id) === String(id));
    if (!a) return;
    modalMode = 'edit';
    currentEditId = id;
    if (modalTitle) modalTitle.textContent = 'Edit Announcement';
    if (modalSaveBtn) modalSaveBtn.textContent = 'Save Changes';

    const style = getCategoryStyle(a.type);
    if (modalAvatar) modalAvatar.style.background = style.gradient;

    inpTitle.value = a.title || '';
    inpContent.value = a.content || '';

    const r = document.querySelector(`input[name="ann-type"][value="${a.type}"]`);
    if (r) r.checked = true;
    else {
        const gen = document.querySelector('input[name="ann-type"][value="General"]');
        if (gen) gen.checked = true;
    }

    updateCharCounter();
    modal.classList.remove('hidden');
    inpTitle.focus();
};

// Archive / Unarchive Toggle Trigger
window.toggleStatus = async function(id, newState) {
    const announcement = allAnnouncements.find(a => String(a.id) === String(id));
    if (!announcement) return;

    // Optimistic UI update
    const prevStatus = announcement.isActive !== false;
    announcement.isActive = newState;
    updateMetrics();
    filterAndRenderCards();

    try {
        const { error } = await supabase
            .from('announcements')
            .update({ isActive: newState })
            .eq('id', id);

        if (error) throw error;

        if (window.showToast) {
            window.showToast(
                `Announcement ${newState ? 'restored to Live' : 'archived'}`,
                newState ? 'radio' : 'archive'
            );
        }
    } catch (err) {
        console.error('Error toggling status:', err);
        // Revert on failure
        announcement.isActive = prevStatus;
        updateMetrics();
        filterAndRenderCards();
        alert('Failed to update announcement status.');
    }
};

// Delete Announcement Trigger
window.deleteAnnouncement = async function(id) {
    const announcement = allAnnouncements.find(a => String(a.id) === String(id));
    const title = announcement ? announcement.title : 'this announcement';
    if (!confirm(`Are you sure you want to permanently delete "${title}"? This action cannot be undone.`)) return;

    try {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;

        if (window.showToast) {
            window.showToast('Announcement deleted successfully', 'trash-2');
        }
        await loadAnnouncements();
    } catch (err) {
        console.error('Error deleting announcement:', err);
        alert('Failed to delete announcement: ' + (err.message || 'Unknown error'));
    }
};

// Close Modal Events
const closeBtn = document.getElementById('close-ann-modal-btn');
const cancelBtn = document.getElementById('ann-modal-cancel-btn');
if (closeBtn) closeBtn.addEventListener('click', hideModal);
if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
}

// Character counter listener
if (inpContent) {
    inpContent.addEventListener('input', updateCharCounter);
}

// Category Radio Change Listener to update modal avatar gradient
document.querySelectorAll('input[name="ann-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const style = getCategoryStyle(radio.value);
        if (modalAvatar) modalAvatar.style.background = style.gradient;
    });
});

// Form Submit Handler
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldTxt = modalSaveBtn.textContent;
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        try {
            const selectedType = document.querySelector('input[name="ann-type"]:checked')?.value || 'General';
            const dataObj = {
                title: inpTitle.value.trim(),
                content: inpContent.value.trim(),
                type: selectedType,
            };

            if (modalMode === 'add') {
                dataObj.isActive = true;
                dataObj.createdAt = new Date().toISOString();
                const { error } = await supabase.from('announcements').insert([dataObj]);
                if (error) throw error;
                if (window.showToast) window.showToast('Announcement posted successfully!', 'check-circle');
            } else {
                const { error } = await supabase.from('announcements').update(dataObj).eq('id', currentEditId);
                if (error) throw error;
                if (window.showToast) window.showToast('Announcement updated successfully!', 'check-circle');
            }

            hideModal();
            await loadAnnouncements();
        } catch (err) {
            console.error('Error saving announcement:', err);
            alert('Failed to save announcement: ' + (err.message || 'Please check your inputs.'));
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = oldTxt;
        }
    });
}

// Search Input Listeners
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        if (searchClearBtn) {
            searchClearBtn.style.display = currentSearch ? 'block' : 'none';
        }
        filterAndRenderCards();
    });
}

if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
        currentSearch = '';
        searchInput.value = '';
        searchClearBtn.style.display = 'none';
        filterAndRenderCards();
        searchInput.focus();
    });
}

// Filter Tab Pills Listeners
filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter') || 'all';
        filterAndRenderCards();
    });
});

// Sort Select Listener
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        filterAndRenderCards();
    });
}

// Refresh Button Listener
if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
        const icon = refreshBtn.querySelector('i');
        if (icon) icon.style.animation = 'spin 0.8s linear infinite';
        await loadAnnouncements();
        setTimeout(() => {
            if (icon) icon.style.animation = '';
        }, 800);
        if (window.showToast) window.showToast('Announcements refreshed', 'refresh-cw');
    });
}

// Initial Load
loadAnnouncements();
