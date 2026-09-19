// js/views/masterlist_import.js
import { BillingService } from '../services/billing_service.js';
import { VerificationService } from '../services/verification_service.js';
import { AnnexSyncService } from '../services/annex_sync_service.js';

// Dynamically load document parsing libraries if needed
if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    document.head.appendChild(script);
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
let currentFile = null;
let extractedRecords = [];
let schoolStudents = [];

let verifiedForm2List = [];
let verifiedForm3List = [];
let needsReviewList = [];

// Elements
let dropZone = null;
let fileInput = null;
let fileInfoContainer = null;
let fileNameDisplay = null;
let fileSizeDisplay = null;
let btnClearFile = null;
let btnExtract = null;
let ocrProgressContainer = null;
let ocrStatusText = null;
let ocrProgressBar = null;
let extractedTableBody = null;
let btnSaveRecords = null;
let filterBatch = null;
let btnClearMasterlist = null;

// Summary Metrics Elements
let importSummaryCard = null;
let summaryExtracted = null;
let summaryImported = null;
let summarySkipped = null;
let summaryErrors = null;

// Annex Tabs Elements
let saTabBtn2 = null;
let saTabBtn3 = null;
let saTabBtnRev = null;
let saTabPane2 = null;
let saTabPane3 = null;
let saTabPaneRev = null;

let btnExportF2 = null;
let btnExportF3 = null;
let saSearchF2 = null;
let saSearchF3 = null;
let btnAutoResolveAll = null;

function getTableName() {
    return 'new_grantees_masterlist';
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function normalizeName(lastName, firstName, middleName) {
    const full = `${lastName || ''} ${firstName || ''} ${middleName || ''}`;
    return full.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function clearFileState() {
    currentFile = null;
    if (fileInput) fileInput.value = '';
    if (fileInfoContainer) fileInfoContainer.classList.add('hidden');
    if (dropZone) dropZone.classList.remove('hidden');
    if (btnExtract) btnExtract.disabled = true;
    if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
    if (importSummaryCard) importSummaryCard.classList.add('hidden');

    fetchExistingMasterlist();
}

async function handleFile(file) {
    const validExtensions = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'csv'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
        alert('Please upload a valid masterlist file (PDF, DOCX, XLSX, CSV).');
        return;
    }

    currentFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = formatBytes(file.size);

    if (dropZone) dropZone.classList.add('hidden');
    if (fileInfoContainer) fileInfoContainer.classList.remove('hidden');

    // Expected Flow: Upload File -> Automatically Extract Data -> Display in Table -> Automatically Save to Database
    await executeAutoImportPipeline(file);
}

async function extractExcelOrCsv(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const rawRecords = [];
                let currentBatch = 'Batch 1';

                for (let r = 0; r < jsonData.length; r++) {
                    const row = jsonData[r];
                    if (!row || row.length === 0) continue;

                    const rowStr = row.join(' ').toLowerCase();
                    if (rowStr.includes('batch')) {
                        const match = rowStr.match(/batch\s*(\d+|[a-z0-9]+)/i);
                        if (match) currentBatch = `Batch ${match[1]}`;
                    }

                    if (rowStr.includes('last name') || rowStr.includes('student name') || rowStr.includes('control no') || rowStr.includes('given name')) {
                        continue;
                    }

                    const cleanCells = row.map(c => String(c || '').trim()).filter(c => c.length > 0);
                    if (cleanCells.length === 0) continue;

                    let cellIdx = 0;
                    if (/^\d+$/.test(cleanCells[0]) && cleanCells.length > 1) {
                        cellIdx = 1;
                    }

                    let studentId = '';
                    if (cleanCells[cellIdx] && (/^\d{6,15}$/.test(cleanCells[cellIdx]) || /^[0-9-]+$/.test(cleanCells[cellIdx]))) {
                        studentId = cleanCells[cellIdx];
                        cellIdx++;
                    }

                    let lastName = '';
                    let firstName = '';
                    let middleName = '';
                    let course = 'BSIT';

                    if (cleanCells.length >= cellIdx + 3) {
                        lastName = cleanCells[cellIdx];
                        firstName = cleanCells[cellIdx + 1];
                        middleName = cleanCells[cellIdx + 2];
                        if (cleanCells[cellIdx + 3]) course = cleanCells[cellIdx + 3];
                    } else if (cleanCells.length >= cellIdx + 2) {
                        lastName = cleanCells[cellIdx];
                        firstName = cleanCells[cellIdx + 1];
                    } else if (cleanCells[cellIdx]) {
                        const parts = cleanCells[cellIdx].split(/[,\s]+/);
                        if (parts.length >= 2) {
                            lastName = parts[0];
                            firstName = parts.slice(1).join(' ');
                        } else {
                            lastName = parts[0];
                        }
                    }

                    if (lastName && firstName) {
                        rawRecords.push({
                            lastName: lastName.toUpperCase(),
                            firstName: firstName.toUpperCase(),
                            middleName: (middleName || '').toUpperCase(),
                            batch: currentBatch,
                            studentId: studentId,
                            course: course
                        });
                    }
                }

                resolve(rawRecords);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
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
    let currentBatch = 'Batch 1';
    const rawRecords = [];
    let tempNameParts = [];

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
                batch: currentBatch,
                studentId: '',
                course: 'BSIT'
            });
            tempNameParts = [];
        } else {
            tempNameParts.push(cleanLine);
            if (tempNameParts.length === 3) {
                rawRecords.push({
                    lastName: tempNameParts[0],
                    firstName: tempNameParts[1],
                    middleName: tempNameParts[2],
                    batch: currentBatch,
                    studentId: '',
                    course: 'BSIT'
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
            batch: currentBatch,
            studentId: '',
            course: 'BSIT'
        });
    }

    if (rawRecords.length === 0) {
        alert('No grantee names could be clearly extracted from this document.');
        return [];
    }

    return rawRecords;
}

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
        console.warn('Could not query masterlist for duplicate check:', e);
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
            duplicateReason = 'Already in masterlist';
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

    if (summaryExtracted) summaryExtracted.textContent = extractedRecords.length;
    if (summaryImported) summaryImported.textContent = importedCount;
    if (summarySkipped) summarySkipped.textContent = skippedCount;
    if (summaryErrors) summaryErrors.textContent = 0;
    if (importSummaryCard) importSummaryCard.classList.remove('hidden');

    populateBatchFilter();
    renderTable();

    return { skippedCount, importedCount };
}

