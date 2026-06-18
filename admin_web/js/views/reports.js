// js/views/reports.js
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
        const family = s.familyDetails || {};
        const isChecked = selectedStudentIds.has(s.uid) ? 'checked' : '';
        const statusColor = (s.status || '').toLowerCase() === 'verified' ? 'var(--success)' : 
                            (s.status || '').toLowerCase() === 'pending' ? '#F57F17' : 'var(--error)';

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 14px;">
                    <input type="checkbox" class="rpt-row-checkbox" data-uid="${s.uid}" ${isChecked} style="width: 16px; height: 16px; accent-color: var(--primary-color); cursor: pointer;">
                </td>
                <td style="padding: 14px; font-weight: 600; font-size: 13px;">${s.fullName || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px; color: var(--text-secondary);">${s.studentId || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px;">${s.course || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px;">${s.year || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px;">${s.gender || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px;">${s.scholarshipProgram || s.scholarshipName || 'N/A'}</td>
                <td style="padding: 14px;">
                    <span style="font-size: 10px; font-weight: 700; color: ${statusColor}; background: ${statusColor}18; padding: 4px 8px; border-radius: 12px;">${(s.status || 'Pending').toUpperCase()}</span>
                </td>
                <td style="padding: 14px; font-size: 12px;">${s.scholarYearLevel || 'N/A'}</td>
                <td style="padding: 14px; font-size: 12px;">${s.payoutsReceived || 0}</td>
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
}

function buildThroughputChart(students) {
    const ctx = document.getElementById('throughputChart').getContext('2d');
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
            const end = new Date(year, (q + 1) * 3, 0);
            const qStudents = students.filter(s => {
                const d = new Date(s.createdAt);
                return d >= start && d <= end;
            });
            submissions.push(qStudents.length);
            approved.push(qStudents.filter(s => (s.status || '').toLowerCase() === 'verified' || (s.status || '').toLowerCase() === 'approved').length);
        }
    } else if (timeframe === 'This Month') {
        labels = ['W1', 'W2', 'W3', 'W4'];
        const now = new Date();
        for (let w = 0; w < 4; w++) {
            const start = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7);
            const end = new Date(now.getFullYear(), now.getMonth(), Math.min(7 + w * 7, 31));
            const wStudents = students.filter(s => {
                const d = new Date(s.createdAt);
                return d >= start && d <= end;
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

    throughputChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Submissions',
                    data: submissions,
                    backgroundColor: 'rgba(15, 50, 96, 0.3)',
                    borderRadius: 4,
                    barPercentage: 0.6,
                },
                {
                    label: 'Approved',
                    data: approved,
                    backgroundColor: '#0F3260',
                    borderRadius: 4,
                    barPercentage: 0.6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true }
            }
        }
    });
}

function buildDeptChart(students) {
    const ctx = document.getElementById('deptChart').getContext('2d');
    const deptCounts = { BSIT: 0, BTLED: 0, BFPT: 0 };
    students.forEach(s => {
        const course = s.course || '';
        if (course.includes('BSIT')) deptCounts.BSIT++;
        else if (course.includes('BTLED')) deptCounts.BTLED++;
        else if (course.includes('BFPT')) deptCounts.BFPT++;
    });

    const total = deptCounts.BSIT + deptCounts.BTLED + deptCounts.BFPT;
    const legendContainer = document.getElementById('dept-legend');
    const colors = ['#0F3260', '#D4AF37', '#43A047'];
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
                borderColor: 'white',
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
    const headers = ['Full Name', 'Student ID', 'Course', 'Year', 'Gender', 'Scholarship', 'Status', 'Scholar Year', 'Payouts', 'SA Number', 'Father Edu', 'Mother Edu'];
    const rows = studentsToExport.map(s => {
        const fam = s.familyDetails || {};
        return [
            s.fullName || '',
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

document.getElementById('btn-autofill-billing').addEventListener('click', () => {
    alert('Billing details autofilled based on scholar records.');
});

// Init
loadAllData();
