// js/views/masterlist_import.js

// Dynamically load document parsing libraries
if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    document.head.appendChild(script);
    // Also load worker
    const workerScript = document.createElement('script');
    workerScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    document.head.appendChild(workerScript);
}

if (!window.mammoth) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    document.head.appendChild(script);
}

// Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfoContainer = document.getElementById('file-info-container');
const fileNameDisplay = document.getElementById('file-name-display');
const fileSizeDisplay = document.getElementById('file-size-display');
const btnClearFile = document.getElementById('btn-clear-file');
const btnExtract = document.getElementById('btn-extract');
const ocrProgressContainer = document.getElementById('ocr-progress-container');
const ocrStatusText = document.getElementById('ocr-status-text');
const extractedTableBody = document.getElementById('extracted-table-body');
const btnSaveRecords = document.getElementById('btn-save-records');
const filterBatch = document.getElementById('filter-batch');

let currentFile = null;
let extractedRecords = [];

// Utility to format file size
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Drag and Drop Events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary-color)';
    dropZone.style.background = 'rgba(var(--primary-rgb), 0.05)';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'rgba(0,0,0,0.01)';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'rgba(0,0,0,0.01)';
    
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

btnClearFile.addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    fileInfoContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    btnExtract.disabled = true;
    ocrProgressContainer.classList.add('hidden');
    
    extractedRecords = [];
    populateBatchFilter();
    renderTable();
    btnSaveRecords.classList.add('hidden');
});

function handleFile(file) {
    const validExtensions = ['pdf', 'doc', 'docx'];
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(ext)) {
        alert('Please upload a valid document file (PDF, DOC, DOCX).');
        return;
    }
    
    currentFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatBytes(file.size);
    
    dropZone.classList.add('hidden');
    fileInfoContainer.classList.remove('hidden');
    btnExtract.disabled = false;
    
    extractedRecords = [];
    populateBatchFilter();
    renderTable();
    btnSaveRecords.classList.add('hidden');
}

// Extraction Logic
btnExtract.addEventListener('click', async () => {
    if (!currentFile) return;
    
    btnExtract.disabled = true;
    ocrProgressContainer.classList.remove('hidden');
    extractedRecords = [];
    populateBatchFilter();
    renderTable();
    btnSaveRecords.classList.add('hidden');
    
    try {
        const ext = currentFile.name.split('.').pop().toLowerCase();
        let extractedText = '';
        
        if (ext === 'pdf') {
            extractedText = await extractPdfText(currentFile);
        } else if (ext === 'docx' || ext === 'doc') {
            extractedText = await extractDocxText(currentFile);
        }
        
        parseDocumentText(extractedText);
        
        if (extractedRecords.length > 0) {
            await saveRecordsToDatabase();
        }
        
    } catch (err) {
        console.error('Extraction Error:', err);
        alert('Error extracting text from document. Make sure it is a valid text-based file.');
    } finally {
        btnExtract.disabled = false;
        ocrStatusText.textContent = 'Complete';
        setTimeout(() => {
            ocrProgressContainer.classList.add('hidden');
        }, 2000);
    }
});

async function extractPdfText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!window.pdfjsLib) {
                    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
                }
                // Ensure worker is set up
                if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                }

                const typedarray = new Uint8Array(e.target.result);
                const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    let pageText = '';
                    for (const item of textContent.items) {
                        pageText += item.str;
                        if (item.hasEOL) {
                            pageText += '\n';
                        }
                    }
                    fullText += pageText + '\n\n';
                }
                resolve(fullText);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function extractDocxText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                resolve(result.value);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function parseDocumentText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentBatch = 'Batch 1'; // Default
    const records = [];
    
    let tempNameParts = [];

    // Simple Heuristic Parser
    for (const line of lines) {
        // Check if line indicates a batch
        if (line.toLowerCase().includes('batch')) {
            const batchMatch = line.match(/batch\s*\d+/i);
            if (batchMatch) {
                currentBatch = batchMatch[0].replace(/\s+/g, ' ');
                currentBatch = currentBatch.charAt(0).toUpperCase() + currentBatch.slice(1);
                tempNameParts = []; // reset if batch changes
                continue;
            }
        }
        
        // Exclude common header terms, numbers, or very short lines
        const lLine = line.toLowerCase();
        if (lLine === 'name' || lLine === 'student' || lLine.includes('last name') || lLine.includes('first name') || lLine.includes('middle name') || lLine === 'no.' || lLine === 'no' || line.length < 2) {
            continue;
        }
        
        // Clean line
        const cleanLine = line.replace(/^[\d\.\-\)\s]+/, '').trim();
        if (cleanLine.length < 2) continue;
        
        if (cleanLine.includes(',')) {
            // Case 1: single line with commas
            const parts = cleanLine.split(',').map(p => p.trim());
            records.push({
                lastName: parts[0] || '',
                firstName: parts[1] || '',
                middleName: parts[2] || '',
                batch: currentBatch
            });
            tempNameParts = [];
        } else {
            // Case 2: parts come in separate lines
            tempNameParts.push(cleanLine);
            if (tempNameParts.length === 3) {
                records.push({
                    lastName: tempNameParts[0],
                    firstName: tempNameParts[1],
                    middleName: tempNameParts[2],
                    batch: currentBatch
                });
                tempNameParts = [];
            }
        }
    }
    
    // If there are leftovers
    if (tempNameParts.length > 0) {
        records.push({
            lastName: tempNameParts[0] || '',
            firstName: tempNameParts[1] || '',
            middleName: tempNameParts[2] || '',
            batch: currentBatch
        });
    }
    
    extractedRecords = records;
    populateBatchFilter();
    renderTable();
    
    if (extractedRecords.length > 0) {
        btnSaveRecords.classList.remove('hidden');
    } else {
        btnSaveRecords.classList.add('hidden');
        alert('No names could be clearly extracted. Please ensure the document is clear and contains a list of names.');
    }
}