// ── Fully Automatic Pipeline: Extract -> Display in Table -> Save to Database ──
async function executeAutoImportPipeline(file) {
    if (!file) return;

    if (btnExtract) {
        btnExtract.disabled = true;
        btnExtract.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Auto-Extracting...';
    }
    if (ocrProgressContainer) ocrProgressContainer.classList.remove('hidden');
    if (ocrStatusText) ocrStatusText.textContent = 'Extracting grantee data from file...';
    if (ocrProgressBar) {
        ocrProgressBar.style.width = '35%';
        ocrProgressBar.style.animation = 'pulse 1.5s infinite';
    }

    extractedRecords = [];
    if (importSummaryCard) importSummaryCard.classList.add('hidden');
    populateBatchFilter();
    renderTable();

    try {
        const ext = file.name.split('.').pop().toLowerCase();
        let rawRecords = [];

        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            rawRecords = await extractExcelOrCsv(file);
        } else if (ext === 'pdf') {
            const text = await extractPdfText(file);
            rawRecords = await parseDocumentText(text);
        } else if (ext === 'docx' || ext === 'doc') {
            const text = await extractDocxText(file);
            rawRecords = await parseDocumentText(text);
        }

        if (!rawRecords || rawRecords.length === 0) {
            alert('No grantee records could be clearly extracted from this file.');
            if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
            if (btnExtract) {
                btnExtract.disabled = false;
                btnExtract.innerHTML = '<i class="icon-settings"></i> Extract Grantees Data';
            }
            return;
        }

        // Step 2: Validate & Flag duplicates, immediately display in table
        if (ocrStatusText) ocrStatusText.textContent = 'Validating records & checking duplicates...';
        if (ocrProgressBar) ocrProgressBar.style.width = '65%';

        const { skippedCount, importedCount } = await checkAndFlagDuplicates(rawRecords);

        // Step 3: Automatically Save unique records to database
        const validToInsert = extractedRecords.filter(r => !r.isDuplicate);

        if (validToInsert.length > 0) {
            if (ocrStatusText) ocrStatusText.textContent = `Auto-saving ${validToInsert.length} new grantees to database...`;
            if (ocrProgressBar) ocrProgressBar.style.width = '85%';

            const tableName = getTableName();
            const toInsert = validToInsert.map(r => ({
                last_name: r.lastName,
                first_name: r.firstName,
                middle_name: r.middleName || '',
                name: `${r.lastName}, ${r.firstName} ${r.middleName || ''}`.trim(),
                course: r.course || 'BSIT',
                batch: r.batch || 'Batch 1'
            }));

            const { data: insertedData, error } = await window.supabaseClient
                .from(tableName)
                .insert(toInsert)
                .select();

            if (error) {
                throw error;
            }

            // Link returned Supabase database IDs back to in-memory records
            if (insertedData && insertedData.length > 0) {
                let insIdx = 0;
                extractedRecords.forEach(r => {
                    if (!r.isDuplicate && insIdx < insertedData.length) {
                        r.id = insertedData[insIdx].id;
                        insIdx++;
                    }
                });
            }

            if (ocrStatusText) ocrStatusText.textContent = `Complete: Auto-saved ${validToInsert.length} new grantees to database!`;
            if (ocrProgressBar) ocrProgressBar.style.width = '100%';

            if (window.showToast) {
                window.showToast(`Auto-saved ${validToInsert.length} new grantees to database!${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}`, 'check-circle');
            }

            // Re-render table to display updated "Saved to DB" status
            renderTable();

            // Sync with Annex 5 and verification
            const { data: allCurrentGrantees } = await window.supabaseClient
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (allCurrentGrantees && allCurrentGrantees.length > 0) {
                const granteesForVerification = allCurrentGrantees.map(m => ({
                    id: m.id,
                    name: m.name || `${m.last_name || ''}, ${m.first_name || ''} ${m.middle_name || ''}`.trim(),
                    last_name: m.last_name,
                    first_name: m.first_name,
                    middle_name: m.middle_name,
                    batch: m.batch || 'Batch 1',
                    student_id: m.student_id || '',
                    course: m.course || 'BSIT',
                    year: m.year || '1'
                }));
                await loadSchoolStudentsAndVerify(granteesForVerification);
            }

        } else {
            // All records were duplicates
            if (ocrStatusText) ocrStatusText.textContent = `All ${extractedRecords.length} records already exist in database (no duplicates added).`;
            if (ocrProgressBar) ocrProgressBar.style.width = '100%';

            if (window.showToast) {
                window.showToast(`All ${extractedRecords.length} records are already registered in the database. No duplicates added.`, 'info');
            }
        }

        if (btnExtract) {
            btnExtract.disabled = true;
            btnExtract.innerHTML = '<i class="icon-check" style="font-size: 16px;"></i> File Processed Automatically';
        }

    } catch (err) {
        console.error('Auto-import pipeline error:', err);
        alert(`Auto-import error: ${err.message || 'Check console'}`);
        if (summaryErrors) summaryErrors.textContent = 1;
        if (ocrStatusText) ocrStatusText.textContent = `Error: ${err.message}`;
        if (btnExtract) {
            btnExtract.disabled = false;
            btnExtract.innerHTML = '<i class="icon-refresh-cw" style="font-size: 16px;"></i> Retry Import';
        }
    } finally {
        setTimeout(() => {
            if (ocrProgressContainer) ocrProgressContainer.classList.add('hidden');
        }, 3000);
        if (window.lucide) window.lucide.createIcons();
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

function updateClearMasterlistButtonVisibility() {
    if (btnClearMasterlist) {
        if (extractedRecords && extractedRecords.length > 0) {
            btnClearMasterlist.classList.remove('hidden');
            btnClearMasterlist.style.display = 'inline-flex';
        } else {
            btnClearMasterlist.classList.add('hidden');
            btnClearMasterlist.style.display = 'none';
        }
    }
}

function renderTable() {
    if (!extractedTableBody) return;
    updateClearMasterlistButtonVisibility();

    if (extractedRecords.length === 0) {
        extractedTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="icon-file-search" style="font-size: 40px; color: #cbd5e1;"></i>
                        <span>Upload a document and extract data to see new grantees listed here.</span>
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
                <td colspan="7" style="text-align: center; padding: 64px 20px; color: #94a3b8; font-weight: 500;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="icon-filter" style="font-size: 40px; color: #cbd5e1;"></i>
                        <span>No records match the selected batch.</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    extractedTableBody.innerHTML = '';
    displayRecords.forEach(({ record, index }) => {
        const tr = document.createElement('tr');
        if (record.isDuplicate) {
            tr.style.background = 'rgba(254, 243, 199, 0.3)';
        }

        const statusBadge = record.isDuplicate
            ? `<span title="${record.duplicateReason}" style="background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="icon-alert-triangle" style="font-size: 12px;"></i> Duplicate</span>`
            : `<span style="background: rgba(16, 185, 129, 0.15); color: #059669; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="icon-check-circle-2" style="font-size: 12px;"></i> Saved to DB</span>`;

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
                <input type="text" class="input-clean edit-course" data-index="${index}" value="${record.course || 'BSIT'}" style="width: 90px;">
            </td>
            <td style="padding: 6px 12px;">
                <input type="text" class="input-clean edit-batch" data-index="${index}" value="${record.batch}" style="width: 90px;">
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

    // Listeners for inline edits
    document.querySelectorAll('.edit-last-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            extractedRecords[idx].lastName = val;
            if (extractedRecords[idx].id) {
                try {
                    await window.supabaseClient.from(getTableName()).update({
                        last_name: val,
                        name: `${val}, ${extractedRecords[idx].firstName || ''} ${extractedRecords[idx].middleName || ''}`.trim()
                    }).eq('id', extractedRecords[idx].id);
                } catch (err) {
                    console.warn('Error updating last name:', err);
                }
            }
        });
    });

    document.querySelectorAll('.edit-first-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            extractedRecords[idx].firstName = val;
            if (extractedRecords[idx].id) {
                try {
                    await window.supabaseClient.from(getTableName()).update({
                        first_name: val,
                        name: `${extractedRecords[idx].lastName || ''}, ${val} ${extractedRecords[idx].middleName || ''}`.trim()
                    }).eq('id', extractedRecords[idx].id);
                } catch (err) {
                    console.warn('Error updating first name:', err);
                }
            }
        });
    });

    document.querySelectorAll('.edit-middle-name').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            extractedRecords[idx].middleName = val;
            if (extractedRecords[idx].id) {
                try {
                    await window.supabaseClient.from(getTableName()).update({
                        middle_name: val,
                        name: `${extractedRecords[idx].lastName || ''}, ${extractedRecords[idx].firstName || ''} ${val}`.trim()
                    }).eq('id', extractedRecords[idx].id);
                } catch (err) {
                    console.warn('Error updating middle name:', err);
                }
            }
        });
    });

    document.querySelectorAll('.edit-course').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            extractedRecords[idx].course = val;
            if (extractedRecords[idx].id) {
                try {
                    await window.supabaseClient.from(getTableName()).update({
                        course: val
                    }).eq('id', extractedRecords[idx].id);
                } catch (err) {
                    console.warn('Error updating course:', err);
                }
            }
        });
    });

    document.querySelectorAll('.edit-batch').forEach(input => {
        input.addEventListener('change', async (e) => {
            const idx = e.target.getAttribute('data-index');
            const val = e.target.value.trim();
            extractedRecords[idx].batch = val;
            if (extractedRecords[idx].id) {
                try {
                    await window.supabaseClient.from(getTableName()).update({
                        batch: val
                    }).eq('id', extractedRecords[idx].id);
                } catch (err) {
                    console.warn('Error updating batch:', err);
                }
            }
        });
    });

    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const idx = parseInt(btnEl.getAttribute('data-index'), 10);
            const rec = extractedRecords[idx];
            if (!rec) return;

            const granteeName = (rec.lastName || rec.firstName)
                ? `${rec.lastName || ''}, ${rec.firstName || ''} ${rec.middleName || ''}`.trim()
                : (rec.name || 'this grantee');

            if (!confirm(`Are you sure you want to delete "${granteeName}" from the New Grantees Masterlist?`)) {
                return;
            }

            const origContent = btnEl.innerHTML;
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="icon-loader" style="font-size: 14px; animation: spin 1s linear infinite; display: inline-block;"></i>';

            try {
                if (rec && rec.id) {
                    const { data, error } = await window.supabaseClient
                        .from(getTableName())
                        .delete()
                        .eq('id', rec.id)
                        .select();

                    if (error) {
                        console.error('Error deleting record from db:', error);
                        alert(`Failed to delete record from database: ${error.message}`);
                        btnEl.disabled = false;
                        btnEl.innerHTML = origContent;
                        return;
                    }

                    // Check if RLS blocked the delete (0 rows deleted despite record having an id in DB)
                    if (data && data.length === 0) {
                        console.warn('PostgREST returned 0 affected rows on delete:', rec.id);
                        alert(
                            'Notice: The record was removed locally, but could not be deleted from Supabase because Row Level Security (RLS) is active without a DELETE policy on new_grantees_masterlist.\n\n' +
                            'Please run the "scratch/fix_new_grantees_rls.sql" script in your Supabase SQL Editor to grant DELETE permissions.'
                        );
                    }
                }

                // Remove from array (find by id if present, or index)
                const targetIndex = rec.id 
                    ? extractedRecords.findIndex(r => r.id === rec.id)
                    : idx;
                if (targetIndex !== -1) {
                    extractedRecords.splice(targetIndex, 1);
                }

                const skipped = extractedRecords.filter(r => r.isDuplicate).length;
                const imported = extractedRecords.filter(r => !r.isDuplicate).length;
                if (summaryExtracted) summaryExtracted.textContent = extractedRecords.length;
                if (summaryImported) summaryImported.textContent = imported;
                if (summarySkipped) summarySkipped.textContent = skipped;

                renderTable();
                if (extractedRecords.length === 0) {
                    if (btnSaveRecords) btnSaveRecords.classList.add('hidden');
                    if (importSummaryCard) importSummaryCard.classList.add('hidden');
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(`"${granteeName}" deleted from masterlist.`, 'trash-2');
                }
            } catch (delErr) {
                console.error('Error deleting record from db:', delErr);
                alert(`Error deleting record: ${delErr.message || delErr}`);
                btnEl.disabled = false;
                btnEl.innerHTML = origContent;
            }
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

