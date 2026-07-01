// js/views/reports.js
import { BillingService } from '../services/billing_service.js';
const supabase = window.supabaseClient;

let allStudents = [];
let selectedStudentIds = new Set();
let throughputChart = null;
let deptChart = null;

// ── Load All Data ───────────────────────────────────────────────────
async function loadAllData() {
    try {
        const { data, error } = await supabase.from('students').select('*');
        if (error) throw error;
        allStudents = data || [];
        renderMasterTable(allStudents);
        buildCharts(allStudents);
        populateScholarshipFilter(allStudents);
    } catch (e) {
        console.error('Error loading students for reports:', e);
        document.getElementById('rpt-master-body').innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: var(--error);">Failed to load student data.</td></tr>`;
    }
}

// ── Populate Scholarship Filter ─────────────────────────────────────
function populateScholarshipFilter(students) {
    const set = new Set();
    students.forEach(s => { if (s.scholarshipProgram) set.add(s.scholarshipProgram); });
    const sel = document.getElementById('rpt-filter-scholarship');
    set.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

// ── Filter Logic ────────────────────────────────────────────────────
function getFilteredStudents() {
    const query = document.getElementById('rpt-search').value.toLowerCase();
    const gender = document.getElementById('rpt-filter-gender').value;
    const scholarship = document.getElementById('rpt-filter-scholarship').value;
    const year = document.getElementById('rpt-filter-year').value;
    const fatherEdu = document.getElementById('rpt-filter-father').value;
    const motherEdu = document.getElementById('rpt-filter-mother').value;

    return allStudents.filter(s => {
        const family = s.familyDetails || {};
        const name = (s.fullName || '').toLowerCase();
        const id = (s.studentId || '').toLowerCase();
        const matchSearch = !query || name.includes(query) || id.includes(query);
        const matchGender = gender === 'All Genders' || s.gender === gender;
        const matchScholarship = scholarship === 'All Scholarships' || s.scholarshipProgram === scholarship;
        const matchYear = year === 'All Year Levels' || s.scholarYearLevel === year;
        const matchFather = fatherEdu === 'All (Father)' || (family.fatherEduStatus || 'Non-graduate') === fatherEdu;
        const matchMother = motherEdu === 'All (Mother)' || (family.motherEduStatus || 'Non-graduate') === motherEdu;
        return matchSearch && matchGender && matchScholarship && matchYear && matchFather && matchMother;
    });
}

function applyFilters() {
    const filtered = getFilteredStudents();
    renderMasterTable(filtered);
}

// ── Render Master Table ─────────────────────────────────────────────
function renderMasterTable(students) {
    const body = document.getElementById('rpt-master-body');
    if (students.length === 0) {
        body.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">No students match filters.</td></tr>`;
        return;
    }

    body.innerHTML = students.map(s => {
        let nameParts = { last: 'N/A', first: 'N/A', mi: '' };
        if (s.fullName) {
            const fn = s.fullName.trim();
            if (fn.includes(',')) {
                const parts = fn.split(',');
                const last = parts[0].trim();
                const restParts = parts.slice(1).join(',').trim().split(/\s+/);
                if (restParts.length > 1) {
                    const miPart = restParts.pop();
                    nameParts = { last, first: restParts.join(' ').trim(), mi: miPart.charAt(0).toUpperCase() };
                } else {
                    nameParts = { last, first: restParts.join(' '), mi: '' };
                }
            } else {
                const parts = fn.split(/\s+/);
                if (parts.length === 1) {
                    nameParts = { last: parts[0], first: '', mi: '' };
                } else if (parts.length === 2) {
                    nameParts = { last: parts[1], first: parts[0], mi: '' };
                } else {
                    const last = parts.pop();
                    const miPart = parts.pop();
                    nameParts = { last, first: parts.join(' ').trim(), mi: miPart.charAt(0).toUpperCase() };
                }
            }
        }
        
        const family = s.familyDetails || {};
        const isChecked = selectedStudentIds.has(s.uid) ? 'checked' : '';
        const statusColor = (s.status || '').toLowerCase() === 'verified' ? 'var(--success)' : 
                            (s.status || '').toLowerCase() === 'approved' ? 'var(--success)' :
                            (s.status || '').toLowerCase() === 'pending' ? '#FBC02D' : 'var(--error)';

        return `
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 14px;">
                    <input type="checkbox" class="rpt-row-checkbox" data-uid="${s.uid}" ${isChecked} style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;">
                </td>
                <td style="padding: 14px; font-size: 13px; color: var(--text-secondary);">${s.studentId || 'N/A'}</td>
                <td style="padding: 14px; font-weight: 600; font-size: 13px;">
                    ${nameParts.last}
                </td>
                <td style="padding: 14px; font-size: 13px;">${nameParts.first}</td>
                <td style="padding: 14px; font-size: 13px;">${nameParts.mi}</td>
                <td style="padding: 14px; font-size: 13px;">${s.email || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.birthdate || '01/01/2000'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.gender || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.course || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${(s.year || '').split(' ')[0] || ''} - ${s.section || ''}</td>
                <td style="padding: 14px; font-size: 13px;">${s.scholarshipProgram || s.scholarshipName || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.scholarYearLevel || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.payoutsReceived || 0}</td>
                <td style="padding: 14px; font-size: 13px;">${s.contactNumber || 'N/A'}</td>
                <td style="padding: 14px;">
                    <span style="font-size: 11px; font-weight: 700; color: ${statusColor}; background: ${statusColor}18; padding: 4px 10px; border-radius: 16px;">${s.status || 'Pending'}</span>
                </td>
                <td style="padding: 14px; font-size: 13px;">${family.fatherName || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.fatherEduStatus || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.motherName || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.motherEduStatus || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.yearlyIncome || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.religion || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.tribe || 'N/A'}</td>
            </tr>
        `;
    }).join('');

    // Bind row checkboxes
    document.querySelectorAll('.rpt-row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedStudentIds.add(e.target.dataset.uid);
            else selectedStudentIds.delete(e.target.dataset.uid);
            updateExcelBtnLabel();
        });
    });
}