function populateBatchFilter() {
    if (extractedRecords.length === 0) {
        if (filterBatch) filterBatch.classList.add('hidden');
        return;
    }
    
    if (!filterBatch) return;
    
    const batches = [...new Set(extractedRecords.map(r => r.batch))].sort();
    
    filterBatch.innerHTML = '<option value="All Batches">All Batches</option>';
    batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        filterBatch.appendChild(opt);
    });
    
    filterBatch.classList.remove('hidden');
}

if (filterBatch) {
    filterBatch.addEventListener('change', () => {
        renderTable();
    });
}

function renderTable() {
    if (extractedRecords.length === 0) {
        extractedTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="icon-file-search" style="font-size: 40px; color: #cbd5e1;"></i>
                        <span>Upload a document and extract data to see results here.</span>
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    const filterValue = filterBatch ? filterBatch.value : 'All Batches';
    
    const displayRecords = extractedRecords.map((record, index) => ({ record, index }))
        .filter(item => filterValue === 'All Batches' || item.record.batch === filterValue);

    if (displayRecords.length === 0) {
        extractedTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="icon-filter" style="font-size: 40px; color: #cbd5e1;"></i>
                        <span>No records match the selected batch.</span>
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    extractedTableBody.innerHTML = '';
    displayRecords.forEach(({record, index}) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-last-name" data-index="${index}" value="${record.lastName}">
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-first-name" data-index="${index}" value="${record.firstName}">
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-middle-name" data-index="${index}" value="${record.middleName}">
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-batch" data-index="${index}" value="${record.batch}" style="width: 100px;">
            </td>
            <td style="padding: 6px 12px; text-align: right;">
                <button class="icon-btn text-danger btn-remove" data-index="${index}" title="Remove" style="background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
                    <i class="icon-trash-2" style="font-size: 16px; color: #ef4444;"></i>
                </button>
            </td>
        `;
        extractedTableBody.appendChild(tr);
    });
    
    // Add event listeners for edits
    document.querySelectorAll('.edit-last-name').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].lastName = e.target.value.trim();
        });
    });

    document.querySelectorAll('.edit-first-name').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].firstName = e.target.value.trim();
        });
    });

    document.querySelectorAll('.edit-middle-name').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].middleName = e.target.value.trim();
        });
    });
    
    document.querySelectorAll('.edit-batch').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].batch = e.target.value.trim();
        });
    });
    
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            extractedRecords.splice(idx, 1);
            renderTable();
            if (extractedRecords.length === 0) btnSaveRecords.classList.add('hidden');
        });
    });
}

// Database Insertion
async function saveRecordsToDatabase() {
    if (extractedRecords.length === 0) return;
    
    const originalText = btnSaveRecords.innerHTML;
    btnSaveRecords.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving automatically...';
    btnSaveRecords.disabled = true;
    
    try {
        const toInsert = extractedRecords.map(r => ({
            last_name: r.lastName,
            first_name: r.firstName,
            middle_name: r.middleName,
            name: `${r.lastName}, ${r.firstName} ${r.middleName}`.trim(),
            batch: r.batch
        }));
        
        // Using global supabaseClient
        const { error } = await window.supabaseClient
            .from('scholar_masterlist')
            .insert(toInsert);
            
        if (error) throw error;
        
        // Show success
        btnSaveRecords.innerHTML = '<i class="icon-check" style="color: white;"></i> Saved to Database';
        btnSaveRecords.classList.remove('btn-gradient-save');
        btnSaveRecords.style.background = '#10b981';
        
    } catch (err) {
        console.error('Error saving masterlist:', err);
        alert(`Failed to save records automatically: ${err.message || 'Check console'}`);
        btnSaveRecords.innerHTML = originalText;
        btnSaveRecords.disabled = false;
    }
}

// Keep the manual button just in case, but change it to call the function
btnSaveRecords.addEventListener('click', saveRecordsToDatabase);

// Fetch existing masterlist records when tab opens
async function fetchExistingMasterlist() {
    try {
        const { data, error } = await window.supabaseClient
            .from('scholar_masterlist')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            extractedRecords = data.map(row => ({
                id: row.id,
                lastName: row.last_name,
                firstName: row.first_name,
                middleName: row.middle_name,
                batch: row.batch
            }));
            populateBatchFilter();
            renderTable();
            
            // Mark as saved if we're just viewing
            btnSaveRecords.classList.remove('hidden');
            btnSaveRecords.innerHTML = '<i class="icon-check" style="color: white;"></i> Saved to Database';
            btnSaveRecords.classList.remove('btn-gradient-save');
            btnSaveRecords.style.background = '#10b981';
            btnSaveRecords.disabled = true;
        }
    } catch (err) {
        console.error('Error fetching existing masterlist:', err);
    }
}

// Load data immediately
fetchExistingMasterlist();
