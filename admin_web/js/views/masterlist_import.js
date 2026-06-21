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
    renderTable();
    btnSaveRecords.classList.add('hidden');
}

// Extraction Logic
btnExtract.addEventListener('click', async () => {
    if (!currentFile) return;
    
    btnExtract.disabled = true;
    ocrProgressContainer.classList.remove('hidden');
    extractedRecords = [];
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
                    let lastY = -1;
                    
                    for (const item of textContent.items) {
                        // Very rough heuristic to detect new lines in PDF based on Y coordinate
                        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                            pageText += '\n';
                        }
                        pageText += item.str + ' ';
                        lastY = item.transform[5];
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
    
    // Simple Heuristic Parser
    for (const line of lines) {
        // Check if line indicates a batch
        if (line.toLowerCase().includes('batch')) {
            const batchMatch = line.match(/batch\s*\d+/i);
            if (batchMatch) {
                currentBatch = batchMatch[0].replace(/\s+/g, ' ');
                currentBatch = currentBatch.charAt(0).toUpperCase() + currentBatch.slice(1);
                continue;
            }
        }
        
        // Exclude common header terms, numbers, or very short lines
        if (line.toLowerCase().includes('name') || line.toLowerCase().includes('student') || line.length < 4) {
            continue;
        }
        
        // Basic cleaning to remove stray numbers or punctuation from the start
        const cleanName = line.replace(/^[\d\.\-\)\s]+/, '').trim();
        
        if (cleanName.length >= 4) {
            records.push({
                name: cleanName,
                batch: currentBatch
            });
        }
    }
    
    extractedRecords = records;
    renderTable();
    
    if (extractedRecords.length > 0) {
        btnSaveRecords.classList.remove('hidden');
    } else {
        btnSaveRecords.classList.add('hidden');
        alert('No names could be clearly extracted. Please ensure the document is clear and contains a list of names.');
    }
}

function renderTable() {
    if (extractedRecords.length === 0) {
        extractedTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-secondary);">No records to display.</td></tr>`;
        return;
    }
    
    extractedTableBody.innerHTML = '';
    extractedRecords.forEach((record, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid var(--border-color);">
                <input type="text" class="edit-name" data-index="${index}" value="${record.name}" style="width: 100%; padding: 6px 8px; border: 1px solid transparent; background: transparent; font-family: inherit;">
            </td>
            <td style="padding: 12px; border-bottom: 1px solid var(--border-color);">
                <input type="text" class="edit-batch" data-index="${index}" value="${record.batch}" style="width: 100px; padding: 6px 8px; border: 1px solid transparent; background: transparent; font-family: inherit;">
            </td>
            <td style="padding: 12px; border-bottom: 1px solid var(--border-color); text-align: right;">
                <button class="icon-btn text-danger btn-remove" data-index="${index}" title="Remove">
                    <i class="icon-trash-2" style="font-size: 16px; color: var(--error, #F44336);"></i>
                </button>
            </td>
        `;
        extractedTableBody.appendChild(tr);
    });
    
    // Add event listeners for edits
    document.querySelectorAll('.edit-name').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].name = e.target.value.trim();
        });
        input.addEventListener('focus', (e) => e.target.style.border = '1px solid var(--border-color)');
        input.addEventListener('blur', (e) => e.target.style.border = '1px solid transparent');
    });
    
    document.querySelectorAll('.edit-batch').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            extractedRecords[idx].batch = e.target.value.trim();
        });
        input.addEventListener('focus', (e) => e.target.style.border = '1px solid var(--border-color)');
        input.addEventListener('blur', (e) => e.target.style.border = '1px solid transparent');
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
btnSaveRecords.addEventListener('click', async () => {
    if (extractedRecords.length === 0) return;
    
    if (!confirm(`Are you sure you want to save ${extractedRecords.length} records to the masterlist database?`)) {
        return;
    }
    
    const originalText = btnSaveRecords.innerHTML;
    btnSaveRecords.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';
    btnSaveRecords.disabled = true;
    
    try {
        const toInsert = extractedRecords.map(r => ({
            name: r.name,
            batch: r.batch
        }));
        
        // Using global supabaseClient
        const { error } = await window.supabaseClient
            .from('scholar_masterlist')
            .insert(toInsert);
            
        if (error) throw error;
        
        // Show success
        alert('Masterlist saved successfully!');
        
        // Clear
        extractedRecords = [];
        renderTable();
        btnSaveRecords.classList.add('hidden');
        btnClearFile.click();
        
    } catch (err) {
        console.error('Error saving masterlist:', err);
        alert(`Failed to save records: ${err.message || 'Check console'}`);
    } finally {
        btnSaveRecords.innerHTML = originalText;
        btnSaveRecords.disabled = false;
    }
});
