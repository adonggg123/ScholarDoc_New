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

// State
let currentImportType = 'qualified'; // 'qualified' | 'non_qualified'
let currentFile = null;
let extractedRecords = [];

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

// Tab Elements
const tabQualified = document.getElementById('tab-qualified');
const tabNonQualified = document.getElementById('tab-non-qualified');
const viewMainTitle = document.getElementById('view-main-title');
const viewMainDesc = document.getElementById('view-main-desc');

// Summary Metrics Elements
const importSummaryCard = document.getElementById('import-summary-card');
const summaryExtracted = document.getElementById('summary-extracted');
const summaryImported = document.getElementById('summary-imported');
const summarySkipped = document.getElementById('summary-skipped');
const summaryErrors = document.getElementById('summary-errors');

// Helper to get active Supabase table name
function getTableName() {
    return currentImportType === 'qualified' ? 'scholar_masterlist' : 'non_qualified_masterlist';
}

// Utility to format file size
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Utility to normalize names for deduplication
function normalizeName(lastName, firstName, middleName) {
    const full = `${lastName || ''} ${firstName || ''} ${middleName || ''}`;
    return full.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Tab Switching Handler
if (tabQualified && tabNonQualified) {
    tabQualified.addEventListener('click', () => switchTab('qualified'));
    tabNonQualified.addEventListener('click', () => switchTab('non_qualified'));
}

function switchTab(type) {
    currentImportType = type;

    if (type === 'qualified') {
        tabQualified.classList.add('active');
        tabQualified.style.background = 'white';
        tabQualified.style.color = 'var(--primary-color)';
        tabQualified.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';

        tabNonQualified.classList.remove('active');
        tabNonQualified.style.background = 'transparent';
        tabNonQualified.style.color = '#64748b';
        tabNonQualified.style.boxShadow = 'none';

        if (viewMainTitle) viewMainTitle.textContent = 'Scholar Masterlist Import';
        if (viewMainDesc) viewMainDesc.textContent = 'Upload masterlist document (PDF or DOCX) to automatically extract and register qualified scholar records.';
    } else {
        tabNonQualified.classList.add('active');
        tabNonQualified.style.background = 'white';
        tabNonQualified.style.color = '#ef4444';
        tabNonQualified.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';

        tabQualified.classList.remove('active');
        tabQualified.style.background = 'transparent';
        tabQualified.style.color = '#64748b';
        tabQualified.style.boxShadow = 'none';

        if (viewMainTitle) viewMainTitle.textContent = 'Non-Qualified Students Import';
        if (viewMainDesc) viewMainDesc.textContent = 'Upload non-qualified document (PDF or DOCX) to extract and register non-qualified student records.';
    }

    // Reset current file and state
    clearFileState();
    fetchExistingMasterlist();
}

function clearFileState() {
    currentFile = null;
    if (fileInput) fileInput.value = '';
    if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
    if (dropZone) dropZone.classList.remove('hidden');
    if (btnExtract) btnExtract.disabled = true;
    if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
    if (importSummaryCard) importSummaryCard.classList.add('hidden');

    extractedRecords = [];
    populateBatchFilter();
    renderTable();
    if (btnSaveRecords) btnSaveRecords.classList.add('hidden');
}

// Drag and Drop Events
if (dropZone) {
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
        if (fileInput) fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

if (btnClearFile) {
    btnClearFile.addEventListener('click', clearFileState);
}

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
    if (importSummaryCard) importSummaryCard.classList.add('hidden');
    populateBatchFilter();
    renderTable();
    btnSaveRecords.classList.add('hidden');
}

// Extraction Logic
if (btnExtract) {
    btnExtract.addEventListener('click', async () => {
        if (!currentFile) return;
        
        btnExtract.disabled = true;
        ocrProgressContainer.classList.remove('hidden');
        extractedRecords = [];
        if (importSummaryCard) importSummaryCard.classList.add('hidden');
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
            
            await parseDocumentText(extractedText);
            
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
}

async function extractPdfText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!window.pdfjsLib) {
                    window.pdfjsLib = window['pdfjs-dist/build/pdf'];
                }
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

async function parseDocumentText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentBatch = 'Batch 1'; // Default
    const rawRecords = [];
    let tempNameParts = [];

    // Heuristic Document Line Parser
    for (const line of lines) {
        if (line.toLowerCase().includes('batch')) {
            const batchMatch = line.match(/batch\s*\d+/i);
            if (batchMatch) {
                currentBatch = batchMatch[0].replace(/\s+/g, ' ');
                currentBatch = currentBatch.charAt(0).toUpperCase() + currentBatch.slice(1);
                tempNameParts = [];
                continue;
            }
        }
        
        const lLine = line.toLowerCase();
        if (lLine === 'name' || lLine === 'student' || lLine.includes('last name') || lLine.includes('first name') || lLine.includes('middle name') || lLine === 'no.' || lLine === 'no' || line.length < 2) {
            continue;
        }
        
        const cleanLine = line.replace(/^[\d\.\-\)\s]+/, '').trim();
        if (cleanLine.length < 2) continue;
        
        if (cleanLine.includes(',')) {
            const parts = cleanLine.split(',').map(p => p.trim());
            rawRecords.push({
                lastName: parts[0] || '',
                firstName: parts[1] || '',
                middleName: parts[2] || '',
                batch: currentBatch
            });
            tempNameParts = [];
        } else {
            tempNameParts.push(cleanLine);
            if (tempNameParts.length === 3) {
                rawRecords.push({
                    lastName: tempNameParts[0],
                    firstName: tempNameParts[1],
                    middleName: tempNameParts[2],
                    batch: currentBatch
                });
                tempNameParts = [];
            }
        }
    }
    
    if (tempNameParts.length > 0) {
        rawRecords.push({
            lastName: tempNameParts[0] || '',
            firstName: tempNameParts[1] || '',
            middleName: tempNameParts[2] || '',
            batch: currentBatch
        });
    }

    if (rawRecords.length === 0) {
        alert('No student names could be clearly extracted from this document.');
        return;
    }

    // Perform Deduplication Check against database & internal records
    await checkAndFlagDuplicates(rawRecords);
}

