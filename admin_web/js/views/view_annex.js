// js/views/view_annex.js
import { BillingService } from '../services/billing_service.js';

const supabase = window.supabaseClient;

// State
let rawForm2Records = [];
let rawForm3Records = [];
let activeTab = 'f2'; // 'f2' or 'f3'

// ── 1. Initialization ───────────────────────────────────────────────
async function initViewAnnex() {
    setupEventListeners();
    await populateDistinctAcademicYears();
    await fetchRecordsFromSupabase();
}

// ── 2. Populate Distinct School Years from Database ─────────────────
async function populateDistinctAcademicYears() {
    const selAY = document.getElementById('view-filter-ay');
    if (!selAY) return;

    const baseYears = new Set(['2024-2025', '2023-2024', '2022-2023', '2021-2022']);

    try {
        if (supabase) {
            const [resF2, resF3] = await Promise.all([
                supabase.from('annex_form_2').select('academic_year'),
                supabase.from('annex_form_3').select('academic_year')
            ]);

            (resF2.data || []).forEach(r => { if (r.academic_year) baseYears.add(r.academic_year.trim()); });
            (resF3.data || []).forEach(r => { if (r.academic_year) baseYears.add(r.academic_year.trim()); });
        }
    } catch (e) {
        console.warn('Could not query distinct academic years from Supabase:', e);
    }

    const sortedYears = Array.from(baseYears).sort().reverse();
    const currentVal = selAY.value || '2024-2025';

    selAY.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('') +
        `<option value="All">All School Years</option>`;

    if (sortedYears.includes(currentVal)) {
        selAY.value = currentVal;
    } else if (sortedYears.length > 0) {
        selAY.value = sortedYears[0];
    }
}