function updateExcelBtnLabel() {
    const btn = document.getElementById('btn-export-excel');
    if (selectedStudentIds.size > 0) {
        btn.innerHTML = `<i class="icon-file-spreadsheet" style="font-size: 16px;"></i> Export Selected (${selectedStudentIds.size})`;
    } else {
        btn.innerHTML = `<i class="icon-file-spreadsheet" style="font-size: 16px;"></i> Export Excel Masterlist`;
    }
}

// ── Charts ───────────────────────────────────────────────────────────
function buildCharts(students) {
    buildThroughputChart(students);
    buildDeptChart(students);

    // Rebuild charts on theme change
    if (window.reportsChartsThemeListener) {
        window.removeEventListener('themechanged', window.reportsChartsThemeListener);
    }
    window.reportsChartsThemeListener = () => {
        buildThroughputChart(students);
        buildDeptChart(students);
    };
    window.addEventListener('themechanged', window.reportsChartsThemeListener);
}

function buildThroughputChart(students) {
    const canvas = document.getElementById('throughputChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const timeframe = document.getElementById('throughput-timeframe').value;

    // Compute data based on timeframe
    let labels = [];
    let submissions = [];
    let approved = [];

    if (timeframe === 'This Year') {
        labels = ['Q1', 'Q2', 'Q3', 'Q4'];
        const now = new Date();
        const year = now.getFullYear();
        for (let q = 0; q < 4; q++) {
            const start = new Date(year, q * 3, 1);
            const end = new Date(year, (q + 1) * 3, 1); // 1st day of next quarter
            const qStudents = students.filter(s => {
                if (!s.createdAt) return false;
                const d = new Date(s.createdAt);
                return d >= start && d < end;
            });
            submissions.push(qStudents.length);
            approved.push(qStudents.filter(s => (s.status || '').toLowerCase() === 'verified' || (s.status || '').toLowerCase() === 'approved').length);
        }
    } else if (timeframe === 'This Month') {
        labels = ['W1', 'W2', 'W3', 'W4'];
        const now = new Date();
        for (let w = 0; w < 4; w++) {
            const start = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7);
            const end = w === 3 
                ? new Date(now.getFullYear(), now.getMonth() + 1, 1) // 1st of next month
                : new Date(now.getFullYear(), now.getMonth(), 1 + (w + 1) * 7); // Start of next week
            const wStudents = students.filter(s => {
                if (!s.createdAt) return false;
                const d = new Date(s.createdAt);
                return d >= start && d < end;
            });
            submissions.push(wStudents.length);
            approved.push(wStudents.filter(s => (s.status || '').toLowerCase() === 'verified' || (s.status || '').toLowerCase() === 'approved').length);
        }
    } else {
        labels = ['Mon-Tue', 'Wed-Thu', 'Fri', 'Sat-Sun'];
        // Simplified: just show totals split evenly as placeholder
        const total = students.length;
        const approvedTotal = students.filter(s => (s.status || '').toLowerCase() === 'verified' || (s.status || '').toLowerCase() === 'approved').length;
        submissions = [Math.ceil(total * 0.3), Math.ceil(total * 0.25), Math.ceil(total * 0.25), Math.ceil(total * 0.2)];
        approved = [Math.ceil(approvedTotal * 0.3), Math.ceil(approvedTotal * 0.25), Math.ceil(approvedTotal * 0.25), Math.ceil(approvedTotal * 0.2)];
    }

    if (throughputChart) throughputChart.destroy();

    const isDark = document.body.classList.contains('dark');
    const colorSubmissions = isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(15, 50, 96, 0.3)';
    const colorApproved = isDark ? '#3b82f6' : '#0F3260';
    const textColor = isDark ? '#94A3B8' : '#6B7280';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.05)';

    throughputChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Submissions',
                    data: submissions,
                    backgroundColor: colorSubmissions,
                    borderRadius: 4,
                    barPercentage: 0.6,
                },
                {
                    label: 'Approved',
                    data: approved,
                    backgroundColor: colorApproved,
                    borderRadius: 4,
                    barPercentage: 0.6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'bottom', 
                    labels: { color: textColor, font: { size: 11 } } 
                } 
            },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor }
                },
                y: { 
                    grid: { color: gridColor }, 
                    beginAtZero: true,
                    ticks: { color: textColor }
                }
            }
        }
    });
}