async function saveRecordsToDatabase() {
    const validToInsert = extractedRecords.filter(r => !r.isDuplicate);

    if (validToInsert.length === 0) {
        alert('No new unique grantee records to save.');
        return;
    }

    const originalText = btnSaveRecords ? btnSaveRecords.innerHTML : '';
    if (btnSaveRecords) {
        btnSaveRecords.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Saving...';
        btnSaveRecords.disabled = true;
    }

    try {
        const tableName = getTableName();
        const toInsert = validToInsert.map(r => ({
            last_name: r.lastName,
            first_name: r.firstName,
            middle_name: r.middleName,
            name: `${r.lastName}, ${r.firstName} ${r.middleName}`.trim(),
            course: r.course || 'BSIT',
            batch: r.batch
        }));

        const { error } = await window.supabaseClient
            .from(tableName)
            .insert(toInsert);

        if (error) throw error;

        if (btnSaveRecords) {
            btnSaveRecords.innerHTML = `<i class="icon-check" style="color: white;"></i> Saved ${validToInsert.length} Grantees to Masterlist`;
            btnSaveRecords.classList.remove('btn-gradient-save');
            btnSaveRecords.style.background = '#10b981';
        }

        await fetchExistingMasterlist();

    } catch (err) {
        console.error('Error saving masterlist:', err);
        alert(`Failed to save records: ${err.message || 'Check console'}`);
        if (btnSaveRecords) {
            btnSaveRecords.innerHTML = originalText;
            btnSaveRecords.disabled = false;
        }
    }
}

