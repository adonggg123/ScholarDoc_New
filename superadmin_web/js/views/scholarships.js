// js/views/scholarships.js
const supabase = window.supabaseClient;

// DOM Elements
const cardsGrid = document.getElementById('scholarship-cards-grid');
const statTotal = document.getElementById('sch-stat-total');
const statActive = document.getElementById('sch-stat-active');
const statInactive = document.getElementById('sch-stat-inactive');
const statDocs = document.getElementById('sch-stat-docs');
const searchInput = document.getElementById('sch-search-input');
const searchClearBtn = document.getElementById('sch-search-clear');
const resultsCount = document.getElementById('sch-results-count');
const sortSelect = document.getElementById('sch-sort-select');
const filterPills = document.querySelectorAll('.sch-filter-pill');
const refreshBtn = document.getElementById('btn-sch-refresh');

// Modal Elements
const modal = document.getElementById('scholarship-modal');
const form = document.getElementById('scholarship-form');
const inpName = document.getElementById('sch-inp-name');
const inpDesc = document.getElementById('sch-inp-desc');
const inpDocs = document.getElementById('sch-inp-docs');
const inpActive = document.getElementById('sch-inp-active');
const modalTitle = document.getElementById('sch-modal-title');
const modalAvatar = document.getElementById('sch-modal-avatar');
const modalDocPreview = document.getElementById('sch-modal-doc-preview');
const modalSaveBtn = document.getElementById('sch-modal-save-btn');

// State
let allScholarships = [];
let modalMode = 'add';
let currentEditId = null;
let currentFilter = 'all'; // 'all' | 'active' | 'inactive'
let currentSearch = '';
let currentSort = 'name-asc';

// Program Style / Monogram Resolver
function getProgramStyle(name) {
    const upper = (name || '').trim().toUpperCase();
    if (upper.includes('TES')) {
        return {
            gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
            accent: '#3B82F6',
            monogram: 'TES',
            category: 'UniFAST / CHED Grant'
        };
    } else if (upper.includes('TDP')) {
        return {
            gradient: 'linear-gradient(135deg, #065F46 0%, #10B981 100%)',
            accent: '#10B981',
            monogram: 'TDP',
            category: 'Tulong Dunong Program'
        };
    } else if (upper.includes('DBP')) {
        return {
            gradient: 'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)',
            accent: '#F59E0B',
            monogram: 'DBP',
            category: 'Institutional Partner Grant'
        };
    } else if (upper.includes('SANTEH')) {
        return {
            gradient: 'linear-gradient(135deg, #0369A1 0%, #06B6D4 100%)',
            accent: '#06B6D4',
            monogram: 'SNT',
            category: 'Foundation Partner'
        };
    } else if (upper.includes('STUFAP')) {
        return {
            gradient: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
            accent: '#8B5CF6',
            monogram: 'STF',
            category: 'Student Financial Assistance'
        };
    } else {
        const letters = upper.replace(/[^A-Z]/g, '').slice(0, 3) || 'SCH';
        return {
            gradient: 'linear-gradient(135deg, #0A1E3F 0%, #1E355A 100%)',
            accent: '#0A1E3F',
            monogram: letters,
            category: 'Scholarship Program'
        };
    }
}