function buildDeptChart(students) {
    const canvas = document.getElementById('deptChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const deptCounts = { BSIT: 0, BTLED: 0, BFPT: 0 };
    students.forEach(s => {
        const course = s.course || '';
        if (course.includes('BSIT')) deptCounts.BSIT++;
        else if (course.includes('BTLED')) deptCounts.BTLED++;
        else if (course.includes('BFPT')) deptCounts.BFPT++;
    });

    const total = deptCounts.BSIT + deptCounts.BTLED + deptCounts.BFPT;
    const legendContainer = document.getElementById('dept-legend');
    
    const isDark = document.body.classList.contains('dark');
    const colors = isDark ? ['#3b82f6', '#f59e0b', '#10b981'] : ['#0F3260', '#D4AF37', '#43A047'];
    const borderColor = isDark ? '#111827' : 'white';
    
    const labels = ['BSIT', 'BTLED', 'BFPT'];
    const values = [deptCounts.BSIT, deptCounts.BTLED, deptCounts.BFPT];

    legendContainer.innerHTML = labels.map((l, i) => {
        const pct = total > 0 ? ((values[i] / total) * 100).toFixed(0) : 0;
        return `<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: ${colors[i]}; display: inline-block;"></span>
            ${l} (${pct}%)
        </span>`;
    }).join('');

    if (deptChart) deptChart.destroy();

    deptChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: borderColor,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: { legend: { display: false } }
        }
    });
}