async function loadSchoolStudentsAndVerify(grantees) {
    try {
        let { data: dbStudents } = await window.supabaseClient.from('school_students').select('*');
        if (!dbStudents || dbStudents.length === 0) {
            const res = await window.supabaseClient.from('students').select('*');
            dbStudents = res.data;
        }
        schoolStudents = dbStudents || [];

        // 1. Check if Admin has already verified and categorized records in Review Queue
        const savedSync = AnnexSyncService.getVerifiedData();
        if (savedSync && (savedSync.form2List.length > 0 || savedSync.form3List.length > 0 || savedSync.needsReviewList.length > 0)) {
            if (grantees && grantees.length > 0) {
                const resolvedForm2Map = new Map(savedSync.form2List.map(item => [AnnexSyncService.getUniqueKey(item), item]));
                const resolvedForm3Map = new Map(savedSync.form3List.map(item => [AnnexSyncService.getUniqueKey(item), item]));

                const batchResult = VerificationService.runBatchVerification(grantees, schoolStudents);
                const allItems = [...batchResult.form2List, ...batchResult.form3List, ...batchResult.needsReviewList];

                const combinedForm2 = [];
                const combinedForm3 = [];
                const remainingReview = [];
                const processedKeys = new Set();

                for (const item of allItems) {
                    const key = AnnexSyncService.getUniqueKey(item);
                    if (processedKeys.has(key)) continue;
                    processedKeys.add(key);

                    if (resolvedForm2Map.has(key)) {
                        const saved = resolvedForm2Map.get(key);
                        combinedForm2.push({ ...item, ...saved, classification: 'MATCHED_FORM2', isEnrolled: true });
                    } else if (resolvedForm3Map.has(key)) {
                        const saved = resolvedForm3Map.get(key);
                        combinedForm3.push({ ...item, ...saved, classification: 'INACTIVE_FORM3', isEnrolled: false });
                    } else if (item.classification === 'MATCHED_FORM2') {
                        combinedForm2.push(item);
                    } else if (item.classification === 'INACTIVE_FORM3') {
                        combinedForm3.push(item);
                    } else {
                        remainingReview.push(item);
                    }
                }

                // Preserve any verified records from savedSync
                for (const item of savedSync.form2List) {
                    const key = AnnexSyncService.getUniqueKey(item);
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        combinedForm2.push(item);
                    }
                }
                for (const item of savedSync.form3List) {
                    const key = AnnexSyncService.getUniqueKey(item);
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        combinedForm3.push(item);
                    }
                }
                for (const item of savedSync.needsReviewList) {
                    const key = AnnexSyncService.getUniqueKey(item);
                    if (!processedKeys.has(key)) {
                        processedKeys.add(key);
                        remainingReview.push(item);
                    }
                }

                const deduped = AnnexSyncService.deduplicateLists(combinedForm2, combinedForm3, remainingReview);
                verifiedForm2List = deduped.form2List;
                verifiedForm3List = deduped.form3List;
                needsReviewList = deduped.needsReviewList;
            } else {
                verifiedForm2List = savedSync.form2List;
                verifiedForm3List = savedSync.form3List;
                needsReviewList = savedSync.needsReviewList;
            }
        } else {
            const result = VerificationService.runBatchVerification(grantees || [], schoolStudents);
            const deduped = AnnexSyncService.deduplicateLists(result.form2List, result.form3List, result.needsReviewList);
            verifiedForm2List = deduped.form2List;
            verifiedForm3List = deduped.form3List;
            needsReviewList = deduped.needsReviewList;

            AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: needsReviewList,
                updatedBy: 'Super Admin (Initial Verification)'
            });
        }

        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
        renderAnnexForm3Table(verifiedForm3List);
        renderAnnexReviewQueue(needsReviewList);

        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            syncBadge.style.display = 'inline-flex';
        }

    } catch (err) {
        console.warn('Error verifying Annex 5 tables in masterlist_import:', err);
    }
}

let activeSAResolutionItem = null;

function openSuperAdminResolutionModal(reviewIndex) {
    activeSAResolutionItem = reviewIndex;
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    const modal = document.getElementById('sa-resolution-modal');
    const nameEl = document.getElementById('sa-modal-grantee-name');
    const targetForm = document.getElementById('sa-modal-target-form');
    const reasonGroup = document.getElementById('sa-modal-form3-reason-group');
    const reasonSel = document.getElementById('sa-modal-form3-reason');
    const remarksInput = document.getElementById('sa-modal-remarks');

    if (nameEl) nameEl.textContent = item.grantee?.name || 'Scholar Grantee';
    if (targetForm) targetForm.value = 'form3';
    if (reasonGroup) reasonGroup.style.display = 'block';
    if (reasonSel) reasonSel.value = item.specialStatusReason || 'Not enrolled';
    if (remarksInput) remarksInput.value = '';

    if (modal) modal.style.display = 'flex';
}

function closeSuperAdminResolutionModal() {
    activeSAResolutionItem = null;
    const modal = document.getElementById('sa-resolution-modal');
    if (modal) modal.style.display = 'none';
}

function resolveSuperAdminReviewItem(reviewIndex, targetForm, specialReason = 'Not enrolled', remarks = '') {
    const item = needsReviewList[reviewIndex];
    if (!item) return;

    needsReviewList.splice(reviewIndex, 1);

    if (targetForm === 'form2') {
        item.classification = 'MATCHED_FORM2';
        item.isEnrolled = true;
        if (!item.matchedStudent) {
            item.matchedStudent = {
                fullName: item.grantee?.name || '',
                studentId: item.grantee?.student_id || '',
                course: item.grantee?.course || 'BSIT',
                year: item.grantee?.year || '1',
                status: 'Enrolled'
            };
        } else {
            item.matchedStudent.status = 'Enrolled';
        }
        verifiedForm2List.push(item);
        if (window.showToast) window.showToast(`Approved ${item.grantee?.name || 'Grantee'} to Form 2 (Enrolled)`, 'check-circle');
    } else {
        item.classification = 'INACTIVE_FORM3';
        item.isEnrolled = false;
        item.specialStatusReason = specialReason;
        item.remarks = remarks || `Categorized: ${specialReason}`;
        if (!item.matchedStudent) {
            item.matchedStudent = {
                fullName: item.grantee?.name || '',
                studentId: item.grantee?.student_id || '',
                course: item.grantee?.course || 'BSIT',
                year: item.grantee?.year || '1',
                status: specialReason
            };
        } else {
            item.matchedStudent.status = specialReason;
        }
        verifiedForm3List.push(item);
        if (window.showToast) window.showToast(`Categorized ${item.grantee?.name || 'Grantee'} to Form 3 (${specialReason})`, 'tag');
    }

    const synced = AnnexSyncService.saveVerifiedData({
        form2List: verifiedForm2List,
        form3List: verifiedForm3List,
        needsReviewList: needsReviewList,
        updatedBy: 'Super Admin'
    });
    if (synced) {
        verifiedForm2List = synced.form2List;
        verifiedForm3List = synced.form3List;
        needsReviewList = synced.needsReviewList;
    }

    try {
        const granteeName = item.grantee?.name || `${item.grantee?.last_name || ''}, ${item.grantee?.first_name || ''}`.trim();
        window.supabaseClient.from('audit_logs').insert([{
            userName: 'Super Admin',
            role: 'Super Admin',
            action: `Reports Review: Categorized ${granteeName} to ${targetForm === 'form2' ? 'Form 2 (Enrolled)' : `Form 3 (${specialReason})`}`,
            studentId: item.grantee?.student_id || item.matchedStudent?.studentId || 'N/A'
        }]).then(() => { }).catch(e => console.warn(e));
    } catch (_) { }

    updateAnnexKPIs();
    renderAnnexForm2Table(verifiedForm2List);
    renderAnnexForm3Table(verifiedForm3List);
    renderAnnexReviewQueue(needsReviewList);
}

function updateAnnexKPIs() {
    const f2Count = verifiedForm2List.length;
    const f3Count = verifiedForm3List.length;
    const revCount = needsReviewList.length;
    const totalBilling = f2Count * 10000;

    const b2 = document.getElementById('sa-badge-form2-count');
    const b3 = document.getElementById('sa-badge-form3-count');
    const bRev = document.getElementById('sa-badge-review-count');

    if (b2) b2.textContent = f2Count;
    if (b3) b3.textContent = f3Count;
    if (bRev) bRev.textContent = revCount;

    const countF2 = document.getElementById('sa-stat-form2-count');
    const amtF2 = document.getElementById('sa-stat-form2-amount');
    const countF3 = document.getElementById('sa-stat-form3-count');

    if (countF2) countF2.textContent = `${f2Count} Enrolled Grantees`;
    if (amtF2) amtF2.textContent = `₱${totalBilling.toLocaleString('en-US', { minimumFractionDigits: 2 })} Total Billing`;
    if (countF3) countF3.textContent = `${f3Count} Not Included Grantees`;
}