// Safely normalize documents array
function getDocsArray(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (_) {}
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

// Render Skeleton Loading Placeholders
function renderSkeletons() {
    if (!cardsGrid) return;
    cardsGrid.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="sch-skeleton-card">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <div class="sch-shimmer" style="width: 46px; height: 46px; border-radius: 13px;"></div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                        <div class="sch-shimmer" style="width: 60%; height: 16px;"></div>
                        <div class="sch-shimmer" style="width: 40%; height: 11px;"></div>
                    </div>
                </div>
                <div class="sch-shimmer" style="width: 64px; height: 22px; border-radius: 20px;"></div>
            </div>
            <div class="sch-shimmer" style="width: 100%; height: 36px; border-radius: 8px;"></div>
            <div class="sch-shimmer" style="width: 100%; height: 72px; border-radius: 12px;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 12px;">
                <div class="sch-shimmer" style="width: 90px; height: 22px; border-radius: 12px;"></div>
                <div class="sch-shimmer" style="width: 80px; height: 30px; border-radius: 8px;"></div>
            </div>
        </div>
    `).join('');
}

// Load Programs from Supabase
async function loadPrograms() {
    renderSkeletons();
    try {
        const { data, error } = await supabase.from('scholarships').select('*').order('name', { ascending: true });
        if (error) throw error;
        
        allScholarships = data || [];
        
        // If empty, initialize defaults like Flutter does
        if (allScholarships.length === 0) {
            await initializeDefaults();
            return;
        }
        
        updateMetrics();
        filterAndRenderCards();
    } catch (e) {
        console.error('Error loading programs:', e);
        if (cardsGrid) {
            cardsGrid.innerHTML = `
                <div class="sch-empty-state">
                    <div class="sch-empty-icon" style="background: rgba(239, 68, 68, 0.1); color: #EF4444;">
                        <i class="icon-alert-triangle"></i>
                    </div>
                    <h3 class="sch-empty-title">Failed to load scholarships</h3>
                    <p class="sch-empty-desc">${e.message || 'Unable to connect to the database. Please check your connection and try again.'}</p>
                    <button class="btn btn-primary" onclick="loadPrograms()" style="margin-top: 8px;">
                        <i class="icon-refresh-cw"></i> Retry
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// Initialize Default Programs if Table is Empty
async function initializeDefaults() {
    try {
        const defaults = [
            { name: 'TES', description: 'Tertiary Education Subsidy for qualified higher education students', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'TDP', description: 'Tulong Dunong Program financial assistance for deserving students', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'DBP', description: 'DBP Rise Scholarship Program institutional partner support', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'SANTEH', description: 'SANTEH Aquaculture S&T Foundation grant for fisheries & agri', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'STUFAP', description: 'Student Financial Assistance Program for state university scholars', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] }
        ];
        const { error } = await supabase.from('scholarships').insert(defaults);
        if (error) throw error;
        
        const { data: newData, error: newError } = await supabase.from('scholarships').select('*').order('name', { ascending: true });
        if (newError) throw newError;
        allScholarships = newData || [];
        updateMetrics();
        filterAndRenderCards();
    } catch (e) {
        console.error('Error initializing defaults:', e);
        if (cardsGrid) {
            cardsGrid.innerHTML = `
                <div class="sch-empty-state">
                    <div class="sch-empty-icon" style="background: rgba(239, 68, 68, 0.1); color: #EF4444;">
                        <i class="icon-alert-triangle"></i>
                    </div>
                    <h3 class="sch-empty-title">Failed to initialize default programs</h3>
                    <p class="sch-empty-desc">Please verify database permissions.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

// Update Top Metrics
function updateMetrics() {
    const total = allScholarships.length;
    const active = allScholarships.filter(p => p.isActive !== false).length;
    const inactive = total - active;
    
    let totalDocs = 0;
    allScholarships.forEach(p => {
        totalDocs += getDocsArray(p.requiredDocuments).length;
    });

    if (statTotal) statTotal.textContent = total;
    if (statActive) statActive.textContent = active;
    if (statInactive) statInactive.textContent = inactive;
    if (statDocs) statDocs.textContent = totalDocs;
}

// Filter, Sort, and Render Cards
function filterAndRenderCards() {
    if (!cardsGrid) return;

    let filtered = [...allScholarships];

    // Filter by Active Status Tab
    if (currentFilter === 'active') {
        filtered = filtered.filter(p => p.isActive !== false);
    } else if (currentFilter === 'inactive') {
        filtered = filtered.filter(p => p.isActive === false);
    }

    // Filter by Search Query
    if (currentSearch.trim()) {
        const q = currentSearch.trim().toLowerCase();
        filtered = filtered.filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const descMatch = (p.description || '').toLowerCase().includes(q);
            const docsMatch = getDocsArray(p.requiredDocuments).some(d => d.toLowerCase().includes(q));
            return nameMatch || descMatch || docsMatch;
        });
    }

    // Sort
    if (currentSort === 'name-asc') {
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (currentSort === 'name-desc') {
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (currentSort === 'status-active') {
        filtered.sort((a, b) => {
            const aActive = a.isActive !== false ? 1 : 0;
            const bActive = b.isActive !== false ? 1 : 0;
            if (bActive !== aActive) return bActive - aActive;
            return (a.name || '').localeCompare(b.name || '');
        });
    } else if (currentSort === 'docs-count') {
        filtered.sort((a, b) => {
            const aCount = getDocsArray(a.requiredDocuments).length;
            const bCount = getDocsArray(b.requiredDocuments).length;
            return bCount - aCount;
        });
    }

    // Update Results Counter
    if (resultsCount) {
        resultsCount.textContent = `Showing ${filtered.length} of ${allScholarships.length} programs`;
    }

    // Render Empty State if no cards match
    if (filtered.length === 0) {
        cardsGrid.innerHTML = `
            <div class="sch-empty-state">
                <div class="sch-empty-icon">
                    <i class="icon-search-x"></i>
                </div>
                <h3 class="sch-empty-title">No scholarship programs found</h3>
                <p class="sch-empty-desc">
                    ${currentSearch.trim() ? `No results match "${escapeHtml(currentSearch)}".` : 'No programs match the selected filter.'}
                </p>
                <div style="display: flex; gap: 10px; margin-top: 6px;">
                    <button class="btn btn-outline" onclick="resetSearchAndFilters()">
                        <i class="icon-refresh-cw"></i> Clear Filters
                    </button>
                    <button class="btn btn-primary" onclick="document.getElementById('btn-add-program').click()">
                        <i class="icon-plus"></i> Add Program
                    </button>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // Render Modern Cards Grid
    cardsGrid.innerHTML = filtered.map(p => {
        const isActive = p.isActive !== false;
        const style = getProgramStyle(p.name);
        const docsArray = getDocsArray(p.requiredDocuments);
        const docsCount = docsArray.length;

        const docsHtml = docsCount > 0
            ? docsArray.map(doc => `
                <span class="sch-doc-chip" title="${escapeHtml(doc)}">
                    <i class="icon-file-text"></i>
                    <span>${escapeHtml(doc)}</span>
                </span>
            `).join('')
            : `<span class="sch-doc-empty">No required documents specified</span>`;

        return `
            <div class="scholarship-card ${!isActive ? 'inactive-card' : ''}" id="sch-card-${p.id}">
                <!-- Accent Line -->
                <div class="sch-card-accent-bar" style="background: ${style.gradient};"></div>
                
                <!-- Card Header -->
                <div class="sch-card-header">
                    <div class="sch-header-main">
                        <div class="sch-avatar" style="background: ${style.gradient};">
                            ${escapeHtml(style.monogram)}
                        </div>
                        <div class="sch-title-block">
                            <h3 class="sch-card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
                            <span class="sch-card-tag">${escapeHtml(style.category)}</span>
                        </div>
                    </div>

                    <!-- Status Pill -->
                    <div class="sch-status-pill ${isActive ? 'active' : 'inactive'}">
                        <span class="sch-status-dot"></span>
                        <span>${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                </div>

                <!-- Description -->
                <p class="sch-card-desc" title="${escapeHtml(p.description || '')}">
                    ${escapeHtml(p.description || 'No description provided for this scholarship program.')}
                </p>

                <!-- Required Documents Box -->
                <div class="sch-docs-box">
                    <div class="sch-docs-header">
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <i class="icon-paperclip" style="font-size: 12px; color: var(--primary-color);"></i>
                            Required Documents
                        </span>
                        <span class="sch-docs-count-badge">${docsCount} ${docsCount === 1 ? 'doc' : 'docs'}</span>
                    </div>
                    <div class="sch-docs-list">
                        ${docsHtml}
                    </div>
                </div>

                <!-- Card Footer & Actions -->
                <div class="sch-card-footer">
                    <!-- Quick Status Toggle -->
                    <div class="sch-status-toggle-wrapper" onclick="toggleProgramStatus('${p.id}', ${!isActive})" title="Click to switch status to ${!isActive ? 'Active' : 'Inactive'}">
                        <button type="button" class="sch-switch-btn ${isActive ? 'active' : ''}">
                            <span class="sch-switch-knob"></span>
                        </button>
                        <span class="sch-switch-label">${isActive ? 'Active' : 'Inactive'}</span>
                    </div>

                    <!-- Edit & Delete Buttons -->
                    <div class="sch-card-actions">
                        <button class="sch-btn-action" title="Edit Scholarship" onclick="editProgram('${p.id}')">
                            <i class="icon-pencil" style="font-size: 13px;"></i>
                            <span>Edit</span>
                        </button>
                        <button class="sch-btn-action delete" title="Delete Program" onclick="deleteProgram('${p.id}')">
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
    currentSort = 'name-asc';
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.style.display = 'none';
    if (sortSelect) sortSelect.value = 'name-asc';
    filterPills.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
    });
    filterAndRenderCards();
};

// Quick Status Toggle directly from card
window.toggleProgramStatus = async function(id, newStatus) {
    const program = allScholarships.find(p => String(p.id) === String(id));
    if (!program) return;

    // Optimistic UI update
    const prevStatus = program.isActive !== false;
    program.isActive = newStatus;
    updateMetrics();
    filterAndRenderCards();

    try {
        const { error } = await supabase
            .from('scholarships')
            .update({ isActive: newStatus })
            .eq('id', id);

        if (error) throw error;

        if (window.showToast) {
            window.showToast(`${program.name} is now ${newStatus ? 'Active' : 'Inactive'}`, newStatus ? 'check-circle' : 'pause-circle');
        }
    } catch (err) {
        console.error('Error toggling status:', err);
        // Revert on error
        program.isActive = prevStatus;
        updateMetrics();
        filterAndRenderCards();
        alert('Failed to update scholarship status. Please try again.');
    }
};

// Modal helpers
function hideModal() {
    if (modal) modal.classList.add('hidden');
}

function updateDocPreview(text) {
    if (!modalDocPreview) return;
    const docs = (text || '').split(',').map(s => s.trim()).filter(Boolean);
    if (docs.length === 0) {
        modalDocPreview.innerHTML = `<span style="font-size: 12px; color: var(--text-secondary); font-style: italic;">None entered</span>`;
    } else {
        modalDocPreview.innerHTML = docs.map(d => `
            <span class="sch-doc-chip">
                <i class="icon-file-text" style="color: var(--primary-color);"></i>
                <span>${escapeHtml(d)}</span>
            </span>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }
}

// Add Program Trigger
const btnAddProgram = document.getElementById('btn-add-program');
if (btnAddProgram) {
    btnAddProgram.addEventListener('click', () => {
        modalMode = 'add';
        currentEditId = null;
        if (modalTitle) modalTitle.textContent = 'Add Scholarship';
        if (modalAvatar) modalAvatar.style.background = 'linear-gradient(135deg, #0F3260 0%, #1E4976 100%)';
        form.reset();
        inpActive.checked = true;
        updateDocPreview('');
        modal.classList.remove('hidden');
        inpName.focus();
    });
}

// Edit Program Trigger
window.editProgram = function(id) {
    const p = allScholarships.find(x => String(x.id) === String(id));
    if (!p) return;
    modalMode = 'edit';
    currentEditId = id;
    if (modalTitle) modalTitle.textContent = `Edit Scholarship: ${p.name}`;
    
    const style = getProgramStyle(p.name);
    if (modalAvatar) modalAvatar.style.background = style.gradient;

    inpName.value = p.name || '';
    inpDesc.value = p.description || '';
    
    const docsArray = getDocsArray(p.requiredDocuments);
    inpDocs.value = docsArray.join(', ');
    updateDocPreview(inpDocs.value);
    
    inpActive.checked = p.isActive !== false;

    modal.classList.remove('hidden');
    inpName.focus();
};

// Delete Program Trigger
window.deleteProgram = async function(id) {
    const program = allScholarships.find(x => String(x.id) === String(id));
    const progName = program ? program.name : 'this';
    if (!confirm(`Are you sure you want to delete ${progName} scholarship program? This action cannot be undone.`)) return;

    try {
        const { error } = await supabase.from('scholarships').delete().eq('id', id);
        if (error) throw error;
        
        if (window.showToast) {
            window.showToast(`${progName} program deleted successfully`, 'trash-2');
        }
        await loadPrograms();
    } catch (err) {
        console.error('Error deleting program:', err);
        alert('Failed to delete program: ' + (err.message || 'Unknown error'));
    }
};

// Close Modal Events
const closeBtn = document.getElementById('close-sch-modal-btn');
const cancelBtn = document.getElementById('sch-modal-cancel-btn');
if (closeBtn) closeBtn.addEventListener('click', hideModal);
if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

// Close modal when clicking backdrop
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
}

// Live Document Tag Preview Listener
if (inpDocs) {
    inpDocs.addEventListener('input', (e) => {
        updateDocPreview(e.target.value);
    });
}

// Form Submit Handler
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldTxt = modalSaveBtn.textContent;
        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Saving...';

        try {
            const docs = inpDocs.value.split(',').map(s => s.trim()).filter(Boolean);
            const dataObj = {
                name: inpName.value.trim(),
                description: inpDesc.value.trim(),
                requiredDocuments: docs,
                isActive: inpActive.checked
            };

            if (modalMode === 'add') {
                const { error } = await supabase.from('scholarships').insert([dataObj]);
                if (error) throw error;
                if (window.showToast) window.showToast(`Added ${dataObj.name} successfully!`, 'check-circle');
            } else {
                const { error } = await supabase.from('scholarships').update(dataObj).eq('id', currentEditId);
                if (error) throw error;
                if (window.showToast) window.showToast(`Updated ${dataObj.name} successfully!`, 'check-circle');
            }

            hideModal();
            await loadPrograms();
        } catch (err) {
            console.error('Error saving program:', err);
            alert('Failed to save program: ' + (err.message || 'Please check your inputs.'));
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
        await loadPrograms();
        setTimeout(() => {
            if (icon) icon.style.animation = '';
        }, 800);
        if (window.showToast) window.showToast('Scholarships refreshed', 'refresh-cw');
    });
}

// Initial Load
loadPrograms();
