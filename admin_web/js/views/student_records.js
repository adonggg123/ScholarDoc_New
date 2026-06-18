// js/views/student_records.js
const supabase = window.supabaseClient;

let allStudents = [];
let filteredStudents = [];

// Elements
const tableBody = document.getElementById('students-table-body');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterCourse = document.getElementById('filter-course');
const filterScholarship = document.getElementById('filter-scholarship');
const sortBy = document.getElementById('sort-by');
const pageInfo = document.getElementById('pagination-info');
const addStudentBtn = document.getElementById('add-student-btn');

// Modal Elements
const modal = document.getElementById('student-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');

async function loadStudents() {
    try {
        const { data, error } = await supabase.from('students').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        
        allStudents = data || [];
        applyFilters();
    } catch (e) {
        console.error('Error loading students:', e);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--error);">Failed to load data.</td></tr>`;
    }
}

function applyFilters() {
    const search = searchInput.value.toLowerCase();
    const status = filterStatus.value;
    const course = filterCourse.value;
    const scholarship = filterScholarship.value;
    const sort = sortBy.value;

    filteredStudents = allStudents.filter(s => {
        const matchSearch = (s.fullName || '').toLowerCase().includes(search) || 
                            (s.studentId || '').toLowerCase().includes(search) ||
                            (s.email || '').toLowerCase().includes(search);
        
        const matchStatus = status === 'All' || (s.status || '') === status;
        const matchCourse = course === 'All' || (s.course || '') === course;
        
        // Actually the scholarship program is sometimes stored inside 'scholarships' array or a string, let's assume it's in a single string or just ignore if complex
        const matchSchol = scholarship === 'All' || (s.scholarshipProgram || '').includes(scholarship);

        return matchSearch && matchStatus && matchCourse && matchSchol;
    });

    if (sort === 'Name (A-Z)') {
        filteredStudents.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    } else if (sort === 'Latest First') {
        filteredStudents.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    renderTable();
}

function getStatusBadge(status) {
    status = status || 'Pending';
    let color = '#F57F17';
    let bg = 'rgba(251, 192, 45, 0.1)';
    
    if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'verified') {
        color = 'var(--success, #43A047)';
        bg = 'rgba(67, 160, 71, 0.1)';
    } else if (status.toLowerCase() === 'rejected') {
        color = 'var(--error, #EF4444)';
        bg = 'rgba(239, 68, 68, 0.1)';
    }

    return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: ${color}; background: ${bg}; border: 1px solid ${color}40;"><span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${color};"></span>${status}</span>`;
}

function renderTable() {
    if (filteredStudents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <i class="icon-users" style="font-size: 32px; opacity: 0.5; display: block; margin-bottom: 8px;"></i>
            No students found matching your filters.
        </td></tr>`;
        pageInfo.textContent = '0 results';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    pageInfo.textContent = `Showing ${filteredStudents.length} results`;

    tableBody.innerHTML = filteredStudents.map(s => {
        const firstLetter = (s.fullName || 'U').charAt(0).toUpperCase();
        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                <td style="padding: 12px 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #FFC107; background: #FFF9E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; color: var(--primary-color); font-size: 14px;">
                            ${firstLetter}
                        </div>
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${s.fullName || 'Unknown'}</div>
                    </div>
                </td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.studentId || 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.course || 'N/A'} - ${s.year || 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${(s.scholarshipProgram && s.scholarshipProgram.length > 0) ? s.scholarshipProgram : 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.scholarYearLevel || 'N/A'}</td>
                <td style="padding: 12px;">${getStatusBadge(s.status)}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.saNumber || 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.birthdate || 'N/A'}</td>
                <td style="padding: 12px 20px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="view-btn" data-id="${s.uid}" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: #3B82F6; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-eye" style="font-size: 14px;"></i>
                        </button>
                        <button class="edit-btn" data-id="${s.uid}" style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); color: #22C55E; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-check-square" style="font-size: 14px;"></i>
                        </button>
                        <button class="delete-btn" data-id="${s.uid}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #EF4444; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-x-square" style="font-size: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach view listeners
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            const student = allStudents.find(st => st.uid === uid);
            if (student) showStudentModal(student);
        });
    });

    // Attach edit listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            window.editStudent(uid);
        });
    });

    // Attach delete listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            window.deleteStudent(uid);
        });
    });
}

