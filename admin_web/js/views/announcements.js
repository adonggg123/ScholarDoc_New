// js/views/announcements.js
const supabase = window.supabaseClient;

const listContainer = document.getElementById('announcements-list');
const modal = document.getElementById('ann-modal');
const form = document.getElementById('ann-form');
const inpTitle = document.getElementById('ann-inp-title');
const inpContent = document.getElementById('ann-inp-content');
const modalTitle = document.getElementById('ann-modal-title');

let allAnnouncements = [];
let modalMode = 'add';
let currentEditId = null;

async function loadAnnouncements() {
    try {
        const { data, error } = await supabase.from('announcements').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        allAnnouncements = data || [];
        renderList(allAnnouncements);
    } catch (e) {
        console.error('Error loading announcements:', e);
        listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Failed to load data. Table 'announcements' might not exist or be accessible.</div>`;
    }
}

function renderList(announcements) {
    if (announcements.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No announcements found.</div>`;
        return;
    }

    listContainer.innerHTML = announcements.map(a => {
        const isActive = a.isActive !== false;
        const dateStr = new Date(a.createdAt).toLocaleDateString();
        
        let typeColor = 'var(--primary-color)';
        let typeIcon = 'icon-megaphone';
        if (a.type === 'Deadline') { typeColor = 'var(--error)'; typeIcon = 'icon-calendar-clock'; }
        else if (a.type === 'Update') { typeColor = 'var(--success)'; typeIcon = 'icon-refresh-cw'; }

        return `
            <div style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; opacity: ${isActive ? '1' : '0.6'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="padding: 6px 12px; background: ${typeColor}15; border: 1px solid ${typeColor}; border-radius: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="${typeIcon}" style="color: ${typeColor}; font-size: 14px;"></i>
                            <span style="color: ${typeColor}; font-size: 11px; font-weight: 700;">${a.type || 'General'}</span>
                        </div>
                        <h3 style="margin: 0; font-size: 15px;">${a.title}</h3>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 10px; font-weight: 700; color: ${isActive ? 'var(--success)' : 'var(--text-secondary)'}; background: ${isActive ? 'rgba(67, 160, 71, 0.1)' : 'rgba(0,0,0,0.05)'}; padding: 4px 8px; border-radius: 12px;">${isActive ? 'LIVE' : 'ARCHIVED'}</span>
                        <button class="icon-btn" title="Edit" onclick="editAnnouncement('${a.id}')"><i class="icon-edit" style="font-size: 14px;"></i></button>
                        <button class="icon-btn" title="${isActive ? 'Archive' : 'Unarchive'}" onclick="toggleStatus('${a.id}', ${!isActive})"><i class="${isActive ? 'icon-archive' : 'icon-inbox'}" style="font-size: 14px; color: ${isActive ? 'var(--text-secondary)' : 'var(--success)'}"></i></button>
                        <button class="icon-btn" title="Delete" onclick="deleteAnnouncement('${a.id}')"><i class="icon-trash-2" style="font-size: 14px; color: var(--error);"></i></button>
                    </div>
                </div>
                <p style="margin: 0 0 0 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5; padding-left: 92px;">${a.content}</p>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; padding-left: 92px;">
                    <i class="icon-calendar" style="font-size: 11px;"></i> Posted on ${dateStr}
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

function hideModal() {
    modal.classList.add('hidden');
}

document.getElementById('btn-add-ann').addEventListener('click', () => {
    modalMode = 'add';
    modalTitle.textContent = 'Post Announcement';
    form.reset();
    document.querySelector('input[name="ann-type"][value="General"]').checked = true;
    updateRadioStyles();
    modal.classList.remove('hidden');
});

document.getElementById('close-ann-modal-btn').addEventListener('click', hideModal);
document.getElementById('ann-modal-cancel-btn').addEventListener('click', hideModal);

// Sync custom radio styles
function updateRadioStyles() {
    const radios = document.querySelectorAll('input[name="ann-type"]');
    radios.forEach(r => {
        const btn = r.nextElementSibling;
        if (r.checked) {
            let color = 'var(--primary-color)';
            if(r.value === 'Deadline') color = 'var(--error)';
            if(r.value === 'Update') color = 'var(--success)';
            btn.style.borderColor = color;
            btn.style.color = color;
            // A simple tint:
            if(r.value === 'General') btn.style.backgroundColor = 'rgba(15, 50, 96, 0.1)';
            if(r.value === 'Update') btn.style.backgroundColor = 'rgba(67, 160, 71, 0.1)';
            if(r.value === 'Deadline') btn.style.backgroundColor = 'rgba(239, 83, 80, 0.1)';
        } else {
            btn.style.borderColor = 'var(--border-color)';
            btn.style.color = 'inherit';
            btn.style.backgroundColor = 'transparent';
        }
    });
}
document.querySelectorAll('input[name="ann-type"]').forEach(r => r.addEventListener('change', updateRadioStyles));

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('ann-modal-save-btn');
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const selectedType = document.querySelector('input[name="ann-type"]:checked').value;
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
        } else {
            const { error } = await supabase.from('announcements').update(dataObj).eq('id', currentEditId);
            if (error) throw error;
        }

        hideModal();
        loadAnnouncements();
    } catch (err) {
        console.error('Error saving announcement:', err);
        alert('Failed to save announcement.');
    } finally {
        btn.disabled = false;
        btn.textContent = oldTxt;
    }
});

window.editAnnouncement = function(id) {
    const a = allAnnouncements.find(x => x.id === id);
    if (!a) return;
    modalMode = 'edit';
    currentEditId = id;
    modalTitle.textContent = 'Edit Announcement';
    
    inpTitle.value = a.title || '';
    inpContent.value = a.content || '';
    
    const r = document.querySelector(`input[name="ann-type"][value="${a.type}"]`);
    if(r) r.checked = true;
    else document.querySelector('input[name="ann-type"][value="General"]').checked = true;
    
    updateRadioStyles();
    modal.classList.remove('hidden');
};

window.toggleStatus = async function(id, newState) {
    try {
        const { error } = await supabase.from('announcements').update({ isActive: newState }).eq('id', id);
        if (error) throw error;
        loadAnnouncements();
    } catch (err) {
        console.error('Error toggling status:', err);
        alert('Failed to update status.');
    }
};

window.deleteAnnouncement = async function(id) {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;
    try {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;
        loadAnnouncements();
    } catch (err) {
        console.error('Error deleting announcement:', err);
        alert('Failed to delete announcement.');
    }
};

loadAnnouncements();
