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
        let res = await supabase.from('students').select('*').order('created_at', { ascending: false });
        if (res.error) {
            res = await supabase.from('students').select('*').order('createdAt', { ascending: false });
        }
        if (res.error) {
            res = await supabase.from('students').select('*');
        }
        if (res.error) throw res.error;
        
        allStudents = res.data || [];
        applyFilters();
    } catch (e) {
        console.error('Error loading students:', e);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--error);">Failed to load data: ${e.message || 'Check connection'}</td></tr>`;
    }
}

function applyFilters() {
    const search = (searchInput ? searchInput.value : '').toLowerCase();
    const status = filterStatus ? filterStatus.value : 'All';
    const course = filterCourse ? filterCourse.value : 'All';
    const scholarship = filterScholarship ? filterScholarship.value : 'All';
    const sort = sortBy ? sortBy.value : 'Name (A-Z)';

    filteredStudents = allStudents.filter(s => {
        const name = (s.full_name || s.fullName || '').toLowerCase();
        const id = (s.student_no || s.studentId || '').toLowerCase();
        const email = (s.email_address || s.email || '').toLowerCase();
        const matchSearch = !search || name.includes(search) || id.includes(search) || email.includes(search);
        
        const currentStatus = s.status || '';
        const matchStatus = status === 'All' || currentStatus.toLowerCase() === status.toLowerCase();

        const currentCourse = (s.program_name || s.course || '').toLowerCase();
        const matchCourse = course === 'All' || currentCourse.includes(course.toLowerCase());
        
        const currentSchol = (s.scholarship_name || s.scholarshipProgram || s.scholarshipName || 'CHED TES').toLowerCase();
        const matchSchol = scholarship === 'All' || currentSchol.includes(scholarship.toLowerCase());

        return matchSearch && matchStatus && matchCourse && matchSchol;
    });

    if (sort === 'Name (A-Z)') {
        filteredStudents.sort((a, b) => (a.full_name || a.fullName || '').localeCompare(b.full_name || b.fullName || ''));
    } else if (sort === 'Latest First') {
        filteredStudents.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
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
        const fullName = s.full_name || s.fullName || 'Unknown';
        const studentNo = s.student_no || s.studentId || 'N/A';
        const program = s.program_name || s.course || 'N/A';
        const yearLevel = s.year_level || s.year || 'N/A';
        const birthdate = s.date_of_birth || s.birthdate || 'N/A';
        const firstLetter = fullName.charAt(0).toUpperCase();
        const picUrl = s.profilePictureUrl || s.profileImageUrl || s.photoUrl || s.photoURL;
        
        const avatarHtml = picUrl 
            ? `<img src="${picUrl}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #FFC107; object-fit: cover; flex-shrink: 0;">`
            : `<div style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #FFC107; background: #FFF9E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; color: var(--primary-color); font-size: 14px;">
                 ${firstLetter}
               </div>`;

        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                <td style="padding: 12px 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${avatarHtml}
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${fullName}</div>
                    </div>
                </td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${studentNo}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${program} - ${yearLevel}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.scholarshipProgram || s.scholarshipName || 'CHED TES'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.scholarYearLevel || yearLevel || 'N/A'}</td>
                <td style="padding: 12px;">${getStatusBadge(s.status)}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.saNumber || 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${birthdate}</td>
                <td style="padding: 12px 20px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="view-btn" data-id="${s.uid}" title="View Details" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: #3B82F6; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-eye" style="font-size: 14px;"></i>
                        </button>
                        <button class="approve-btn" data-id="${s.uid}" title="Approve Student" style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); color: #22C55E; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-check-square" style="font-size: 14px;"></i>
                        </button>
                        <button class="reject-btn" data-id="${s.uid}" title="Reject Student" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #EF4444; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
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

    // Attach approve listeners
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            window.approveStudent(uid);
        });
    });

    // Attach reject listeners
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-id');
            window.rejectStudent(uid);
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
    
    // Ensure the form is visible
    studentForm.style.display = 'flex';
    
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
        let existingFamilyDetails = {};
        if (modalMode === 'edit') {
            const existingStudent = allStudents.find(s => s.uid === currentEditUid);
            if (existingStudent && existingStudent.familyDetails) {
                existingFamilyDetails = { ...existingStudent.familyDetails };
            }
        }

        const familyDetails = {
            ...existingFamilyDetails,
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
    
    // Hide the entire form instead of iterating inputs
    studentForm.style.display = 'none';
    
    // Show View details container
    viewDetailsContainer.style.display = 'flex';
    
    const fam = student.familyDetails || {};
    const picUrl = student.profilePictureUrl || student.profileImageUrl || student.photoUrl || student.photoURL;
    
    const profilePicHtml = picUrl 
        ? `<div style="position: relative; width: 80px; height: 80px; border-radius: 50%; padding: 4px; background: linear-gradient(135deg, #FFC107, #F57F17); box-shadow: 0 8px 16px rgba(245, 127, 23, 0.2);">
             <img src="${picUrl}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; border: 3px solid white; object-fit: cover; background: white;">
           </div>`
        : `<div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(15, 50, 96, 0.05); display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(15, 50, 96, 0.2);">
             <i class="icon-user" style="font-size: 32px; color: var(--primary-color);"></i>
           </div>`;

    const statusBadge = getStatusBadge(student.status);

        const fullName = student.full_name || student.fullName || 'Unknown';
        const studentNo = student.student_no || student.studentId || 'N/A';
        const program = student.program_name || student.course || 'N/A';
        const yearLevel = student.year_level || student.year || 'N/A';
        const birthdate = student.date_of_birth || student.birthdate || 'N/A';
        const email = student.email_address || student.email || 'N/A';
        const mobile = student.mobile_number || student.contactNumber || 'N/A';
        const civilStatus = student.civil_status || fam.civilStatus || 'Single';
        const religion = student.religion || fam.religion || 'N/A';
        const age = student.age || 'N/A';
        const fatherName = student.father_full_name || fam.fatherName || 'N/A';
        const fatherOcc = student.father_occupation || fam.fatherOccupation || 'N/A';
        const motherName = student.mother_full_name || fam.motherName || 'N/A';
        const motherOcc = student.mother_occupation || fam.motherOccupation || 'N/A';

        dynamicDetails.innerHTML = `
        <!-- Profile Header -->
        <div style="display: flex; align-items: center; gap: 20px; padding: 24px; background: linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.03)); border-radius: 16px; margin-bottom: 8px;">
            ${profilePicHtml}
            <div style="flex: 1;">
                <h3 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">${fullName}</h3>
                <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-secondary); font-weight: 500;">
                    <span style="display: flex; align-items: center; gap: 4px;"><i class="icon-hash" style="font-size: 14px;"></i> ${studentNo}</span>
                    <span style="width: 4px; height: 4px; border-radius: 50%; background: var(--border-color);"></span>
                    <span style="display: flex; align-items: center; gap: 4px;"><i class="icon-graduation-cap" style="font-size: 14px;"></i> ${program} - ${yearLevel}</span>
                </div>
            </div>
            <div>
                ${statusBadge}
            </div>
        </div>

        <!-- Information Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 0 8px;">
            
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; grid-column: 1 / -1;">
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 12px 0; font-weight: 600;">Personal Information</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Email Address</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${email}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Mobile / Contact</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${mobile}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Date of Birth</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${birthdate}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Age</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${age}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Gender</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${student.gender || 'N/A'}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Civil Status</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${civilStatus}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Religion</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${religion}</p>
                    </div>
                </div>
            </div>

            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 12px 0; font-weight: 600;">Scholarship & Academic Data</p>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Program Name</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${program}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Scholarship Program</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${student.scholarshipProgram || student.scholarshipName || 'CHED TES'}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">SA Number</p>
                        <p style="font-weight: 600; margin: 0; font-size: 14px; color: var(--text-primary); font-family: monospace;">${student.saNumber || fam.saNumber || 'N/A'}</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Year Level</p>
                            <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${yearLevel}</p>
                        </div>
                        <div>
                            <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Payouts</p>
                            <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${student.payoutsReceived || '0'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 12px 0; font-weight: 600;">Family Background</p>
                <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Father's Full Name</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${fatherName}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Father's Occupation</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${fatherOcc}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Mother's Full Name</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${motherName}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 2px 0;">Mother's Occupation</p>
                        <p style="font-weight: 600; margin: 0; font-size: 13px; color: var(--text-primary);">${motherOcc}</p>
                    </div>
                </div>
            </div>

            <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; grid-column: 1 / -1;">
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin: 0 0 12px 0; font-weight: 600;">Documents</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div>
                        <p style="font-size: 11px; color: var(--text-secondary); margin: 0 0 6px 0;">ATM Card Proof</p>
                        ${(student.atmCardUrl || (student.documents && student.documents.atmCardUrl))
                            ? `<a href="${student.atmCardUrl || student.documents.atmCardUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; color: #3B82F6; font-weight: 600; font-size: 13px; text-decoration: none; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.15); transition: all 0.2s;"><i class="icon-image" style="font-size: 16px;"></i> View Attached Document</a>` 
                            : '<div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.02); border-radius: 8px; border: 1px dashed var(--border-color); font-size: 13px; color: var(--text-secondary); font-weight: 500;"><i class="icon-file-x-2"></i> Not Submitted</div>'}
                    </div>
                </div>
            </div>

        </div>
    `;

    // Inject action buttons at the bottom of dynamicDetails
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "16px";
    actionsDiv.style.marginTop = "8px";
    actionsDiv.style.padding = "0 8px";
    
    actionsDiv.innerHTML = `
        <button type="button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 14px; color: white; background: #22C55E; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2); transition: transform 0.2s, box-shadow 0.2s;" onclick="approveStudent('${student.uid}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(34, 197, 94, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(34, 197, 94, 0.2)'">
            <i class="icon-check-circle"></i> Approve Student
        </button>
        <button type="button" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 14px; color: white; background: #EF4444; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); transition: transform 0.2s, box-shadow 0.2s;" onclick="rejectStudent('${student.uid}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.2)'">
            <i class="icon-x-circle"></i> Reject Application
        </button>
    `;
    dynamicDetails.appendChild(actionsDiv);

    if (window.lucide) window.lucide.createIcons();

    modal.classList.remove('hidden');
}