const studentForm = document.getElementById('student-form');
const inpName = document.getElementById('inp-name');
const inpStudentId = document.getElementById('inp-studentid');
const inpBirthdate = document.getElementById('inp-birthdate');
const inpCourse = document.getElementById('inp-course');
const inpYear = document.getElementById('inp-year');
const inpGender = document.getElementById('inp-gender');
const inpSa = document.getElementById('inp-sa');
const inpScholarYear = document.getElementById('inp-scholar-year');
const inpPayouts = document.getElementById('inp-payouts');
const inpFatherEdu = document.getElementById('inp-father-edu');
const inpMotherEdu = document.getElementById('inp-mother-edu');

const addNotice = document.getElementById('add-notice');
const viewDetailsContainer = document.getElementById('view-details-container');
const dynamicDetails = document.getElementById('dynamic-details');

let modalMode = 'add'; // 'add', 'edit', 'view'
let currentEditUid = null;

addStudentBtn.addEventListener('click', () => {
    modalMode = 'add';
    modalTitle.textContent = 'Add New Student';
    document.getElementById('modal-icon').className = 'icon-user-plus';
    
    // Show form inputs
    Array.from(studentForm.querySelectorAll('input, select')).forEach(el => {
        el.parentElement.style.display = '';
        if(el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.tagName === 'LABEL') {
             el.parentElement.previousElementSibling.style.display = '';
        }
    });
    addNotice.style.display = 'flex';
    viewDetailsContainer.style.display = 'none';
    document.getElementById('modal-save-btn').style.display = 'block';
    document.getElementById('modal-save-btn').textContent = 'Add Student';
    
    studentForm.reset();
    modal.classList.remove('hidden');
});

studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('modal-save-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const familyDetails = {
            saNumber: inpSa.value.trim(),
            fatherEduStatus: inpFatherEdu.value,
            motherEduStatus: inpMotherEdu.value
        };

        const studentData = {
            fullName: inpName.value.trim(),
            studentId: inpStudentId.value.trim(),
            birthdate: inpBirthdate.value, // yyyy-mm-dd from input date
            course: inpCourse.value,
            year: inpYear.value,
            gender: inpGender.value,
            scholarYearLevel: inpScholarYear.value,
            payoutsReceived: parseInt(inpPayouts.value) || 0,
            familyDetails: familyDetails,
            saNumber: inpSa.value.trim() // store at root level too if used
        };

        if (modalMode === 'add') {
            studentData.status = 'Pending';
            studentData.createdAt = new Date().toISOString();
            
            // Generate a UID for the student to satisfy the not-null constraint
            studentData.uid = crypto.randomUUID();

            const { data: newDoc, error } = await supabase.from('students').insert([studentData]).select().single();
            if (error) throw error;

            // Log activity matching audit_logs schema
            await supabase.from('audit_logs').insert([{
                userName: 'Admin',
                role: 'Admin',
                action: `Added new student record: ${studentData.fullName}`,
                studentId: studentData.studentId,
                ipAddress: 'Web Browser'
            }]);

            alert(`${studentData.fullName} has been added successfully.`);
        } 
        else if (modalMode === 'edit') {
            const { error } = await supabase.from('students').update(studentData).eq('uid', currentEditUid);
            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                userName: 'Admin',
                role: 'Admin',
                action: `Updated student record: ${studentData.fullName}`,
                studentId: studentData.studentId,
                ipAddress: 'Web Browser'
            }]);

            alert(`${studentData.fullName} has been updated successfully.`);
        }

        hideModal();
        loadStudents();
    } catch (err) {
        console.error('Error saving student:', err);
        alert(`Failed to save student data: ${err.message || 'Please check your connection.'}`);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

function showStudentModal(student) {
    modalMode = 'view';
    modalTitle.textContent = 'Student Details';
    document.getElementById('modal-icon').className = 'icon-user';
    
    // Hide form inputs
    Array.from(studentForm.querySelectorAll('input, select')).forEach(el => {
        el.parentElement.style.display = 'none';
        if(el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.tagName === 'LABEL') {
             el.parentElement.previousElementSibling.style.display = 'none';
        }
    });
    addNotice.style.display = 'none';
    document.getElementById('modal-save-btn').style.display = 'none';
    
    // Show View details container
    viewDetailsContainer.style.display = 'flex';
    
    const fam = student.familyDetails || {};
    
    dynamicDetails.innerHTML = `
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Full Name</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.fullName || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Student ID</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.studentId || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Status</p>
            ${getStatusBadge(student.status)}
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Course & Year</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.course || 'N/A'} - ${student.year || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Email</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.email || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">SA Number</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.saNumber || fam.saNumber || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Birthdate</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.birthdate || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Gender</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.gender || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Year Became Scholar</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.scholarYearLevel || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Payouts Received</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${student.payoutsReceived || '0'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Father's Education</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${fam.fatherEduStatus || 'N/A'}</p>
        </div>
        <div>
            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 4px 0;">Mother's Education</p>
            <p style="font-weight: 600; margin: 0; font-size: 13px;">${fam.motherEduStatus || 'N/A'}</p>
        </div>
    `;

    // Inject action buttons at the bottom of dynamicDetails
    const actionsDiv = document.createElement('div');
    actionsDiv.style.gridColumn = "1 / -1";
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "12px";
    actionsDiv.style.marginTop = "16px";
    
    actionsDiv.innerHTML = `
        <button type="button" class="btn btn-outline" style="flex: 1;" onclick="editStudent('${student.uid}')">
            <i class="icon-edit"></i> Edit Record
        </button>
        <button type="button" class="btn btn-outline" style="flex: 1; color: var(--error); border-color: var(--error);" onclick="deleteStudent('${student.uid}')">
            <i class="icon-trash-2"></i> Delete
        </button>
    `;
    dynamicDetails.appendChild(actionsDiv);

    modal.classList.remove('hidden');
}

window.editStudent = function(uid) {
    const student = allStudents.find(s => s.uid === uid);
    if(!student) return;

    modalMode = 'edit';
    currentEditUid = uid;
    modalTitle.textContent = 'Edit Student';
    document.getElementById('modal-icon').className = 'icon-edit';

    // Show form inputs
    Array.from(studentForm.querySelectorAll('input, select')).forEach(el => {
        el.parentElement.style.display = '';
        if(el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.tagName === 'LABEL') {
             el.parentElement.previousElementSibling.style.display = '';
        }
    });
    addNotice.style.display = 'none';
    viewDetailsContainer.style.display = 'none';
    document.getElementById('modal-save-btn').style.display = 'block';
    document.getElementById('modal-save-btn').textContent = 'Save Changes';

    // Populate fields
    const fam = student.familyDetails || {};
    inpName.value = student.fullName || '';
    inpStudentId.value = student.studentId || '';
    // Input date expects yyyy-MM-dd
    if(student.birthdate) {
        // Simple conversion if format is mm/dd/yyyy
        let [m, d, y] = student.birthdate.split('/');
        if(y && m && d) {
             inpBirthdate.value = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else {
             inpBirthdate.value = student.birthdate;
        }
    }
    inpCourse.value = student.course || 'BSIT';
    inpYear.value = student.year || '1st Year';
    inpGender.value = student.gender || 'Male';
    inpSa.value = student.saNumber || fam.saNumber || '';
    inpScholarYear.value = student.scholarYearLevel || '1st Year';
    inpPayouts.value = student.payoutsReceived || '0';
    inpFatherEdu.value = fam.fatherEduStatus || 'Non-graduate';
    inpMotherEdu.value = fam.motherEduStatus || 'Non-graduate';
};

window.deleteStudent = async function(uid) {
    if(!confirm('Are you sure you want to permanently delete this student record?')) return;
    try {
        const { error } = await supabase.from('students').delete().eq('uid', uid);
        if(error) throw error;
        alert('Student deleted.');
        hideModal();
        loadStudents();
    } catch(err) {
        console.error('Error deleting student:', err);
        alert('Failed to delete student.');
    }
};

function hideModal() {
    modal.classList.add('hidden');
}

// Event Listeners
searchInput.addEventListener('input', applyFilters);
filterStatus.addEventListener('change', applyFilters);
filterCourse.addEventListener('change', applyFilters);
filterScholarship.addEventListener('change', applyFilters);
sortBy.addEventListener('change', applyFilters);

closeModalBtn.addEventListener('click', hideModal);
document.getElementById('modal-cancel-btn').addEventListener('click', hideModal);

// Init
loadStudents();