// Deduplication and Summary Statistics Calculator
async function checkAndFlagDuplicates(records) {
    let existingDbNames = new Set();
    
    try {
        const { data, error } = await window.supabaseClient
            .from(getTableName())
            .select('last_name, first_name, middle_name, name');

        if (!error && data) {
            data.forEach(row => {
                const norm = normalizeName(row.last_name, row.first_name, row.middle_name || '');
                if (norm) existingDbNames.add(norm);
                if (row.name) existingDbNames.add(row.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
            });
        }
    } catch (e) {
        console.warn(`Could not query ${getTableName()} for duplicate check:`, e);
    }

    const seenInFile = new Set();
    let skippedCount = 0;
    let importedCount = 0;

    extractedRecords = records.map(r => {
        const normKey = normalizeName(r.lastName, r.firstName, r.middleName);
        let isDuplicate = false;
        let duplicateReason = '';

        if (!normKey) {
            isDuplicate = true;
            duplicateReason = 'Empty name';
        } else if (existingDbNames.has(normKey)) {
            isDuplicate = true;
            duplicateReason = 'Already exists in database';
        } else if (seenInFile.has(normKey)) {
            isDuplicate = true;
            duplicateReason = 'Duplicate in document';
        } else {
            seenInFile.add(normKey);
        }

        if (isDuplicate) {
            skippedCount++;
        } else {
            importedCount++;
        }

        return {
            ...r,
            isDuplicate,
            duplicateReason
        };
    });

    // Update Import Summary Metrics Card
    if (summaryExtracted) summaryExtracted.textContent = extractedRecords.length;
    if (summaryImported) summaryImported.textContent = importedCount;
    if (summarySkipped) summarySkipped.textContent = skippedCount;
    if (summaryErrors) summaryErrors.textContent = 0;
    if (importSummaryCard) importSummaryCard.classList.remove('hidden');

    populateBatchFilter();
    renderTable();

    if (extractedRecords.length > 0) {
        btnSaveRecords.classList.remove('hidden');
        btnSaveRecords.disabled = importedCount === 0;
        btnSaveRecords.innerHTML = `<i class="icon-save" style="font-size: 16px;"></i> Save (${importedCount} New Records)`;
        btnSaveRecords.classList.add('btn-gradient-save');
        btnSaveRecords.style.background = '';
    } else {
        btnSaveRecords.classList.add('hidden');
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
                <td colspan="6" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
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
                <td colspan="6" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
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
        if (record.isDuplicate) {
            tr.style.background = 'rgba(254, 243, 199, 0.3)';
        }

        const statusBadge = record.isDuplicate
            ? `<span title="${record.duplicateReason}" style="background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="icon-alert-triangle" style="font-size: 12px;"></i> Duplicate (Skipped)</span>`
            : `<span style="background: rgba(16, 185, 129, 0.15); color: #059669; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="icon-check-circle-2" style="font-size: 12px;"></i> New</span>`;

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
            <td style="padding: 6px 12px; font-size: 12px;">
                ${statusBadge}
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
            
            // Recalculate summary metrics
            const skipped = extractedRecords.filter(r => r.isDuplicate).length;
            const imported = extractedRecords.filter(r => !r.isDuplicate).length;
            if (summaryExtracted) summaryExtracted.textContent = extractedRecords.length;
            if (summaryImported) summaryImported.textContent = imported;
            if (summarySkipped) summarySkipped.textContent = skipped;

            renderTable();
            if (extractedRecords.length === 0) {
                btnSaveRecords.classList.add('hidden');
                if (importSummaryCard) importSummaryCard.classList.add('hidden');
            }
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

// Database Insertion
async function saveRecordsToDatabase() {
    const validToInsert = extractedRecords.filter(r => !r.isDuplicate);

    if (validToInsert.length === 0) {
        alert('No new unique records to save. All extracted records are marked as duplicates or already exist in the database.');
        return;
    }
    
    const originalText = btnSaveRecords.innerHTML;
    btnSaveRecords.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';
    btnSaveRecords.disabled = true;
    
    try {
        const tableName = getTableName();
        const toInsert = validToInsert.map(r => {
            const item = {
                last_name: r.lastName,
                first_name: r.firstName,
                middle_name: r.middleName,
                name: `${r.lastName}, ${r.firstName} ${r.middleName}`.trim(),
                batch: r.batch
            };
            if (currentImportType === 'non_qualified') {
                item.reason = 'Non-Qualified';
            }
            return item;
        });
        
        const { error } = await window.supabaseClient
            .from(tableName)
            .insert(toInsert);
            
        if (error) {
            if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                throw new Error(`Table '${tableName}' does not exist in Supabase database yet. Please run scratch/sql_setup.sql in your Supabase SQL editor.`);
            }
            throw error;
        }
        
        // Show success state
        btnSaveRecords.innerHTML = `<i class="icon-check" style="color: white;"></i> Saved ${validToInsert.length} Records to Database`;
        btnSaveRecords.classList.remove('btn-gradient-save');
        btnSaveRecords.style.background = '#10b981';
        
        // Update records state to show all as saved in DB
        fetchExistingMasterlist();

    } catch (err) {
        console.error('Error saving masterlist:', err);
        alert(`Failed to save records: ${err.message || 'Check console'}`);
        btnSaveRecords.innerHTML = originalText;
        btnSaveRecords.disabled = false;
    }
}

// Save records button listener
if (btnSaveRecords) {
    btnSaveRecords.addEventListener('click', saveRecordsToDatabase);
}

// Fetch existing records when viewing a tab
async function fetchExistingMasterlist() {
    try {
        const tableName = getTableName();
        const { data, error } = await window.supabaseClient
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                console.warn(`Table '${tableName}' not created yet.`);
                extractedRecords = [];
                renderTable();
                return;
            }
            throw error;
        }
        
        if (data && data.length > 0) {
            extractedRecords = data.map(row => ({
                id: row.id,
                lastName: row.last_name,
                firstName: row.first_name,
                middleName: row.middle_name,
                batch: row.batch,
                isDuplicate: false
            }));

            // Hide import summary card when viewing existing saved records
            if (importSummaryCard) importSummaryCard.classList.add('hidden');

            populateBatchFilter();
            renderTable();
            
            btnSaveRecords.classList.remove('hidden');
            btnSaveRecords.innerHTML = '<i class="icon-check" style="color: white;"></i> Saved to Database';
            btnSaveRecords.classList.remove('btn-gradient-save');
            btnSaveRecords.style.background = '#10b981';
            btnSaveRecords.disabled = true;
        } else {
            extractedRecords = [];
            if (importSummaryCard) importSummaryCard.classList.add('hidden');
            renderTable();
            if (btnSaveRecords) btnSaveRecords.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error fetching existing masterlist:', err);
    }
}

// Initialize on page load
fetchExistingMasterlist();
