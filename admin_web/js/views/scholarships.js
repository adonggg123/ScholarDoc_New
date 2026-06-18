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
            ? `<div style="display: flex; gap: 4px; flex-wrap: wrap;">` + docsArray.map(d => `<span style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid var(--border-color);">${d}</span>`).join('') + `</div>`
            : `<span style="font-size: 11px; font-style: italic; color: var(--text-secondary);">None</span>`;

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 16px;">
                    <div style="font-weight: 700; font-size: 13px;">${p.name}</div>
                </td>
                <td style="padding: 16px; max-width: 200px;">
                    <span style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${p.description || 'No description'}</span>
                </td>
                <td style="padding: 16px;">
                    <span style="font-size: 11px; font-weight: 700; color: ${isActive ? 'var(--success)' : 'var(--text-secondary)'}; background: ${isActive ? 'rgba(67, 160, 71, 0.1)' : 'rgba(0,0,0,0.05)'}; padding: 4px 8px; border-radius: 12px;">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                </td>
                <td style="padding: 16px;">
                    ${docsHtml}
                </td>
                <td style="padding: 16px; text-align: right;">
                    <button class="icon-btn" title="Edit" onclick="editProgram('${p.id}')">
                        <i class="icon-edit"></i>
                    </button>
                    <button class="icon-btn" title="Delete" style="color: var(--error);" onclick="deleteProgram('${p.id}')">
                        <i class="icon-trash-2"></i>
                    </button>
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
    const p = allScholarships.find(x => x.id === id);
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
