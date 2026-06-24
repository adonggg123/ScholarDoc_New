// js/views/scholarships.js
const supabase = window.supabaseClient;

const tableBody = document.getElementById('programs-table-body');
const modal = document.getElementById('scholarship-modal');
const form = document.getElementById('scholarship-form');
const inpName = document.getElementById('sch-inp-name');
const inpDesc = document.getElementById('sch-inp-desc');
const inpDocs = document.getElementById('sch-inp-docs');
const inpActive = document.getElementById('sch-inp-active');
const modalTitle = document.getElementById('sch-modal-title');

let allScholarships = [];
let modalMode = 'add';
let currentEditId = null;

async function loadPrograms() {
    try {
        const { data, error } = await supabase.from('scholarships').select('*').order('name', { ascending: true });
        if (error) throw error;
        
        allScholarships = data || [];
        
        // If empty, initialize defaults like Flutter does
        if (allScholarships.length === 0) {
            await initializeDefaults();
            return;
        }
        
        renderTable(allScholarships);
    } catch (e) {
        console.error('Error loading programs:', e);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--error);">Failed to load data. Table 'scholarships' might not exist or be accessible.</td></tr>`;
    }
}

async function initializeDefaults() {
    try {
        const defaults = [
            { name: 'TES', description: 'Tertiary Education Subsidy', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'TDP', description: 'Tulong Dunong Program', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'DBP', description: 'DBP Rise Scholarship Program', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'SANTEH', description: 'SANTEH Aquaculture S&T Foundation', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] },
            { name: 'STUFAP', description: 'Student Financial Assistance Program', isActive: true, requiredDocuments: ['SA Number', 'ID Front & Back + Signatures (PDF)'] }
        ];
        const { error } = await supabase.from('scholarships').insert(defaults);
        if (error) throw error;
        // Reload after inserting
        const { data: newData, error: newError } = await supabase.from('scholarships').select('*').order('name', { ascending: true });
        if (newError) throw newError;
        allScholarships = newData || [];
        renderTable(allScholarships);
    } catch (e) {
        console.error('Error initializing defaults:', e);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--error);">Failed to initialize default programs.</td></tr>`;
    }
}

function renderTable(programs) {
    if (programs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">No programs found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = programs.map(p => {
        const isActive = p.isActive !== false; // defaults to true
        let docsArray = [];
        if (Array.isArray(p.requiredDocuments)) {
            docsArray = p.requiredDocuments;
        } else if (typeof p.requiredDocuments === 'string') {
            try { docsArray = JSON.parse(p.requiredDocuments); } catch(e) { docsArray = []; }
        }

        const docsHtml = docsArray.length > 0 
            ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">` + docsArray.map(d => `<span style="background: #F1F5F9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #E2E8F0;">${d}</span>`).join('') + `</div>`
            : `<span style="font-size: 12px; font-style: italic; color: #94A3B8;">No documents required</span>`;

        return `
            <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 20px 24px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                            ${p.name.charAt(0).toUpperCase()}
                        </div>
                        <div style="font-weight: 700; font-size: 14px; color: #0F172A;">${p.name}</div>
                    </div>
                </td>
                <td style="padding: 20px 24px; max-width: 250px;">
                    <span style="font-size: 13px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; line-height: 1.5;">${p.description || 'No description provided'}</span>
                </td>
                <td style="padding: 20px 24px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: ${isActive ? '#059669' : '#64748B'}; background: ${isActive ? '#D1FAE5' : '#F1F5F9'}; padding: 4px 10px; border-radius: 20px;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isActive ? '#059669' : '#94A3B8'};"></span>
                        ${isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </td>
                <td style="padding: 20px 24px;">
                    ${docsHtml}
                </td>
                <td style="padding: 20px 24px; text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                        <button class="icon-btn" title="Edit" onclick="editProgram('${p.id}')" style="background: white; border: 1px solid #E2E8F0; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" onmouseover="this.style.borderColor='#4F46E5'; this.style.color='#4F46E5';" onmouseout="this.style.borderColor='#E2E8F0'; this.style.color='#64748B';">
                            <i class="icon-pencil" style="font-size: 14px;"></i>
                        </button>
                        <button class="icon-btn" title="Delete" onclick="deleteProgram('${p.id}')" style="background: white; border: 1px solid #E2E8F0; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #EF4444; transition: all 0.2s;" onmouseover="this.style.borderColor='#EF4444'; this.style.background='#FEF2F2';" onmouseout="this.style.borderColor='#E2E8F0'; this.style.background='white';">
                            <i class="icon-trash-2" style="font-size: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

function hideModal() {
    modal.classList.add('hidden');
}

document.getElementById('btn-add-program').addEventListener('click', () => {
    modalMode = 'add';
    modalTitle.textContent = 'Add Scholarship';
    form.reset();
    inpActive.checked = true;
    modal.classList.remove('hidden');
});

document.getElementById('close-sch-modal-btn').addEventListener('click', hideModal);
document.getElementById('sch-modal-cancel-btn').addEventListener('click', hideModal);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sch-modal-save-btn');
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const docs = inpDocs.value.split(',').map(s => s.trim()).filter(s => s);
        const dataObj = {
            name: inpName.value.trim(),
            description: inpDesc.value.trim(),
            requiredDocuments: docs, // Send as JSON array
            isActive: inpActive.checked
        };

        if (modalMode === 'add') {
            const { error } = await supabase.from('scholarships').insert([dataObj]);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('scholarships').update(dataObj).eq('id', currentEditId);
            if (error) throw error;
        }

        hideModal();
        loadPrograms();
    } catch (err) {
        console.error('Error saving program:', err);
        alert('Failed to save program.');
    } finally {
        btn.disabled = false;
        btn.textContent = oldTxt;
    }
});

window.editProgram = function(id) {
    const p = allScholarships.find(x => String(x.id) === String(id));
    if (!p) return;
    modalMode = 'edit';
    currentEditId = id;
    modalTitle.textContent = 'Edit Scholarship';
    
    inpName.value = p.name || '';
    inpDesc.value = p.description || '';
    
    let docsArray = [];
    if (Array.isArray(p.requiredDocuments)) docsArray = p.requiredDocuments;
    else if (typeof p.requiredDocuments === 'string') {
        try { docsArray = JSON.parse(p.requiredDocuments); } catch(e){}
    }
    inpDocs.value = docsArray.join(', ');
    
    inpActive.checked = p.isActive !== false;

    modal.classList.remove('hidden');
};

window.deleteProgram = async function(id) {
    if (!confirm('Are you sure you want to delete this scholarship program?')) return;
    try {
        const { error } = await supabase.from('scholarships').delete().eq('id', id);
        if (error) throw error;
        loadPrograms();
    } catch (err) {
        console.error('Error deleting program:', err);
        alert('Failed to delete program.');
    }
};

loadPrograms();