window.editStudent = function(uid) {
    const student = allStudents.find(s => s.uid === uid);
    if(!student) return;

    modalMode = 'edit';
    currentEditUid = uid;
    modalTitle.textContent = 'Edit Student';
    document.getElementById('modal-icon').className = 'icon-pencil';

    // Ensure the form is visible
    studentForm.style.display = 'flex';

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

    modal.classList.remove('hidden');
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

window.approveStudent = async function(uid) {
    if(!confirm('Are you sure you want to approve this student?')) return;
    try {
        const student = allStudents.find(s => s.uid === uid);
        const currentDocs = student?.documents || {};
        const updatedDocs = { 
            ...currentDocs, 
            saVerificationStatus: 'Approved',
            idValidationStatus: 'Approved' 
        };

        const { error } = await supabase.from('students').update({ 
            status: 'Approved',
            documents: updatedDocs,
            updatedAt: new Date().toISOString()
        }).eq('uid', uid);
        if(error) throw error;
        
        await supabase.from('audit_logs').insert([{
            userName: 'Admin',
            role: 'Admin',
            action: `Approved student record: ${student?.fullName || uid}`,
            studentId: student?.studentId || uid,
            ipAddress: 'Web Browser'
        }]);

        await supabase.from('notifications').insert([{
            studentId: uid,
            title: 'Application Approved',
            message: 'Congratulations! Your scholarship application has been officially approved.',
            type: 'success',
            isRead: false,
            timestamp: new Date().toISOString()
        }]);

        alert('Student approved successfully.');
        hideModal();
        loadStudents();
    } catch(err) {
        console.error('Error approving student:', err);
        alert('Failed to approve student.');
    }
};

window.rejectStudent = async function(uid) {
    if(!confirm('Are you sure you want to reject this student?')) return;
    try {
        const student = allStudents.find(s => s.uid === uid);
        const currentDocs = student?.documents || {};
        const updatedDocs = { 
            ...currentDocs, 
            saVerificationStatus: 'Rejected',
            idValidationStatus: 'Rejected' 
        };

        const { error } = await supabase.from('students').update({ 
            status: 'Rejected',
            documents: updatedDocs,
            updatedAt: new Date().toISOString()
        }).eq('uid', uid);
        if(error) throw error;
        
        await supabase.from('audit_logs').insert([{
            userName: 'Admin',
            role: 'Admin',
            action: `Rejected student record: ${student?.fullName || uid}`,
            studentId: student?.studentId || uid,
            ipAddress: 'Web Browser'
        }]);

        await supabase.from('notifications').insert([{
            studentId: uid,
            title: 'Application Rejected',
            message: 'We regret to inform you that your scholarship application has been rejected.',
            type: 'error',
            isRead: false,
            timestamp: new Date().toISOString()
        }]);

        alert('Student rejected.');
        hideModal();
        loadStudents();
    } catch(err) {
        console.error('Error rejecting student:', err);
        alert('Failed to reject student.');
    }
};

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
