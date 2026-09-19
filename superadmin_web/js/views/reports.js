// js/views/reports.js
import { BillingService } from '../services/billing_service.js';
import { initMasterlistImport } from './masterlist_import.js';
import { StudentSyncService } from '../services/student_sync_service.js';
const supabase = window.supabaseClient;

window.__reportsHostingImport = true;

let allStudents = [];
let selectedStudentIds = new Set();
let throughputChart = null;
let deptChart = null;

// ── Segmented Control / Tab Switching ──────────────────────────────
window.switchReportTab = function (tabName) {
    const btnMasterlist = document.getElementById('seg-btn-masterlist');
    const btnImport = document.getElementById('seg-btn-import');
    const paneMasterlist = document.getElementById('report-pane-masterlist');
    const paneImport = document.getElementById('report-pane-import');
    const title = document.getElementById('reports-section-title');
    const subtitle = document.getElementById('reports-section-subtitle');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const portalBadge = document.getElementById('import-portal-badge');

    if (tabName === 'import') {
        if (btnMasterlist) btnMasterlist.classList.remove('active');
        if (btnImport) btnImport.classList.add('active');
        if (paneMasterlist) paneMasterlist.style.display = 'none';
        if (paneImport) paneImport.style.display = 'flex';
        if (title) title.textContent = 'New Grantees Masterlist Import';
        if (subtitle) subtitle.textContent = 'Upload new scholarship grantee lists (PDF, DOCX, XLSX, CSV) to register them in the masterlist table for Admin verification and Annex 5 TES generation.';
        if (btnExportExcel) btnExportExcel.style.display = 'none';
        if (portalBadge) portalBadge.style.display = 'inline-flex';
    } else {
        if (btnImport) btnImport.classList.remove('active');
        if (btnMasterlist) btnMasterlist.classList.add('active');
        if (paneImport) paneImport.style.display = 'none';
        if (paneMasterlist) paneMasterlist.style.display = 'flex';
        if (title) title.textContent = 'Student Master List Records';
        if (subtitle) subtitle.textContent = 'Comprehensive institutional database of all verified and registered students.';
        if (btnExportExcel) btnExportExcel.style.display = 'inline-flex';
        if (portalBadge) portalBadge.style.display = 'none';
        loadAllData();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
};


// ── Load All Data ───────────────────────────────────────────────────
async function loadAllData() {
    const body = document.getElementById('rpt-master-body');
    if (body && allStudents.length === 0) {
        body.innerHTML = `<tr><td colspan="22" style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="icon-loader" style="font-size: 24px; animation: spin 1s linear infinite; display: inline-block; margin-bottom: 8px;"></i><div>Loading student master list records...</div></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
    try {
        allStudents = await StudentSyncService.loadAndSyncStudents();
        renderMasterTable(allStudents);
        buildCharts(allStudents);
        populateScholarshipFilter(allStudents);
    } catch (e) {
        console.error('Error loading students for reports:', e);
        if (body) body.innerHTML = `<tr><td colspan="22" style="text-align: center; padding: 20px; color: var(--error);">Failed to load student data: ${e.message || e}</td></tr>`;
    }
}

// ── Populate Scholarship Filter ─────────────────────────────────────
function populateScholarshipFilter(students) {
    const set = new Set();
    students.forEach(s => {
        const name = s.scholarship_name || s.scholarshipProgram || s.scholarshipName;
        if (name) set.add(name);
    });
    const sel = document.getElementById('rpt-filter-scholarship');
    if (!sel) return;
    sel.innerHTML = '<option>All Scholarships</option>';
    set.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

// ── Filter Logic ────────────────────────────────────────────────────
function getFilteredStudents() {
    const query = (document.getElementById('rpt-search')?.value || '').toLowerCase().trim();
    const gender = document.getElementById('rpt-filter-gender')?.value || 'All Genders';
    const scholarship = document.getElementById('rpt-filter-scholarship')?.value || 'All Scholarships';
    const year = document.getElementById('rpt-filter-year')?.value || 'All Year Levels';
    const fatherEdu = document.getElementById('rpt-filter-father')?.value || 'All (Father)';
    const motherEdu = document.getElementById('rpt-filter-mother')?.value || 'All (Mother)';

    return allStudents.filter(s => {
        const family = s.familyDetails || {};
        const name = (s.full_name || s.fullName || '').toLowerCase();
        const id = (s.student_no || s.studentId || '').toLowerCase();
        const email = (s.email_address || s.email || '').toLowerCase();
        const program = (s.program_name || s.course || '').toLowerCase();

        const matchSearch = !query || name.includes(query) || id.includes(query) || email.includes(query) || program.includes(query);
        const matchGender = gender === 'All Genders' || (s.gender || '').toLowerCase() === gender.toLowerCase();
        
        const sSchol = (s.scholarship_name || s.scholarshipProgram || s.scholarshipName || 'CHED TES').toLowerCase();
        const matchScholarship = scholarship === 'All Scholarships' || sSchol.includes(scholarship.toLowerCase());
        
        const sYear = String(s.scholarYearLevel || s.year_level || s.year || '');
        const matchYear = year === 'All Year Levels' || sYear === year || (year.charAt(0) === sYear.charAt(0));

        const sFatherEdu = (s.father_occupation || family.fatherEduStatus || '').toLowerCase();
        const matchFather = fatherEdu === 'All (Father)' || !fatherEdu || sFatherEdu.includes(fatherEdu.toLowerCase());

        const sMotherEdu = (s.mother_occupation || family.motherEduStatus || '').toLowerCase();
        const matchMother = motherEdu === 'All (Mother)' || !motherEdu || sMotherEdu.includes(motherEdu.toLowerCase());

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
    if (!body) return;
    if (students.length === 0) {
        body.innerHTML = `<tr><td colspan="22" style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="icon-users" style="font-size: 28px; opacity: 0.5; display: block; margin-bottom: 8px;"></i>No students match filters.</td></tr>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    body.innerHTML = students.map(s => {
        let nameParts = { last: 'N/A', first: 'N/A', mi: '' };
        const fn = (s.full_name || s.fullName || '').trim();
        if (fn) {
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
        const isChecked = selectedStudentIds.has(s.uid || s.id) ? 'checked' : '';
        const statusColor = (s.status || '').toLowerCase() === 'verified' ? 'var(--success)' :
            (s.status || '').toLowerCase() === 'approved' ? 'var(--success)' :
                (s.status || '').toLowerCase() === 'pending' ? '#FBC02D' : 'var(--error)';

        const studentNo = s.student_no || s.studentId || 'N/A';
        const email = s.email_address || s.email || 'N/A';
        const birthdate = s.date_of_birth || s.birthdate || 'N/A';
        const program = s.program_name || s.course || 'N/A';
        const yr = (s.year_level || s.year || '').split(' ')[0] || '';
        const phone = s.mobile_number || s.contactNumber || 'N/A';
        const fatherName = s.father_full_name || family.fatherName || 'N/A';
        const motherName = s.mother_full_name || family.motherName || 'N/A';
        const religion = s.religion || family.religion || 'N/A';

        return `
            <tr style="border-bottom: 1px solid var(--border-color); vertical-align: middle;">
                <td style="padding: 14px;">
                    <input type="checkbox" class="rpt-row-checkbox" data-uid="${s.uid || s.id}" ${isChecked} style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;">
                </td>
                <td style="padding: 14px; font-size: 13px; color: var(--text-secondary);">${studentNo}</td>
                <td style="padding: 14px; font-weight: 600; font-size: 13px;">
                    ${nameParts.last}
                </td>
                <td style="padding: 14px; font-size: 13px;">${nameParts.first}</td>
                <td style="padding: 14px; font-size: 13px;">${nameParts.mi}</td>
                <td style="padding: 14px; font-size: 13px;">${email}</td>
                <td style="padding: 14px; font-size: 13px;">${birthdate}</td>
                <td style="padding: 14px; font-size: 13px;">${s.gender || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${program}</td>
                <td style="padding: 14px; font-size: 13px;">${yr} - ${s.section || ''}</td>
                <td style="padding: 14px; font-size: 13px;">${s.scholarship_name || s.scholarshipProgram || s.scholarshipName || 'CHED TES'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.scholarYearLevel || yr || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${s.payoutsReceived || 0}</td>
                <td style="padding: 14px; font-size: 13px;">${phone}</td>
                <td style="padding: 14px;">
                    <span style="font-size: 11px; font-weight: 700; color: ${statusColor}; background: ${statusColor}18; padding: 4px 10px; border-radius: 16px;">${s.status || 'Pending'}</span>
                </td>
                <td style="padding: 14px; font-size: 13px;">${fatherName}</td>
                <td style="padding: 14px; font-size: 13px;">${s.father_occupation || family.fatherEduStatus || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${motherName}</td>
                <td style="padding: 14px; font-size: 13px;">${s.mother_occupation || family.motherEduStatus || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${family.yearlyIncome || 'N/A'}</td>
                <td style="padding: 14px; font-size: 13px;">${religion}</td>
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
                const dateStr = s.created_at || s.createdAt;
                if (!dateStr) return true; // Include if date missing
                const d = new Date(dateStr);
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
                const dateStr = s.created_at || s.createdAt;
                if (!dateStr) return true;
                const d = new Date(dateStr);
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
        const course = (s.program_name || s.course || '').toLowerCase();
        if (course.includes('bsit') || course.includes('information technology') || course.includes('computer')) deptCounts.BSIT++;
        else if (course.includes('btled') || course.includes('livelihood') || course.includes('education')) deptCounts.BTLED++;
        else if (course.includes('bfpt') || course.includes('food processing') || course.includes('food technology')) deptCounts.BFPT++;
        else deptCounts.BSIT++;
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
document.getElementById('btn-export-excel').addEventListener('click', function () {
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
        const fn = (s.full_name || s.fullName || '').trim();
        if (fn) {
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
            s.student_no || s.studentId || '',
            s.program_name || s.course || '',
            s.year_level || s.year || '',
            s.gender || '',
            s.scholarship_name || s.scholarshipProgram || s.scholarshipName || '',
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
document.getElementById('btn-export-pdf').addEventListener('click', function () {
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
                            <td>${s.full_name || s.fullName || ''}</td>
                            <td>${s.student_no || s.studentId || ''}</td>
                            <td>${s.program_name || s.course || ''}</td>
                            <td>${s.year_level || s.year || ''}</td>
                            <td>${s.gender || ''}</td>
                            <td>${s.scholarship_name || s.scholarshipProgram || s.scholarshipName || ''}</td>
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

document.getElementById('rpt-select-all').addEventListener('change', function () {
    const filtered = getFilteredStudents();
    if (this.checked) {
        filtered.forEach(s => selectedStudentIds.add(s.uid));
    } else {
        selectedStudentIds.clear();
    }
    renderMasterTable(filtered);
    updateExcelBtnLabel();
});

const rptRefreshBtn = document.getElementById('rpt-refresh');
if (rptRefreshBtn) {
    rptRefreshBtn.addEventListener('click', () => {
        loadAllData();
        if (window.showToast) window.showToast('Student master list refreshed', 'refresh-cw');
    });
}

// ── Initialization ──────────────────────────────────────────────────
initMasterlistImport();
loadAllData();

// Check if a specific tab was requested (e.g. from Dashboard or link), otherwise default to 'import'
if (window.requestedReportTab === 'masterlist') {
    window.switchReportTab('masterlist');
    window.requestedReportTab = null;
} else {
    window.switchReportTab('import');
    window.requestedReportTab = null;
}