// ── 3. Fetch Records from Supabase ──────────────────────────────────
async function fetchRecordsFromSupabase() {
    const tbodyF2 = document.getElementById('view-tbody-f2');
    const tbodyF3 = document.getElementById('view-tbody-f3');
    const iconRefresh = document.getElementById('icon-view-refresh');

    if (iconRefresh) iconRefresh.classList.add('sync-spin');

    const selAY = document.getElementById('view-filter-ay');
    const selSem = document.getElementById('view-filter-sem');

    const filterAY = selAY ? selAY.value : '2024-2025';
    const filterSem = selSem ? selSem.value : '1st Semester';

    updateFilterBadge(filterAY, filterSem);

    try {
        if (!supabase) {
            throw new Error('Supabase client is not available.');
        }

        // Build query for Form 2
        let qF2 = supabase.from('annex_form_2').select('*').order('control_number', { ascending: true });
        if (filterAY !== 'All') qF2 = qF2.eq('academic_year', filterAY);
        if (filterSem !== 'All') qF2 = qF2.eq('semester', filterSem);

        // Build query for Form 3
        let qF3 = supabase.from('annex_form_3').select('*').order('control_number', { ascending: true });
        if (filterAY !== 'All') qF3 = qF3.eq('academic_year', filterAY);
        if (filterSem !== 'All') qF3 = qF3.eq('semester', filterSem);

        const [resF2, resF3] = await Promise.all([qF2, qF3]);

        if (resF2.error) console.error('Error fetching annex_form_2:', resF2.error);
        if (resF3.error) console.error('Error fetching annex_form_3:', resF3.error);

        rawForm2Records = resF2.data || [];
        rawForm3Records = resF3.data || [];

        applyFiltersAndRender();

    } catch (err) {
        console.error('Error in fetchRecordsFromSupabase:', err);
        if (tbodyF2) {
            tbodyF2.innerHTML = `<tr><td colspan="16" style="text-align: center; padding: 36px; color: var(--error);">
                <i class="icon-alert-triangle" style="font-size: 24px; margin-bottom: 6px;"></i>
                <div>Failed to load records from Supabase: ${err.message}</div>
            </td></tr>`;
        }
        if (tbodyF3) {
            tbodyF3.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 36px; color: var(--error);">
                <i class="icon-alert-triangle" style="font-size: 24px; margin-bottom: 6px;"></i>
                <div>Failed to load records from Supabase: ${err.message}</div>
            </td></tr>`;
        }
    } finally {
        if (iconRefresh) iconRefresh.classList.remove('sync-spin');
    }
}

// ── 4. Apply Filters and Render ─────────────────────────────────────
function applyFiltersAndRender() {
    const searchInput = document.getElementById('view-search-input');
    const selBatch = document.getElementById('view-filter-batch');
    const selStatus = document.getElementById('view-filter-status');

    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const batchFilter = selBatch ? selBatch.value : 'All';
    const statusFilter = selStatus ? selStatus.value : 'All';

    // 1. Filter Form 2 Records
    const filteredF2 = rawForm2Records.filter(row => {
        const matchBatch = batchFilter === 'All' || String(row.tes_batch || '').toLowerCase().includes(batchFilter.toLowerCase());
        if (!matchBatch) return false;

        if (!query) return true;

        const fullName = `${row.last_name || ''} ${row.given_name || ''} ${row.middle_initial || ''}`.toLowerCase();
        const id = String(row.student_number || '').toLowerCase();
        const sa = String(row.tes_application_number || '').toLowerCase();
        const ctrl = String(row.control_number || '').toLowerCase();
        const prog = String(row.degree_program || '').toLowerCase();

        return fullName.includes(query) || id.includes(query) || sa.includes(query) || ctrl.includes(query) || prog.includes(query);
    });

    // 2. Filter Form 3 Records
    const filteredF3 = rawForm3Records.filter(row => {
        const matchStatus = statusFilter === 'All' || String(row.status || '').toLowerCase() === statusFilter.toLowerCase();
        if (!matchStatus) return false;

        if (!query) return true;

        const fullName = `${row.last_name || ''} ${row.given_name || ''} ${row.middle_initial || ''}`.toLowerCase();
        const id = String(row.student_number || '').toLowerCase();
        const sa = String(row.tes_application_number || '').toLowerCase();
        const ctrl = String(row.control_number || '').toLowerCase();
        const prog = String(row.degree_program || '').toLowerCase();
        const reason = String(row.status || '').toLowerCase();

        return fullName.includes(query) || id.includes(query) || sa.includes(query) || ctrl.includes(query) || prog.includes(query) || reason.includes(query);
    });

    // Update KPIs & badges
    updateKPIMetrics(filteredF2, filteredF3);

    // Render Tables
    renderForm2Table(filteredF2);
    renderForm3Table(filteredF3);
}

// ── 5. KPI Metrics Updater ──────────────────────────────────────────
function updateKPIMetrics(f2List, f3List) {
    const f2Count = f2List.length;
    const f3Count = f3List.length;
    const totalCount = f2Count + f3Count;
    const f2TotalAmount = f2Count * 10000;

    const elF2Count = document.getElementById('view-kpi-f2-count');
    const elF2Amt = document.getElementById('view-kpi-f2-amount');
    const elF3Count = document.getElementById('view-kpi-f3-count');
    const elTotal = document.getElementById('view-kpi-total-count');

    const badgeF2 = document.getElementById('view-badge-f2-count');
    const badgeF3 = document.getElementById('view-badge-f3-count');

    if (elF2Count) elF2Count.textContent = f2Count.toLocaleString();
    if (elF2Amt) elF2Amt.textContent = `₱${f2TotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (elF3Count) elF3Count.textContent = f3Count.toLocaleString();
    if (elTotal) elTotal.textContent = totalCount.toLocaleString();

    if (badgeF2) badgeF2.textContent = f2Count;
    if (badgeF3) badgeF3.textContent = f3Count;
}

function updateFilterBadge(ay, sem) {
    const badge = document.getElementById('view-active-filter-badge');
    const subtext = document.getElementById('view-kpi-term-subtext');

    const text = (ay === 'All' && sem === 'All')
        ? 'All Terms & Semesters'
        : (ay === 'All' ? `${sem} (All Years)` : (sem === 'All' ? `A.Y. ${ay} (All Semesters)` : `A.Y. ${ay} • ${sem}`));

    if (badge) {
        badge.innerHTML = `<i class="icon-calendar" style="font-size: 12px;"></i> ${text}`;
    }
    if (subtext) {
        subtext.textContent = text;
    }
}

// ── 6. Render Form 2 Table ──────────────────────────────────────────
function renderForm2Table(rows) {
    const tbody = document.getElementById('view-tbody-f2');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="16" style="text-align: center; padding: 48px 20px; color: var(--text-secondary);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <i class="icon-folder" style="font-size: 32px; color: var(--border-color);"></i>
                        <span style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No Form 2 Enrolled Grantees Found</span>
                        <span style="font-size: 12px; color: var(--text-secondary); max-width: 400px;">
                            No archived Form 2 billing records match the selected school year, semester, or search filter.
                        </span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
        const ctrl = row.control_number || String(idx + 1).padStart(5, '0');
        const studentNo = row.student_number || 'N/A';
        const saNo = row.tes_application_number || 'N/A';
        const lastName = row.last_name || '';
        const givenName = row.given_name || '';
        const mi = row.middle_initial || '';
        const sex = (row.sex_at_birth || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
        const bdate = row.birthdate || 'N/A';
        const degree = row.degree_program || 'BSIT';
        const yr = row.year_level || '1';
        const email = row.email_address || 'N/A';
        const phone = row.phone_number || 'N/A';
        const batch = row.tes_batch || '1';

        const tesAmt = Number(row.tes_amount || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const pwdAmt = Number(row.pwd_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const totalAmt = Number(row.total_amount || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 });

        return `
            <tr>
                <td style="font-weight: 700; color: var(--primary-color);">${ctrl}</td>
                <td><span style="font-weight: 600;">${studentNo}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(15,50,96,0.06); font-family: monospace; font-size: 11px;">${saNo}</span></td>
                <td>${lastName}</td>
                <td>${givenName}</td>
                <td style="text-align: center;">${mi}</td>
                <td style="text-align: center;">${sex}</td>
                <td>${bdate}</td>
                <td>${degree}</td>
                <td style="text-align: center;">${yr}</td>
                <td><span style="font-size: 11px; color: var(--text-secondary);">${email}</span></td>
                <td><span style="font-size: 11px;">${phone}</span></td>
                <td style="text-align: center;"><span style="padding: 2px 8px; border-radius: 10px; background: rgba(0,0,0,0.05); font-weight: 600; font-size: 11px;">${batch}</span></td>
                <td style="font-weight: 600; color: #2E7D32; text-align: right;">₱${tesAmt}</td>
                <td style="text-align: right; color: var(--text-secondary);">${pwdAmt === '0.00' ? '-' : `₱${pwdAmt}`}</td>
                <td style="font-weight: 700; color: #2E7D32; text-align: right;">₱${totalAmt}</td>
            </tr>
        `;
    }).join('');
}

// ── 7. Render Form 3 Table ──────────────────────────────────────────
function renderForm3Table(rows) {
    const tbody = document.getElementById('view-tbody-f3');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 48px 20px; color: var(--text-secondary);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <i class="icon-folder" style="font-size: 32px; color: var(--border-color);"></i>
                        <span style="font-weight: 700; font-size: 14px; color: var(--text-primary);">No Form 3 Inactive Records Found</span>
                        <span style="font-size: 12px; color: var(--text-secondary); max-width: 400px;">
                            No archived Form 3 special status records match the selected school year, semester, or search filter.
                        </span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
        const ctrl = row.control_number || String(idx + 1).padStart(5, '0');
        const studentNo = row.student_number || 'N/A';
        const saNo = row.tes_application_number || 'N/A';
        const lastName = row.last_name || '';
        const givenName = row.given_name || '';
        const mi = row.middle_initial || '';
        const sex = (row.sex_at_birth || 'M').toUpperCase().startsWith('F') ? 'F' : 'M';
        const bdate = row.birthdate || 'N/A';
        const degree = row.degree_program || 'BSIT';
        const yr = row.year_level || '1';
        const status = row.status || 'Not enrolled';
        const remarks = row.remarks || `Categorized: ${status}`;

        let badgeStyle = 'background: rgba(255,152,0,0.12); color: #E65100;';
        if (status === 'Dropped' || status === 'Waived') {
            badgeStyle = 'background: rgba(244,67,54,0.12); color: #D32F2F;';
        } else if (status === 'Graduated') {
            badgeStyle = 'background: rgba(76,175,80,0.12); color: #2E7D32;';
        } else if (status === 'On Leave of Absence (LOA)') {
            badgeStyle = 'background: rgba(142,36,170,0.12); color: #8E24AA;';
        } else if (status === 'Transferee') {
            badgeStyle = 'background: rgba(0,150,136,0.12); color: #00796B;';
        }

        return `
            <tr>
                <td style="font-weight: 700; color: #E65100;">${ctrl}</td>
                <td><span style="font-weight: 600;">${studentNo}</span></td>
                <td><span style="padding: 2px 8px; border-radius: 6px; background: rgba(255,143,0,0.08); font-family: monospace; font-size: 11px;">${saNo}</span></td>
                <td>${lastName}</td>
                <td>${givenName}</td>
                <td style="text-align: center;">${mi}</td>
                <td style="text-align: center;">${sex}</td>
                <td>${bdate}</td>
                <td>${degree}</td>
                <td style="text-align: center;">${yr}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                        ${status}
                    </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 11px;">${remarks}</td>
            </tr>
        `;
    }).join('');
}

// ── 8. Excel Exports ────────────────────────────────────────────────
async function exportForm2Excel() {
    const btn = document.getElementById('btn-view-export-f2');
    try {
        if (rawForm2Records.length === 0) {
            alert('No Form 2 records available to export for the selected filters.');
            return;
        }

        if (btn) btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';

        const resp = await fetch('/assets/Annex 5-TES New Form 2.xlsx');
        if (!resp.ok) throw new Error('Could not load Annex 5 Form 2 template');
        const blob = await resp.blob();

        const selAY = document.getElementById('view-filter-ay');
        const selSem = document.getElementById('view-filter-sem');
        const ayStr = selAY ? selAY.value.replace(/[^a-zA-Z0-9]/g, '_') : '2024_2025';
        const semStr = selSem ? selSem.value.replace(/[^a-zA-Z0-9]/g, '_') : '1st_Sem';

        const studentsToFill = rawForm2Records.map(row => ({
            studentId: row.student_number || '',
            saNumber: row.tes_application_number || '',
            fullName: `${row.last_name || ''}, ${row.given_name || ''} ${row.middle_initial || ''}`.trim(),
            lastName: row.last_name || '',
            firstName: row.given_name || '',
            middleName: row.middle_initial || '',
            batch: row.tes_batch || '1',
            gender: row.sex_at_birth || 'M',
            birthdate: row.birthdate || '',
            course: row.degree_program || 'BSIT',
            year: row.year_level || '1',
            email: row.email_address || '',
            contactNumber: row.phone_number || ''
        }));

        const result = await BillingService.fillAnnex5Form2(blob, studentsToFill);
        downloadBlob(result.blob, `Archived_Annex5_Form2_${ayStr}_${semStr}.xlsx`);
        if (window.showToast) window.showToast('Form 2 Excel downloaded successfully!', 'check-circle');
    } catch (err) {
        console.error('Export Form 2 error:', err);
        alert('Failed to export Form 2: ' + err.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="icon-file-spreadsheet" style="font-size: 15px;"></i> Auto-Fill Form 2 (.xlsx)';
    }
}

async function exportForm3Excel() {
    const btn = document.getElementById('btn-view-export-f3');
    try {
        if (rawForm3Records.length === 0) {
            alert('No Form 3 records available to export for the selected filters.');
            return;
        }

        if (btn) btn.innerHTML = '<i class="icon-loader" style="animation: spin 1s linear infinite;"></i> Generating...';

        const resp = await fetch('/assets/Annex 5-TES New Form 3.xlsx');
        if (!resp.ok) throw new Error('Could not load Annex 5 Form 3 template');
        const blob = await resp.blob();

        const selAY = document.getElementById('view-filter-ay');
        const selSem = document.getElementById('view-filter-sem');
        const ayStr = selAY ? selAY.value.replace(/[^a-zA-Z0-9]/g, '_') : '2024_2025';
        const semStr = selSem ? selSem.value.replace(/[^a-zA-Z0-9]/g, '_') : '1st_Sem';

        const studentsToFill = rawForm3Records.map(row => ({
            studentId: row.student_number || '',
            saNumber: row.tes_application_number || '',
            fullName: `${row.last_name || ''}, ${row.given_name || ''} ${row.middle_initial || ''}`.trim(),
            lastName: row.last_name || '',
            firstName: row.given_name || '',
            middleName: row.middle_initial || '',
            gender: row.sex_at_birth || 'M',
            birthdate: row.birthdate || '',
            course: row.degree_program || 'BSIT',
            year: row.year_level || '1',
            status: row.status || 'Not enrolled',
            remarks: row.remarks || `Categorized: ${row.status || 'Not enrolled'}`
        }));

        const result = await BillingService.fillAnnex5Form3(blob, studentsToFill);
        downloadBlob(result.blob, `Archived_Annex5_Form3_${ayStr}_${semStr}.xlsx`);
        if (window.showToast) window.showToast('Form 3 Excel downloaded successfully!', 'check-circle');
    } catch (err) {
        console.error('Export Form 3 error:', err);
        alert('Failed to export Form 3: ' + err.message);
    } finally {
        if (btn) btn.innerHTML = '<i class="icon-file-text" style="font-size: 15px;"></i> Auto-Fill Form 3 (.xlsx)';
    }
}

function downloadBlob(blob, filename) {
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

// ── 9. Event Listeners Setup ────────────────────────────────────────
function setupEventListeners() {
    // School Year change
    const selAY = document.getElementById('view-filter-ay');
    if (selAY) {
        selAY.addEventListener('change', () => {
            fetchRecordsFromSupabase();
        });
    }

    // Semester change
    const selSem = document.getElementById('view-filter-sem');
    if (selSem) {
        selSem.addEventListener('change', () => {
            fetchRecordsFromSupabase();
        });
    }

    // Search input (debounced / instantaneous filtering)
    const searchInput = document.getElementById('view-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFiltersAndRender();
        });
    }

    // Batch filter
    const selBatch = document.getElementById('view-filter-batch');
    if (selBatch) {
        selBatch.addEventListener('change', () => {
            applyFiltersAndRender();
        });
    }

    // Status filter
    const selStatus = document.getElementById('view-filter-status');
    if (selStatus) {
        selStatus.addEventListener('change', () => {
            applyFiltersAndRender();
        });
    }

    // Refresh button
    const btnRefresh = document.getElementById('btn-view-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            fetchRecordsFromSupabase();
        });
    }

    // Export buttons
    const btnExpF2 = document.getElementById('btn-view-export-f2');
    if (btnExpF2) btnExpF2.addEventListener('click', exportForm2Excel);

    const btnExpF3 = document.getElementById('btn-view-export-f3');
    if (btnExpF3) btnExpF3.addEventListener('click', exportForm3Excel);

    // Tab switching
    const tabF2 = document.getElementById('view-tab-btn-f2');
    const tabF3 = document.getElementById('view-tab-btn-f3');
    const paneF2 = document.getElementById('view-tab-pane-f2');
    const paneF3 = document.getElementById('view-tab-pane-f3');
    const statusWrap = document.getElementById('view-f3-status-filter-wrap');

    if (tabF2 && tabF3) {
        tabF2.addEventListener('click', () => {
            activeTab = 'f2';
            tabF2.classList.add('active');
            tabF3.classList.remove('active');
            if (paneF2) paneF2.style.display = 'block';
            if (paneF3) paneF3.style.display = 'none';
            if (statusWrap) statusWrap.style.display = 'none';
        });

        tabF3.addEventListener('click', () => {
            activeTab = 'f3';
            tabF3.classList.add('active');
            tabF2.classList.remove('active');
            if (paneF3) paneF3.style.display = 'block';
            if (paneF2) paneF2.style.display = 'none';
            if (statusWrap) statusWrap.style.display = 'flex';
        });
    }
}

// Boot up
initViewAnnex();