function renderAnnexForm2Table(items) {
    const tbody = document.getElementById('sa-tbody-form2');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 30px; color: var(--text-secondary);">No verified enrolled grantees for Form 2.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee;
        const student = item.matchedStudent || {};
        const name = VerificationService.normalizeName(student.fullName || grantee.name);
        const sa = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || 'N/A';
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
        const email = student.email || student.authEmail || 'N/A';
        const phone = student.contactNumber || student.phone || 'N/A';

        return `
            <tr>
                <td style="font-weight: 700; color: var(--primary-color);">${ctrl}</td>
                <td><span style="font-weight: 600;">${student.studentId || grantee.student_id || 'N/A'}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(15,50,96,0.06); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${student.course || grantee.course || 'BSIT'}</td>
                <td style="text-align: center;">${year}</td>
                <td><span style="font-size: 11px; color: var(--text-secondary);">${email}</span></td>
                <td><span style="font-size: 11px;">${phone}</span></td>
                <td style="text-align: center;">${grantee.batch || '1'}</td>
                <td style="font-weight: 600; color: #2E7D32;">₱10,000.00</td>
                <td style="text-align: center; color: var(--text-secondary);">₱0.00</td>
                <td style="font-weight: 700; color: #2E7D32;">₱10,000.00</td>
            </tr>
        `;
    }).join('');
}

function renderAnnexForm3Table(items) {
    const tbody = document.getElementById('sa-tbody-form3');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 30px; color: var(--text-secondary);">No Form 3 special status records.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        const ctrl = String(idx + 1).padStart(5, '0');
        const grantee = item.grantee;
        const student = item.matchedStudent || {};
        const name = VerificationService.normalizeName(student.fullName || grantee.name);
        const sa = student.saNumber || student.familyDetails?.saNumber || grantee.saNumber || 'N/A';
        const bdate = student.birthdate || student.birthday || '01/01/2000';
        const year = String(student.year || student.scholarYearLevel || grantee.year || '1').replace(/[^0-9]/g, '') || '1';
        const reason = item.specialStatusReason || 'Not enrolled';
        const remarks = item.remarks || (reason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${reason}`);

        // Specialized badge styling for all CHED Form 3 special status reasons
        let badgeStyle = 'background: rgba(245,158,11,0.12); color: #D97706; border: 1px solid rgba(245,158,11,0.25);';
        if (reason === 'Dropped' || reason === 'Waived') {
            badgeStyle = 'background: rgba(244,67,54,0.12); color: #D32F2F; border: 1px solid rgba(244,67,54,0.25);';
        } else if (reason === 'Graduated') {
            badgeStyle = 'background: rgba(46,125,50,0.12); color: #2E7D32; border: 1px solid rgba(46,125,50,0.25);';
        } else if (reason.includes('LOA') || reason.includes('Leave')) {
            badgeStyle = 'background: rgba(147,51,234,0.12); color: #7E22CE; border: 1px solid rgba(147,51,234,0.25);';
        } else if (reason.includes('Transfer') || reason === 'Transferee') {
            badgeStyle = 'background: rgba(2,132,199,0.12); color: #0369A1; border: 1px solid rgba(2,132,199,0.25);';
        }

        return `
            <tr>
                <td style="font-weight: 700; color: #E65100;">${ctrl}</td>
                <td><span style="font-weight: 600;">${student.studentId || grantee.student_id || 'N/A'}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(255,143,0,0.08); font-family: monospace; font-size: 11px;">${sa}</span></td>
                <td>${name.lastName}</td>
                <td>${name.firstName}</td>
                <td>${name.mi}</td>
                <td>${(student.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'}</td>
                <td>${bdate}</td>
                <td>${student.course || grantee.course || 'BSIT'}</td>
                <td style="text-align: center;">${year}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                        ${reason}
                    </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 11px;">${remarks}</td>
            </tr>
        `;
    }).join('');
}

function renderAnnexReviewQueue(items) {
    const container = document.getElementById('sa-review-items-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 36px; background: rgba(16,185,129,0.04); border: 1.5px dashed rgba(16,185,129,0.3); border-radius: 16px;">
                <i class="icon-check-circle-2" style="font-size: 32px; color: #10b981; margin-bottom: 6px;"></i>
                <h4 style="margin: 0 0 2px; font-size: 15px; font-weight: 700; color: #065f46;">All Records Categorized & Verified</h4>
                <p style="margin: 0; font-size: 12px; color: #047857;">All scholarship grantees have been verified into Form 2 or Form 3.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map((item, idx) => {
        const grantee = item.grantee;
        const confidence = item.confidence;
        const discrepancies = item.discrepancies || [];
        const granteeName = grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''}`;

        return `
            <div class="card" style="padding: 16px 20px; border-left: 4px solid #E53935; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary);">${granteeName}</h4>
                        <p style="margin: 2px 0 0; font-size: 11px; color: var(--text-secondary);">
                            ID: <strong>${grantee.student_id || 'Unassigned'}</strong> • Program: <strong>${grantee.course || 'BSIT'}</strong> • Batch: <strong>${grantee.batch || '1'}</strong>
                        </p>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 10px; background: rgba(229,57,53,0.1); color: #D32F2F;">
                        Match Confidence: ${confidence}%
                    </span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${discrepancies.map(d => `
                        <span style="padding: 2px 8px; border-radius: 6px; background: rgba(229,57,53,0.08); color: #C62828; font-size: 10px; font-weight: 600;">
                            ${d}
                        </span>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button class="sa-btn-review-approve" data-index="${idx}" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="icon-check"></i> Approve to Form 2 (Enrolled)
                    </button>
                    <button class="sa-btn-review-categorize" data-index="${idx}" style="background: linear-gradient(135deg, #FF8F00, #F57C00); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="icon-tag"></i> Categorize to Form 3
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.sa-btn-review-approve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            resolveSuperAdminReviewItem(idx, 'form2');
        });
    });

    container.querySelectorAll('.sa-btn-review-categorize').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            openSuperAdminResolutionModal(idx);
        });
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function activateSATab(activeBtn, activePane) {
    [saTabBtn2, saTabBtn3, saTabBtnRev].forEach(b => b && b.classList.remove('active'));
    [saTabPane2, saTabPane3, saTabPaneRev].forEach(p => p && (p.style.display = 'none'));

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.style.display = 'block';
}

// Fetch existing masterlist
async function fetchExistingMasterlist() {
    try {
        const tableName = getTableName();
        const { data, error } = await window.supabaseClient
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Error fetching scholar_masterlist:', error);
            return;
        }

        if (data && data.length > 0) {
            extractedRecords = data.map(row => ({
                id: row.id,
                studentId: row.student_id || '',
                lastName: row.last_name,
                firstName: row.first_name,
                middleName: row.middle_name,
                course: row.course || 'BSIT',
                batch: row.batch,
                isDuplicate: false
            }));

            if (importSummaryCard) importSummaryCard.classList.add('hidden');
            populateBatchFilter();
            renderTable();
            updateClearMasterlistButtonVisibility();

        } else {
            extractedRecords = [];
            if (importSummaryCard) importSummaryCard.classList.add('hidden');
            renderTable();
            updateClearMasterlistButtonVisibility();
        }
    } catch (err) {
        console.error('Error fetching existing masterlist:', err);
    }
}