// ── Export CSV (Excel) ───────────────────────────────────────────────
document.getElementById('btn-export-excel').addEventListener('click', function() {
    const studentsToExport = selectedStudentIds.size > 0
        ? allStudents.filter(s => selectedStudentIds.has(s.uid))
        : getFilteredStudents();

    if (studentsToExport.length === 0) {
        alert('No students to export.');
        return;
    }

    // Build CSV
    const headers = ['Last Name', 'First Name', 'M.I.', 'Student ID', 'Course', 'Year', 'Gender', 'Scholarship', 'Status', 'Scholar Year', 'Payouts', 'SA Number', 'Father Edu', 'Mother Edu'];
    const rows = studentsToExport.map(s => {
        let nameParts = { last: '', first: '', mi: '' };
        if (s.fullName) {
            const fn = s.fullName.trim();
            if (fn.includes(',')) {
                const parts = fn.split(',');
                const last = parts[0].trim();
                const restParts = parts.slice(1).join(',').trim().split(/\s+/);
                if (restParts.length > 1) {
                    const miPart = restParts.pop();
                    nameParts = { last, first: restParts.join(' ').trim(), mi: miPart.charAt(0).toUpperCase() };
                } else {
                    nameParts = { last, first: restParts.join(' '), mi: '' };
                }
            } else {
                const parts = fn.split(/\s+/);
                if (parts.length === 1) {
                    nameParts = { last: parts[0], first: '', mi: '' };
                } else if (parts.length === 2) {
                    nameParts = { last: parts[1], first: parts[0], mi: '' };
                } else {
                    const last = parts.pop();
                    const miPart = parts.pop();
                    nameParts = { last, first: parts.join(' ').trim(), mi: miPart.charAt(0).toUpperCase() };
                }
            }
        }

        const fam = s.familyDetails || {};
        return [
            nameParts.last,
            nameParts.first,
            nameParts.mi,
            s.studentId || '',
            s.course || '',
            s.year || '',
            s.gender || '',
            s.scholarshipProgram || s.scholarshipName || '',
            s.status || '',
            s.scholarYearLevel || '',
            s.payoutsReceived || 0,
            s.saNumber || fam.saNumber || '',
            fam.fatherEduStatus || '',
            fam.motherEduStatus || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Students_Data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Excel (CSV) Report generated successfully!');
});

// ── Export PDF (Print) ──────────────────────────────────────────────
document.getElementById('btn-export-pdf').addEventListener('click', function() {
    // Use browser print dialog
    const printContent = `
        <html>
        <head><title>Institutional Analysis Report</title>
        <style>
            body { font-family: 'Inter', sans-serif; padding: 32px; color: #333; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: 700; }
            .summary { display: flex; gap: 24px; margin: 16px 0; }
            .stat-box { flex: 1; padding: 12px; background: #f5f5f5; border-radius: 8px; text-align: center; }
            .stat-box h3 { margin: 0; font-size: 24px; }
            .stat-box p { margin: 4px 0 0; font-size: 11px; color: #666; }
        </style>
        </head>
        <body>
            <h1>ScholarDoc — Full Institutional Analysis Report</h1>
            <p style="color: #666; font-size: 12px;">Generated on ${new Date().toLocaleDateString()}</p>
            
            <div class="summary">
                <div class="stat-box"><h3>${allStudents.length}</h3><p>Total Students</p></div>
                <div class="stat-box"><h3>${allStudents.filter(s => (s.status || '').toLowerCase() === 'verified' || (s.status || '').toLowerCase() === 'approved').length}</h3><p>Verified</p></div>
                <div class="stat-box"><h3>${allStudents.filter(s => (s.status || '').toLowerCase() === 'pending').length}</h3><p>Pending</p></div>
            </div>

            <h2>Student Master List</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th><th>Student ID</th><th>Course</th><th>Year</th><th>Gender</th><th>Scholarship</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${allStudents.map(s => `
                        <tr>
                            <td>${s.fullName || ''}</td>
                            <td>${s.studentId || ''}</td>
                            <td>${s.course || ''}</td>
                            <td>${s.year || ''}</td>
                            <td>${s.gender || ''}</td>
                            <td>${s.scholarshipProgram || s.scholarshipName || ''}</td>
                            <td>${s.status || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
});

// ── Event Listeners ─────────────────────────────────────────────────
document.getElementById('rpt-search').addEventListener('input', applyFilters);
document.getElementById('rpt-filter-gender').addEventListener('change', applyFilters);
document.getElementById('rpt-filter-scholarship').addEventListener('change', applyFilters);
document.getElementById('rpt-filter-year').addEventListener('change', applyFilters);
document.getElementById('rpt-filter-father').addEventListener('change', applyFilters);
document.getElementById('rpt-filter-mother').addEventListener('change', applyFilters);

document.getElementById('throughput-timeframe').addEventListener('change', () => {
    buildThroughputChart(allStudents);
});

document.getElementById('rpt-select-all').addEventListener('change', function() {
    const filtered = getFilteredStudents();
    if (this.checked) {
        filtered.forEach(s => selectedStudentIds.add(s.uid));
    } else {
        selectedStudentIds.clear();
    }
    renderMasterTable(filtered);
    updateExcelBtnLabel();
});

// ── Auto-Fill Billing Logic ─────────────────────────────────────────
const modal = document.getElementById('autofill-modal');
const btnOpen = document.getElementById('btn-autofill-billing');
const btnClose = document.getElementById('btn-close-autofill');
const btnRunDirect = document.getElementById('btn-run-direct-annex5');
const directStatus = document.getElementById('autofill-direct-status');

const resultsContainer = document.getElementById('autofill-results-container');
const btnClear = document.getElementById('btn-clear-autofill');

let uploadedFile = null;
let parsedData = null;
let isAnnex5Template = false;
let processedResult = null;

btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
    resetAutofillState();
});

btnClose.addEventListener('click', () => {
    modal.style.display = 'none';
});

btnClear.addEventListener('click', () => {
    resetAutofillState();
});

function resetAutofillState() {
    uploadedFile = null;
    parsedData = null;
    isAnnex5Template = false;
    processedResult = null;
    resultsContainer.style.display = 'none';
    document.getElementById('autofill-direct-generator').style.display = 'block';
}

// Direct Generation
btnRunDirect.addEventListener('click', async () => {
    if (btnRunDirect.disabled) return;
    
    try {
        btnRunDirect.disabled = true;
        btnRunDirect.innerHTML = '<i class="icon-loader" style="font-size: 18px; animation: spin 1s linear infinite;"></i> Generating...';
        directStatus.style.display = 'inline';
        directStatus.textContent = 'Fetching template and querying database...';

        const studentsToProcess = selectedStudentIds.size > 0 
            ? allStudents.filter(s => selectedStudentIds.has(s.uid))
            : allStudents;

        const response = await fetch('/assets/Annex_5_TES_New_Form_2.xlsx');
        if (!response.ok) throw new Error('Could not load the government template file.');
        const templateBlob = await response.blob();
        
        directStatus.textContent = 'Compiling XML sheets...';
        
        const result = await BillingService.fillAnnex5Template(templateBlob, studentsToProcess);
        
        isAnnex5Template = true;
        processedResult = result.blob;
        uploadedFile = { name: 'Annex 5-TES New Form 2.xlsx', size: templateBlob.size };
        
        showResultsPanel(result);
        
    } catch (e) {
        console.error(e);
        alert('Direct generation failed: ' + e.message);
    } finally {
        btnRunDirect.disabled = false;
        btnRunDirect.innerHTML = '<i class="icon-sparkles" style="font-size: 18px;"></i> Auto-Fill Annex 5 Form';
        directStatus.style.display = 'none';
    }
});



function showResultsPanel(result) {
    document.getElementById('autofill-direct-generator').style.display = 'none';
    resultsContainer.style.display = 'flex';

    document.getElementById('autofill-file-name').textContent = 'Annex_5_TES_Billing_Form.xlsx';
    document.getElementById('autofill-file-icon').className = 'icon-file-spreadsheet';
    document.getElementById('autofill-file-details').textContent = 'Official Annex 5 Template populated.';
    
    document.getElementById('autofill-stats-panel').innerHTML = `
        <div style="flex: 1; padding: 20px; background: rgba(33, 150, 243, 0.05); border-radius: 12px; border: 1px solid rgba(33, 150, 243, 0.2);">
            <div style="color: #2196F3; font-size: 24px;"><i class="icon-users"></i></div>
            <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${result.totalCount}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">Total TES Scholars</div>
        </div>
        <div style="flex: 1; padding: 20px; background: rgba(76, 175, 80, 0.05); border-radius: 12px; border: 1px solid rgba(76, 175, 80, 0.2);">
            <div style="color: #4CAF50; font-size: 24px;"><i class="icon-arrow-up-right"></i></div>
            <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${result.continuingCount}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">Continuing (Form 2)</div>
        </div>
        <div style="flex: 1; padding: 20px; background: rgba(255, 152, 0, 0.05); border-radius: 12px; border: 1px solid rgba(255, 152, 0, 0.2);">
            <div style="color: #FF9800; font-size: 24px;"><i class="icon-sparkles"></i></div>
            <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${result.newCount}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">New Grantees (Form 3)</div>
        </div>
    `;

    document.getElementById('autofill-action-buttons').innerHTML = `
        <button id="btn-download-annex5" style="background: #4CAF50; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="icon-download"></i> Download Excel
        </button>
    `;

    document.getElementById('btn-download-annex5').addEventListener('click', () => {
        saveAs(processedResult, 'AutoFilled_Annex_5_TES_Billing_Form.xlsx');
    });

    document.getElementById('autofill-progress-text').textContent = 'Government Form Generated';

    document.getElementById('autofill-preview-container').innerHTML = `
        <div style="padding: 24px; border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 12px; background: rgba(76, 175, 80, 0.05);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="background: rgba(76, 175, 80, 0.2); padding: 8px; border-radius: 50%;">
                    <i class="icon-check-circle" style="color: #4CAF50; font-size: 20px;"></i>
                </div>
                <h4 style="margin: 0; font-size: 18px; font-weight: 700;">Annex 5 Billing Form Auto-Fill Complete</h4>
            </div>
            <p style="font-size: 14px; margin-bottom: 16px;">The official CHED billing Excel workbook has been dynamically compiled and populated. The following operations were completed successfully:</p>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                <div style="display: flex; gap: 8px;"><i class="icon-check" style="color: #4CAF50;"></i> Continuing TES scholars were successfully inserted into Form 2 (Row 42 onwards).</div>
                <div style="display: flex; gap: 8px;"><i class="icon-check" style="color: #4CAF50;"></i> New TES scholars were successfully inserted into Form 3 (Row 34 onwards).</div>
                <div style="display: flex; gap: 8px;"><i class="icon-check" style="color: #4CAF50;"></i> Student names were parsed and split into Last Name, Given Name, and Middle Initial.</div>
                <div style="display: flex; gap: 8px;"><i class="icon-check" style="color: #4CAF50;"></i> Total and formula cell ranges were preserved for official CHED verification.</div>
            </div>
        </div>
    `;
}


// Init
loadAllData();