// ── Exported Initialization Function ────────────────────────────────
export function initMasterlistImport() {
    dropZone = document.getElementById('drop-zone');
    fileInput = document.getElementById('file-input');
    fileInfoContainer = document.getElementById('file-info-container');
    fileNameDisplay = document.getElementById('file-name-display');
    fileSizeDisplay = document.getElementById('file-size-display');
    btnClearFile = document.getElementById('btn-clear-file');
    btnExtract = document.getElementById('btn-extract');
    ocrProgressContainer = document.getElementById('ocr-progress-container');
    ocrStatusText = document.getElementById('ocr-status-text');
    ocrProgressBar = document.getElementById('ocr-progress-bar');
    extractedTableBody = document.getElementById('extracted-table-body');
    btnSaveRecords = document.getElementById('btn-save-records');
    filterBatch = document.getElementById('filter-batch');
    btnClearMasterlist = document.getElementById('btn-clear-masterlist');

    importSummaryCard = document.getElementById('import-summary-card');
    summaryExtracted = document.getElementById('summary-extracted');
    summaryImported = document.getElementById('summary-imported');
    summarySkipped = document.getElementById('summary-skipped');
    summaryErrors = document.getElementById('summary-errors');

    saTabBtn2 = document.getElementById('sa-tab-btn-form2');
    saTabBtn3 = document.getElementById('sa-tab-btn-form3');
    saTabBtnRev = document.getElementById('sa-tab-btn-review');

    saTabPane2 = document.getElementById('sa-tab-pane-form2');
    saTabPane3 = document.getElementById('sa-tab-pane-form3');
    saTabPaneRev = document.getElementById('sa-tab-pane-review');

    btnExportF2 = document.getElementById('sa-btn-export-form2-top');
    btnExportF3 = document.getElementById('sa-btn-export-form3-top');
    saSearchF2 = document.getElementById('sa-search-form2');
    saSearchF3 = document.getElementById('sa-search-form3');
    btnAutoResolveAll = document.getElementById('sa-btn-auto-resolve-all');

    // Drag and drop events
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

    if (btnExtract) {
        btnExtract.addEventListener('click', async () => {
            if (!currentFile) return;
            await executeAutoImportPipeline(currentFile);
        });
    }

    if (filterBatch) {
        filterBatch.addEventListener('change', () => {
            renderTable();
        });
    }

    if (btnSaveRecords) {
        btnSaveRecords.addEventListener('click', saveRecordsToDatabase);
    }

    if (btnClearMasterlist) {
        btnClearMasterlist.addEventListener('click', async () => {
            if (!extractedRecords || extractedRecords.length === 0) {
                alert('The masterlist is already empty.');
                return;
            }

            const confirmed = confirm(
                `Are you sure you want to permanently delete ALL ${extractedRecords.length} records from the New Grantees Masterlist?\n\nThis will remove them from the database and cannot be undone.`
            );
            if (!confirmed) return;

            const origHtml = btnClearMasterlist.innerHTML;
            btnClearMasterlist.disabled = true;
            btnClearMasterlist.innerHTML = '<i class="icon-loader" style="font-size: 13px; animation: spin 1s linear infinite; display: inline-block;"></i> Clearing...';

            try {
                const { data, error } = await window.supabaseClient
                    .from(getTableName())
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000')
                    .select();

                if (error) {
                    console.error('Error clearing masterlist:', error);
                    alert(`Failed to clear masterlist from database: ${error.message}`);
                    return;
                }

                if (data && data.length === 0 && extractedRecords.some(r => r.id)) {
                    alert(
                        'Notice: Records could not be deleted from Supabase because Row Level Security (RLS) is active without a DELETE policy.\n\n' +
                        'Please run the "scratch/fix_new_grantees_rls.sql" script in your Supabase SQL Editor to grant DELETE permissions.'
                    );
                }

                extractedRecords = [];
                if (summaryExtracted) summaryExtracted.textContent = '0';
                if (summaryImported) summaryImported.textContent = '0';
                if (summarySkipped) summarySkipped.textContent = '0';
                if (btnSaveRecords) btnSaveRecords.classList.add('hidden');
                if (importSummaryCard) importSummaryCard.classList.add('hidden');

                populateBatchFilter();
                renderTable();

                if (typeof window.showToast === 'function') {
                    window.showToast('All grantees successfully removed from the masterlist.', 'trash-2');
                }
            } catch (err) {
                console.error('Error in clear masterlist:', err);
                alert('An unexpected error occurred: ' + (err.message || err));
            } finally {
                btnClearMasterlist.disabled = false;
                btnClearMasterlist.innerHTML = origHtml;
                updateClearMasterlistButtonVisibility();
            }
        });
    }

    // Annex Tab Switching
    if (saTabBtn2) saTabBtn2.addEventListener('click', () => activateSATab(saTabBtn2, saTabPane2));
    if (saTabBtn3) saTabBtn3.addEventListener('click', () => activateSATab(saTabBtn3, saTabPane3));
    if (saTabBtnRev) saTabBtnRev.addEventListener('click', () => activateSATab(saTabBtnRev, saTabPaneRev));

    // Helper: Universal Blob download with FileSaver / Anchor tag fallback
    function downloadBlob(blob, filename) {
        if (typeof window.saveAs === 'function') {
            window.saveAs(blob, filename);
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    }

    // Annex Auto-Fill Excel Exports
    if (btnExportF2) {
        btnExportF2.addEventListener('click', async () => {
            try {
                btnExportF2.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
                const resp = await fetch('/assets/Annex 5-TES New Form 2.xlsx');
                if (!resp.ok) throw new Error('Could not load Annex 5 Form 2 template');
                const blob = await resp.blob();

                const studentsToFill = verifiedForm2List.map(item => {
                    const grantee = item.grantee || {};
                    const matched = item.matchedStudent || {};
                    return {
                        ...grantee,
                        ...matched,
                        studentId: matched.studentId || matched.student_id || grantee.student_id || grantee.studentId || '',
                        saNumber: matched.saNumber || grantee.saNumber || grantee.familyDetails?.saNumber || matched.familyDetails?.saNumber || '',
                        fullName: matched.fullName || grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''} ${grantee.middle_name || ''}`.trim(),
                        lastName: grantee.last_name || grantee.lastName || matched.lastName || matched.last_name || '',
                        firstName: grantee.first_name || grantee.firstName || matched.firstName || matched.first_name || '',
                        middleName: grantee.middle_name || grantee.middleName || matched.middleName || matched.middle_name || '',
                        batch: grantee.batch || matched.batch || '1',
                        gender: matched.gender || grantee.gender || 'M',
                        birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                        course: matched.course || grantee.course || grantee.program || '',
                        year: matched.year || grantee.year || '1',
                        email: matched.email || matched.authEmail || grantee.email || '',
                        contactNumber: matched.contactNumber || matched.phone || grantee.contactNumber || grantee.phone || ''
                    };
                });
                const result = await BillingService.fillAnnex5Form2(blob, studentsToFill);
                downloadBlob(result.blob, `AutoFilled_Annex_5_TES_Form_2_${Date.now()}.xlsx`);
            } catch (err) {
                console.error('Form 2 export error:', err);
                alert('Failed to generate Form 2: ' + err.message);
            } finally {
                btnExportF2.innerHTML = '<i class="icon-file-spreadsheet" style="font-size: 15px;"></i> Auto-Fill Form 2 (.xlsx)';
            }
        });
    }

    if (btnExportF3) {
        btnExportF3.addEventListener('click', async () => {
            try {
                btnExportF3.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
                const resp = await fetch('/assets/Annex 5-TES New Form 3.xlsx');
                if (!resp.ok) throw new Error('Could not load Annex 5 Form 3 template');
                const blob = await resp.blob();

                const studentsToFill = verifiedForm3List.map(item => {
                    const grantee = item.grantee || {};
                    const matched = item.matchedStudent || {};
                    const specialReason = item.specialStatusReason || matched.status || 'Not enrolled';
                    return {
                        ...grantee,
                        ...matched,
                        studentId: matched.studentId || matched.student_id || grantee.student_id || grantee.studentId || '',
                        saNumber: matched.saNumber || grantee.saNumber || grantee.familyDetails?.saNumber || matched.familyDetails?.saNumber || '',
                        fullName: matched.fullName || grantee.name || `${grantee.last_name || ''}, ${grantee.first_name || ''} ${grantee.middle_name || ''}`.trim(),
                        lastName: grantee.last_name || grantee.lastName || matched.lastName || matched.last_name || '',
                        firstName: grantee.first_name || grantee.firstName || matched.firstName || matched.first_name || '',
                        middleName: grantee.middle_name || grantee.middleName || matched.middleName || matched.middle_name || '',
                        batch: grantee.batch || matched.batch || '1',
                        gender: matched.gender || grantee.gender || 'M',
                        birthdate: matched.birthdate || matched.birthday || grantee.birthdate || grantee.birthday || '',
                        course: matched.course || grantee.course || grantee.program || '',
                        year: matched.year || grantee.year || '1',
                        status: specialReason,
                        remarks: item.remarks || (specialReason === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${specialReason}`)
                    };
                });

                const result = await BillingService.fillAnnex5Form3(blob, studentsToFill);
                downloadBlob(result.blob, `AutoFilled_Annex_5_TES_Form_3_${Date.now()}.xlsx`);
            } catch (err) {
                console.error('Form 3 export error:', err);
                alert('Failed to generate Form 3: ' + err.message);
            } finally {
                btnExportF3.innerHTML = '<i class="icon-file-text" style="font-size: 15px;"></i> Auto-Fill Form 3 (.xlsx)';
            }
        });
    }

    // Annex Search Inputs
    if (saSearchF2) {
        saSearchF2.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = verifiedForm2List.filter(item => {
                const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
                const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
                return !q || name.includes(q) || id.includes(q);
            });
            renderAnnexForm2Table(filtered);
        });
    }

    if (saSearchF3) {
        saSearchF3.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = verifiedForm3List.filter(item => {
                const name = (item.matchedStudent?.fullName || item.grantee.name || '').toLowerCase();
                const id = (item.matchedStudent?.studentId || item.grantee.student_id || '').toLowerCase();
                return !q || name.includes(q) || id.includes(q);
            });
            renderAnnexForm3Table(filtered);
        });
    }

    // Form 2 Clear Data Action
    const saBtnClearForm2 = document.getElementById('sa-btn-clear-form2-data');
    if (saBtnClearForm2) {
        saBtnClearForm2.addEventListener('click', async () => {
            if (verifiedForm2List.length === 0) {
                alert('Form 2 table is already empty.');
                return;
            }
            if (confirm('Are you sure you want to clear all records from the Annex Form 2 table? This will clear local cache and delete records from Supabase.')) {
                verifiedForm2List = [];
                const synced = AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: needsReviewList,
                    updatedBy: 'Super Admin',
                    syncToDb: false
                });
                if (synced) {
                    verifiedForm2List = synced.form2List;
                    verifiedForm3List = synced.form3List;
                    needsReviewList = synced.needsReviewList;
                }
                if (window.supabaseClient) {
                    try {
                        await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    } catch (dbErr) {
                        console.warn('Error deleting annex_form_2 in Supabase:', dbErr);
                    }
                }
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                const syncBadge = document.getElementById('sa-sync-status-badge');
                if (syncBadge) {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Form 2 Cleared (0 Records)`;
                }
                if (window.showToast) window.showToast('Annex Form 2 records cleared.', 'info');
            }
        });
    }

    // Form 3 Clear Data Action
    const saBtnClearForm3 = document.getElementById('sa-btn-clear-form3-data');
    if (saBtnClearForm3) {
        saBtnClearForm3.addEventListener('click', async () => {
            if (verifiedForm3List.length === 0) {
                alert('Form 3 table is already empty.');
                return;
            }
            if (confirm('Are you sure you want to remove all records from the Annex Form 3 table? This will clear local cache and delete records from Supabase.')) {
                verifiedForm3List = [];
                const synced = AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: needsReviewList,
                    updatedBy: 'Super Admin',
                    syncToDb: false
                });
                if (synced) {
                    verifiedForm2List = synced.form2List;
                    verifiedForm3List = synced.form3List;
                    needsReviewList = synced.needsReviewList;
                }
                if (window.supabaseClient) {
                    try {
                        await window.supabaseClient.from('annex_form_3').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    } catch (dbErr) {
                        console.warn('Error deleting annex_form_3 in Supabase:', dbErr);
                    }
                }
                updateAnnexKPIs();
                renderAnnexForm3Table(verifiedForm3List);
                const syncBadge = document.getElementById('sa-sync-status-badge');
                if (syncBadge) {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Form 3 Cleared (0 Records)`;
                }
                if (window.showToast) window.showToast('Annex Form 3 records cleared.', 'info');
            }
        });
    }

    // Manual DB Refresh Action
    const refreshFromDb = async () => {
        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            syncBadge.innerHTML = `<i class="icon-refresh-cw sync-spin" style="font-size: 13px;"></i> Syncing with Database...`;
            syncBadge.style.display = 'inline-flex';
        }
        try {
            const dbSync = await AnnexSyncService.loadFromSupabase();
            if (dbSync && dbSync.fromDb) {
                verifiedForm2List = dbSync.form2List || [];
                verifiedForm3List = dbSync.form3List || [];
                needsReviewList = [];
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                renderAnnexForm3Table(verifiedForm3List);
                renderAnnexReviewQueue(needsReviewList);

                AnnexSyncService.saveVerifiedData({
                    form2List: verifiedForm2List,
                    form3List: verifiedForm3List,
                    needsReviewList: [],
                    updatedBy: 'Supabase Manual Refresh',
                    syncToDb: false
                });

                if (syncBadge) {
                    if (verifiedForm2List.length > 0 || verifiedForm3List.length > 0) {
                        syncBadge.innerHTML = `<i class="icon-database" style="font-size: 13px;"></i> In Sync with Database (${verifiedForm2List.length} Form 2, ${verifiedForm3List.length} Form 3)`;
                    } else {
                        syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Database in Sync (0 Records)`;
                    }
                }
                if (window.showToast) window.showToast(`Database synced: ${verifiedForm2List.length} Form 2, ${verifiedForm3List.length} Form 3 records.`, 'check-circle');
            }
        } catch (err) {
            console.error('Error refreshing from database:', err);
            if (window.showToast) window.showToast('Failed to sync from database: ' + (err.message || err), 'error');
        }
    };

    const saBtnRefreshF2 = document.getElementById('sa-btn-refresh-form2-db');
    if (saBtnRefreshF2) saBtnRefreshF2.addEventListener('click', refreshFromDb);
    const saBtnRefreshF3 = document.getElementById('sa-btn-refresh-form3-db');
    if (saBtnRefreshF3) saBtnRefreshF3.addEventListener('click', refreshFromDb);

    window.refreshAnnexFromDb = refreshFromDb;
    window.clearAnnexForm2 = async () => {
        verifiedForm2List = [];
        AnnexSyncService.saveVerifiedData({
            form2List: [],
            form3List: verifiedForm3List,
            needsReviewList: needsReviewList,
            updatedBy: 'Manual Clear',
            syncToDb: false
        });
        if (window.supabaseClient) {
            await window.supabaseClient.from('annex_form_2').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
    };

    // Modal Handlers for Super Admin Grantee Categorization
    const saBtnCloseRes = document.getElementById('sa-btn-close-resolution');
    const saBtnCancelRes = document.getElementById('sa-btn-cancel-resolution');
    const saBtnConfirmRes = document.getElementById('sa-btn-confirm-resolution');
    const saModalTargetForm = document.getElementById('sa-modal-target-form');
    const saModalForm3ReasonGroup = document.getElementById('sa-modal-form3-reason-group');
    const saModalForm3Reason = document.getElementById('sa-modal-form3-reason');
    const saModalRemarks = document.getElementById('sa-modal-remarks');

    if (saBtnCloseRes) saBtnCloseRes.addEventListener('click', closeSuperAdminResolutionModal);
    if (saBtnCancelRes) saBtnCancelRes.addEventListener('click', closeSuperAdminResolutionModal);

    if (saModalTargetForm) {
        saModalTargetForm.addEventListener('change', (e) => {
            if (saModalForm3ReasonGroup) {
                saModalForm3ReasonGroup.style.display = e.target.value === 'form3' ? 'block' : 'none';
            }
        });
    }

    if (saBtnConfirmRes) {
        saBtnConfirmRes.addEventListener('click', () => {
            if (activeSAResolutionItem === null) return;
            const targetForm = saModalTargetForm ? saModalTargetForm.value : 'form3';
            const reason = saModalForm3Reason ? saModalForm3Reason.value : 'Not enrolled';
            const remarks = saModalRemarks ? saModalRemarks.value.trim() : '';

            resolveSuperAdminReviewItem(activeSAResolutionItem, targetForm, reason, remarks);
            closeSuperAdminResolutionModal();
        });
    }

    // Auto-Categorize All to Form 3
    if (btnAutoResolveAll) {
        btnAutoResolveAll.addEventListener('click', () => {
            if (needsReviewList.length === 0) {
                if (window.showToast) window.showToast('Review queue is already empty.', 'info');
                return;
            }
            const count = needsReviewList.length;
            while (needsReviewList.length > 0) {
                const item = needsReviewList.shift();
                item.classification = 'INACTIVE_FORM3';
                item.isEnrolled = false;
                item.specialStatusReason = 'Not enrolled';
                item.remarks = 'Batch categorized to Form 3 by Super Admin';
                if (!item.matchedStudent) {
                    item.matchedStudent = {
                        fullName: item.grantee?.name || '',
                        studentId: item.grantee?.student_id || '',
                        course: item.grantee?.course || 'BSIT',
                        year: item.grantee?.year || '1',
                        status: 'Not enrolled'
                    };
                } else {
                    item.matchedStudent.status = 'Not enrolled';
                }
                verifiedForm3List.push(item);
            }
            const synced = AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: needsReviewList,
                updatedBy: 'Super Admin'
            });
            if (synced) {
                verifiedForm2List = synced.form2List;
                verifiedForm3List = synced.form3List;
                needsReviewList = synced.needsReviewList;
            }
            updateAnnexKPIs();
            renderAnnexForm3Table(verifiedForm3List);
            renderAnnexReviewQueue(needsReviewList);
            if (window.showToast) window.showToast(`Auto-categorized ${count} records to Form 3`, 'check-circle');
        });
    }

    // Subscribe to live synchronization with Admin Review Queue
    AnnexSyncService.onSync((synced) => {
        if (!synced) return;
        verifiedForm2List = synced.form2List || [];
        verifiedForm3List = synced.form3List || [];
        needsReviewList = synced.needsReviewList || [];

        updateAnnexKPIs();
        renderAnnexForm2Table(verifiedForm2List);
        renderAnnexForm3Table(verifiedForm3List);
        renderAnnexReviewQueue(needsReviewList);

        const syncBadge = document.getElementById('sa-sync-status-badge');
        if (syncBadge) {
            const timeStr = new Date(synced.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Synced with Admin (${timeStr})`;
            syncBadge.style.display = 'inline-flex';
        }
    });

    // Automatically restore verified state from Supabase on boot
    AnnexSyncService.loadFromSupabase().then(dbSync => {
        if (dbSync && dbSync.fromDb) {
            verifiedForm2List = dbSync.form2List || [];
            verifiedForm3List = dbSync.form3List || [];
            needsReviewList = [];
            updateAnnexKPIs();
            renderAnnexForm2Table(verifiedForm2List);
            renderAnnexForm3Table(verifiedForm3List);
            renderAnnexReviewQueue(needsReviewList);

            // Database is the ground truth: sync to localStorage so stale cached records are eliminated
            AnnexSyncService.saveVerifiedData({
                form2List: verifiedForm2List,
                form3List: verifiedForm3List,
                needsReviewList: [],
                updatedBy: 'Supabase Sync',
                syncToDb: false
            });

            const syncBadge = document.getElementById('sa-sync-status-badge');
            if (syncBadge) {
                if (verifiedForm2List.length > 0 || verifiedForm3List.length > 0) {
                    syncBadge.innerHTML = `<i class="icon-database" style="font-size: 13px;"></i> In Sync with Database (${verifiedForm2List.length} Form 2, ${verifiedForm3List.length} Form 3)`;
                } else {
                    syncBadge.innerHTML = `<i class="icon-check-circle-2" style="font-size: 13px;"></i> Database in Sync (0 Records)`;
                }
                syncBadge.style.display = 'inline-flex';
            }
        } else {
            // Local storage fallback only if Supabase could not be contacted / offline
            const initialSync = AnnexSyncService.getVerifiedData();
            if (initialSync) {
                verifiedForm2List = initialSync.form2List || [];
                verifiedForm3List = initialSync.form3List || [];
                needsReviewList = initialSync.needsReviewList || [];
                updateAnnexKPIs();
                renderAnnexForm2Table(verifiedForm2List);
                renderAnnexForm3Table(verifiedForm3List);
                renderAnnexReviewQueue(needsReviewList);
            }
        }
    }).catch(e => {
        console.warn('Super Admin loadFromSupabase error:', e);
        const initialSync = AnnexSyncService.getVerifiedData();
        if (initialSync) {
            verifiedForm2List = initialSync.form2List || [];
            verifiedForm3List = initialSync.form3List || [];
            needsReviewList = initialSync.needsReviewList || [];
            updateAnnexKPIs();
            renderAnnexForm2Table(verifiedForm2List);
            renderAnnexForm3Table(verifiedForm3List);
            renderAnnexReviewQueue(needsReviewList);
        }
    });

    // Initial fetch of masterlist data
    fetchExistingMasterlist();
}

// Auto-run if loaded directly in standalone view
if (!window.__reportsHostingImport && document.getElementById('drop-zone')) {
    initMasterlistImport();
}
