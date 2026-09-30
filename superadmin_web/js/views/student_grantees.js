// js/views/student_records.js
import { StudentSyncService } from '../services/student_sync_service.js';
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
const filterAy = document.getElementById('filter-ay');
const ayDisplay = document.getElementById('ay-display');
const refreshStudentsBtn = document.getElementById('refresh-students-btn');

// Modal Elements
const modal = document.getElementById('student-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');

async function loadStudents() {
    try {
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="icon-loader" style="font-size: 24px; animation: spin 1s linear infinite; display: inline-block; margin-bottom: 8px;"></i>
                <div>Loading student records...</div>
            </td></tr>`;
            if (window.lucide) window.lucide.createIcons();
        }

        allStudents = await StudentSyncService.loadAndSyncStudents();
        applyFilters();
    } catch (e) {
        console.error('Error loading students:', e);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--error);">Failed to load data: ${e.message || 'Check connection'}</td></tr>`;
        }
    }
}

function applyFilters() {
    const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const status = filterStatus ? filterStatus.value : 'All';
    const course = filterCourse ? filterCourse.value : 'All';
    const scholarship = filterScholarship ? filterScholarship.value : 'All';
    const sort = sortBy ? sortBy.value : 'Name (A-Z)';

    filteredStudents = allStudents.filter(s => {
        const name = (s.full_name || s.fullName || '').toLowerCase();
        const id = (s.student_no || s.studentId || '').toLowerCase();
        const email = (s.email_address || s.email || '').toLowerCase();
        const prog = (s.program_name || s.course || '').toLowerCase();
        const matchSearch = !search || name.includes(search) || id.includes(search) || email.includes(search) || prog.includes(search);

        const currentStatus = (s.status || '').toLowerCase();
        let matchStatus = status === 'All';
        if (!matchStatus) {
            const stLower = status.toLowerCase();
            if (stLower === 'no submission yet') {
                matchStatus = currentStatus === 'no submission yet' || currentStatus === 'pending' || !currentStatus;
            } else if (stLower === 'submitted') {
                matchStatus = currentStatus === 'submitted' || currentStatus === 'under review' || currentStatus === 'pending validation' || currentStatus === 'pending review' || currentStatus === 'late submission';
            } else if (stLower === 'approved' || stLower === 'verified') {
                matchStatus = currentStatus === 'verified' || currentStatus === 'approved';
            } else if (stLower === 'rejected') {
                matchStatus = currentStatus === 'rejected';
            } else {
                matchStatus = currentStatus === stLower;
            }
        }

        const currentCourse = prog;
        let matchCourse = course === 'All';
        if (!matchCourse) {
            const cLower = course.toLowerCase();
            if (currentCourse.includes(cLower)) {
                matchCourse = true;
            } else if (cLower === 'bsit' && (currentCourse.includes('information technology') || currentCourse.includes('computer'))) {
                matchCourse = true;
            } else if (cLower === 'bfpt' && (currentCourse.includes('food processing') || currentCourse.includes('food technology'))) {
                matchCourse = true;
            } else if (cLower === 'btled' && (currentCourse.includes('technology and livelihood') || currentCourse.includes('livelihood') || currentCourse.includes('education'))) {
                matchCourse = true;
            }
        }

        const currentSchol = (s.scholarship_name || s.scholarshipProgram || s.scholarshipName || 'CHED TES').toLowerCase();
        const matchSchol = scholarship === 'All' || currentSchol.includes(scholarship.toLowerCase());

        const ay = filterAy ? filterAy.value : 'All';
        let matchAy = ay === 'All';
        if (!matchAy) {
            const sAy = (s.academic_year || s.academicYear || '').toLowerCase();
            const sSem = (s.semester || '').toLowerCase();
            if (ay.includes('2024-2025') && sAy.includes('2024-2025')) {
                if (ay.includes('1st') && (sSem.includes('1st') || !sSem)) matchAy = true;
                else if (ay.includes('2nd') && sSem.includes('2nd')) matchAy = true;
                else if (!ay.includes('Sem')) matchAy = true;
            } else if (ay.includes('2023-2024') && sAy.includes('2023-2024')) {
                if (ay.includes('1st') && (sSem.includes('1st') || !sSem)) matchAy = true;
                else if (ay.includes('2nd') && sSem.includes('2nd')) matchAy = true;
                else if (!ay.includes('Sem')) matchAy = true;
            } else {
                matchAy = sAy.includes(ay.toLowerCase());
            }
        }

        return matchSearch && matchStatus && matchCourse && matchSchol && matchAy;
    });

    if (sort === 'Name (A-Z)') {
        filteredStudents.sort((a, b) => (a.full_name || a.fullName || '').localeCompare(b.full_name || b.fullName || ''));
    } else if (sort === 'Latest First') {
        filteredStudents.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
    }

    renderTable();
}

function getStatusBadge(status) {
    status = status || 'No Submission Yet';
    const sLower = status.toLowerCase();
    let color = '#64748B'; // slate
    let bg = 'rgba(100, 116, 139, 0.12)';
    let border = 'rgba(100, 116, 139, 0.3)';

    if (sLower === 'approved' || sLower === 'verified') {
        color = '#059669'; // emerald
        bg = 'rgba(16, 185, 129, 0.12)';
        border = 'rgba(16, 185, 129, 0.35)';
    } else if (sLower === 'rejected') {
        color = '#DC2626'; // red
        bg = 'rgba(239, 68, 68, 0.12)';
        border = 'rgba(239, 68, 68, 0.35)';
    } else if (sLower === 'submitted' || sLower === 'under review' || sLower === 'pending validation' || sLower === 'pending review') {
        color = '#2563EB'; // vibrant blue
        bg = 'rgba(37, 99, 235, 0.12)';
        border = 'rgba(37, 99, 235, 0.35)';
    } else if (sLower === 'late submission') {
        color = '#EA580C'; // orange
        bg = 'rgba(234, 88, 12, 0.12)';
        border = 'rgba(234, 88, 12, 0.35)';
    } else if (sLower === 'no submission yet' || sLower === 'pending' || sLower.includes('no submission')) {
        color = '#64748B'; // neutral slate
        bg = 'rgba(100, 116, 139, 0.12)';
        border = 'rgba(100, 116, 139, 0.3)';
    }

    return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11.5px; font-weight: 700; color: ${color}; background: ${bg}; border: 1px solid ${border}; white-space: nowrap; flex-shrink: 0;"><span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>${status}</span>`;
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

        const isApproved = (s.status || '').toLowerCase() === 'approved' || (s.status || '').toLowerCase() === 'verified';

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
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.scholarship_name || s.scholarshipProgram || s.scholarshipName || 'CHED TES'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.scholarYearLevel || yearLevel || 'N/A'}</td>
                <td style="padding: 12px;">${getStatusBadge(s.status)}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${s.saNumber || 'N/A'}</td>
                <td style="padding: 12px; font-size: 13px; color: var(--text-secondary);">${birthdate}</td>
                <td style="padding: 12px 20px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="view-btn" data-id="${s.uid}" title="View Details" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: #3B82F6; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="icon-eye" style="font-size: 14px;"></i>
                        </button>
                        <button class="approve-btn" data-id="${s.uid}" title="${isApproved ? 'Approved Scholar' : 'Approve Student'}" style="background: ${isApproved ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)'}; border: 1px solid rgba(34, 197, 94, 0.3); color: #22C55E; border-radius: 6px; padding: 4px 6px; cursor: pointer;">
                            <i class="${isApproved ? 'icon-check-circle' : 'icon-check-square'}" style="font-size: 14px;"></i>
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
    const subTitleEl = document.getElementById('modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = 'Fill in the information below';
    document.getElementById('modal-icon').className = 'icon-user-plus';
    const iconContainer = document.getElementById('modal-icon-container');
    if (iconContainer) iconContainer.style.background = 'rgba(15, 50, 96, 0.08)';

    const modalCard = document.getElementById('student-modal-card') || document.querySelector('#student-modal .card');
    if (modalCard) {
        modalCard.style.maxWidth = '560px';
        modalCard.style.padding = '24px';
    }

    // Ensure the form is visible
    studentForm.style.display = 'flex';

    // Show form inputs
    Array.from(studentForm.querySelectorAll('input, select')).forEach(el => {
        el.parentElement.style.display = '';
        if (el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.tagName === 'LABEL') {
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

        const fullNameClean = inpName.value.trim();
        const studentIdClean = inpStudentId.value.trim();
        const birthdateClean = inpBirthdate.value;
        const courseClean = inpCourse.value;
        const yearClean = inpYear.value;
        const genderClean = inpGender.value;
        const saClean = inpSa.value.trim();

        const studentData = {
            fullName: fullNameClean,
            full_name: fullNameClean,
            studentId: studentIdClean,
            student_no: studentIdClean,
            birthdate: birthdateClean,
            date_of_birth: birthdateClean,
            course: courseClean,
            program_name: courseClean,
            year: yearClean,
            year_level: yearClean,
            gender: genderClean,
            scholarYearLevel: inpScholarYear.value,
            payoutsReceived: parseInt(inpPayouts.value) || 0,
            familyDetails: familyDetails,
            saNumber: saClean,
            sa_number: saClean,
            role: 'student'
        };

        if (modalMode === 'add') {
            // Check if student is already registered in the system (school_students)
            let isRegistered = false;
            try {
                const { data: ssCheck } = await supabase
                    .from('school_students')
                    .select('*')
                    .or(`student_no.eq.${studentIdClean},full_name.ilike.%${fullNameClean}%`)
                    .limit(1);
                if (ssCheck && ssCheck.length > 0) isRegistered = true;
            } catch (_) {}

            const autoStatus = 'No Submission Yet';
            studentData.status = autoStatus;
            studentData.saVerificationStatus = autoStatus;
            studentData.sa_verification_status = autoStatus;
            studentData.idValidationStatus = autoStatus;
            studentData.id_validation_status = autoStatus;
            studentData.documents = {
                saVerificationStatus: autoStatus,
                idValidationStatus: autoStatus,
                saNumber: saClean
            };
            studentData.admin_remarks = isRegistered ? 'Automatically approved as confirmed scholar grantee.' : '';
            studentData.createdAt = new Date().toISOString();
            studentData.created_at = new Date().toISOString();
            studentData.uid = crypto.randomUUID();

            const { data: newDoc, error } = await supabase.from('student_grantees').insert([studentData]).select().single();
            if (error) throw error;

            // Log activity matching audit_logs schema
            await supabase.from('audit_logs').insert([{
                userName: 'Admin',
                role: 'Admin',
                action: isRegistered 
                    ? `Added and auto-approved registered student grantee: ${studentData.fullName}` 
                    : `Added new student record: ${studentData.fullName}`,
                studentId: studentData.studentId,
                ipAddress: 'Web Browser'
            }]);

            if (isRegistered) {
                alert(`${studentData.fullName} is registered in the system and has been automatically approved as a scholar.`);
            } else {
                alert(`${studentData.fullName} has been added successfully.`);
            }
        }
        else if (modalMode === 'edit') {
            studentData.updatedAt = new Date().toISOString();
            studentData.updated_at = new Date().toISOString();
            const { error } = await supabase.from('student_grantees').update(studentData).eq('uid', currentEditUid);
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
    const subTitleEl = document.getElementById('modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = 'Comprehensive Grantee Profile & Documentary Status';

    const modalIconEl = document.getElementById('modal-icon');
    if (modalIconEl) modalIconEl.className = 'icon-user-check';

    const iconContainer = document.getElementById('modal-icon-container');
    if (iconContainer) iconContainer.style.background = 'linear-gradient(135deg, rgba(15, 50, 96, 0.1), rgba(59, 130, 246, 0.15))';

    // Expand modal to wide, comfortable desktop dimensions
    const modalCard = document.getElementById('student-modal-card') || document.querySelector('#student-modal .card');
    if (modalCard) {
        modalCard.style.maxWidth = '840px';
        modalCard.style.padding = '28px 32px';
    }

    // Hide input form
    studentForm.style.display = 'none';

    // Show View details container
    viewDetailsContainer.style.display = 'flex';

    const fam = student.familyDetails || {};
    const picUrl = student.profilePictureUrl || student.profileImageUrl || student.photoUrl || student.photoURL;

    const fullName = student.full_name || student.fullName || 'Unknown Student';
    const studentNo = student.student_no || student.studentId || 'N/A';
    const program = student.program_name || student.course || 'BSIT';
    const yearLevel = student.year_level || student.year || '1';
    const birthdate = student.date_of_birth || student.birthdate || 'N/A';
    const email = student.email_address || student.email || 'N/A';
    const mobile = student.mobile_number || student.contactNumber || 'N/A';
    const civilStatus = student.civil_status || fam.civilStatus || 'Single';
    const religion = student.religion || fam.religion || 'N/A';
    const age = student.age || 'N/A';
    const scholarshipName = student.scholarship_name || student.scholarshipProgram || student.scholarshipName || 'CHED TES';
    const saNumber = student.sa_number || student.saNumber || fam.saNumber || 'N/A';
    const payouts = student.payoutsReceived || student.payouts || '0';

    const fatherName = student.father_full_name || fam.fatherName || 'N/A';
    const fatherOcc = student.father_occupation || fam.fatherOccupation || 'N/A';
    const motherName = student.mother_full_name || fam.motherName || 'N/A';
    const motherOcc = student.mother_occupation || fam.motherOccupation || 'N/A';

    // Documents resolution
    const docs = student.documents || {};
    const atmUrl = student.atmCardUrl || student.atm_card_url || docs.atmCardUrl || docs.atm_card_url;
    const frontUrl = student.idFrontUrl || student.id_front_url || docs.idFrontUrl || docs.id_front_url;
    const backUrl = student.idBackUrl || student.id_back_url || docs.idBackUrl || docs.id_back_url;
    const pdfUrl = student.submissionPdfUrl || student.submission_pdf_url || docs.submissionPdfUrl || docs.submission_pdf_url;

    // Avatar generation with aspect-ratio protection and initial fallback
    const nameParts = fullName.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.length >= 2 
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : (nameParts[0] ? nameParts[0].slice(0, 2).toUpperCase() : 'GD');

    const profilePicHtml = picUrl
        ? `<div style="position: relative; width: 80px; height: 80px; min-width: 80px; min-height: 80px; aspect-ratio: 1/1; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, #F59E0B, #D97706); box-shadow: 0 4px 14px rgba(217, 119, 6, 0.25); flex-shrink: 0;">
             <img src="${picUrl}" alt="${fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #FFFFFF; display: block;">
           </div>`
        : `<div style="width: 80px; height: 80px; min-width: 80px; min-height: 80px; aspect-ratio: 1/1; border-radius: 50%; background: linear-gradient(135deg, #0F3260 0%, #1E3A8A 100%); color: #FFFFFF; font-size: 26px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(15, 50, 96, 0.2); border: 3px solid #FFFFFF; flex-shrink: 0; letter-spacing: 0.5px;">
             ${initials}
           </div>`;

    const statusBadge = getStatusBadge(student.status);
    const isApproved = (student.status || '').toLowerCase() === 'approved' || (student.status || '').toLowerCase() === 'verified';
    const isNoSubmission = (student.status || '').toLowerCase().includes('no submission') || (student.status || '').toLowerCase() === 'pending' || !student.status;

    // Helper to render doc item
    function renderDocItem(title, url, iconName = 'icon-image') {
        if (url) {
            return `
                <div style="background: var(--card-bg, #FFFFFF); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); color: #2563EB; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="${iconName}" style="font-size: 15px;"></i>
                        </div>
                        <div style="min-width: 0;">
                            <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; display: block;">${title}</span>
                            <span style="font-size: 12px; font-weight: 600; color: #16A34A; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="icon-check-circle" style="font-size: 12px;"></i> Attached
                            </span>
                        </div>
                    </div>
                    <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #2563EB; background: rgba(37, 99, 235, 0.08); text-decoration: none; border: 1px solid rgba(37, 99, 235, 0.2); transition: background 0.2s; white-space: nowrap;" onmouseover="this.style.background='rgba(37,99,235,0.15)'" onmouseout="this.style.background='rgba(37,99,235,0.08)'">
                        <span>View</span>
                        <i class="icon-external-link" style="font-size: 12px;"></i>
                    </a>
                </div>
            `;
        }
        return `
            <div style="background: rgba(0, 0, 0, 0.015); border: 1px dashed var(--border-color, #E2E8F0); border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(100, 116, 139, 0.06); color: #94A3B8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="${iconName}" style="font-size: 15px;"></i>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; display: block;">${title}</span>
                        <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">No file uploaded</span>
                    </div>
                </div>
                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #64748B; background: rgba(100, 116, 139, 0.08); white-space: nowrap;">
                    <i class="icon-clock" style="font-size: 11px;"></i> Missing
                </span>
            </div>
        `;
    }

    dynamicDetails.innerHTML = `
        <!-- Profile Hero Banner -->
        <div style="display: flex; align-items: center; gap: 20px; padding: 22px 24px; background: linear-gradient(135deg, rgba(15, 50, 96, 0.03) 0%, rgba(59, 130, 246, 0.06) 100%); border: 1px solid var(--border-color, #E2E8F0); border-radius: 16px; margin-bottom: 20px; position: relative; overflow: hidden;">
            <div style="position: absolute; right: -25px; top: -25px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%); pointer-events: none;"></div>
            ${profilePicHtml}
            <div style="flex: 1; min-width: 0;">
                <h3 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; line-height: 1.25; word-break: break-word;">${fullName}</h3>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 700; color: var(--text-primary); background: rgba(0, 0, 0, 0.05); padding: 4px 10px; border-radius: 8px;">
                        <i class="icon-hash" style="color: var(--text-secondary); font-size: 13px;"></i> ${studentNo}
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--primary-color); background: rgba(15, 50, 96, 0.06); padding: 4px 10px; border-radius: 8px;">
                        <i class="icon-graduation-cap" style="font-size: 14px;"></i> ${program}
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #B45309; background: rgba(245, 158, 11, 0.12); padding: 4px 10px; border-radius: 8px;">
                        Year ${yearLevel}
                    </span>
                </div>
            </div>
            <div style="flex-shrink: 0; align-self: flex-start;">
                ${statusBadge}
            </div>
        </div>

        <!-- 2-Column Information Layout -->
        <div style="display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 18px; margin-bottom: 20px;">
            
            <!-- Left: Personal Information Card -->
            <div style="background: var(--card-bg, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #E2E8F0);">
                    <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(15, 50, 96, 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="icon-user" style="color: var(--primary-color); font-size: 15px;"></i>
                    </div>
                    <span style="font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">Personal Information</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px;">
                    <div style="grid-column: 1 / -1;">
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Email Address</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); word-break: break-all;">${email}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Mobile / Contact</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${mobile}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Gender</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${student.gender || 'N/A'}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Date of Birth</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${birthdate}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Age</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${age}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Civil Status</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${civilStatus}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Religion</span>
                        <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${religion}</span>
                    </div>
                </div>
            </div>

            <!-- Right Column: Academic & Family Cards -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                
                <!-- Scholarship & Academic Card -->
                <div style="background: var(--card-bg, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #E2E8F0);">
                        <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(245, 158, 11, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="icon-award" style="color: #D97706; font-size: 15px;"></i>
                        </div>
                        <span style="font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">Scholarship & Academic</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="grid-column: 1 / -1;">
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Degree Program</span>
                            <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${program}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Scholarship</span>
                            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: #047857; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 3px 9px; border-radius: 6px;">
                                <i class="icon-check-circle" style="font-size: 13px;"></i> ${scholarshipName}
                            </span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">SA Number</span>
                            <span style="display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; color: var(--text-primary); background: rgba(0,0,0,0.05); padding: 3px 8px; border-radius: 6px;">${saNumber}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Year Level</span>
                            <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">Year ${yearLevel}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Payouts Received</span>
                            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 700; color: var(--text-primary);">
                                <i class="icon-wallet" style="font-size: 14px; color: #D97706;"></i> ${payouts}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Family Background Card -->
                <div style="background: var(--card-bg, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #E2E8F0);">
                        <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(5, 150, 105, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="icon-users" style="color: #059669; font-size: 15px;"></i>
                        </div>
                        <span style="font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">Family Background</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Father's Name</span>
                            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${fatherName}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Occupation</span>
                            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${fatherOcc}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Mother's Name</span>
                            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${motherName}</span>
                        </div>
                        <div>
                            <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 3px;">Occupation</span>
                            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${motherOcc}</span>
                        </div>
                    </div>
                </div>

            </div>

        </div>

        <!-- Submitted Documents Card -->
        <div style="background: var(--card-bg, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #E2E8F0);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i class="icon-file-text" style="color: #2563EB; font-size: 15px;"></i>
                    </div>
                    <span style="font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">Documentary Requirements</span>
                </div>
                <span style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary);">
                    ${(atmUrl || frontUrl || backUrl || pdfUrl) ? 'Files Uploaded' : 'Awaiting Submissions'}
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                ${renderDocItem('ATM Card Proof', atmUrl, 'icon-credit-card')}
                ${renderDocItem('Student ID (Front)', frontUrl, 'icon-image')}
                ${renderDocItem('Student ID (Back)', backUrl, 'icon-image')}
                ${renderDocItem('Application PDF', pdfUrl, 'icon-file-text')}
            </div>
        </div>
    `;

    // Action buttons bar at bottom
    const actionsDiv = document.createElement('div');
    actionsDiv.style.paddingTop = "18px";
    actionsDiv.style.borderTop = "1px solid var(--border-color, #E2E8F0)";

    let noticeHtml = '';
    if (isNoSubmission) {
        noticeHtml = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(100, 116, 139, 0.06); border: 1px solid rgba(100, 116, 139, 0.2); border-radius: 12px; margin-bottom: 16px;">
                <i class="icon-info" style="color: #64748B; font-size: 18px; flex-shrink: 0;"></i>
                <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.45;">
                    <strong style="color: var(--text-primary);">Notice:</strong> This student currently has <strong>No Submission Yet</strong>. Document requirements should be submitted and verified before approving the application.
                </div>
            </div>
        `;
    }

    actionsDiv.innerHTML = `
        ${noticeHtml}
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-outline" onclick="hideModal()" style="padding: 11px 22px; border-radius: 10px; font-weight: 600; font-size: 13.5px; cursor: pointer;">
                Close
            </button>
            <button type="button" onclick="rejectStudent('${student.uid}')" style="display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; border-radius: 10px; font-weight: 600; font-size: 13.5px; color: white; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.2)'">
                <i class="icon-x-circle" style="font-size: 15px;"></i> Reject Application
            </button>
            <button type="button" onclick="approveStudent('${student.uid}')" style="display: inline-flex; align-items: center; gap: 8px; padding: 11px 24px; border-radius: 10px; font-weight: 600; font-size: 13.5px; color: white; background: linear-gradient(135deg, #10B981, #059669); border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.35)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.25)'">
                <i class="icon-check-circle" style="font-size: 15px;"></i> ${isApproved ? 'Approved Scholar' : 'Approve Student'}
            </button>
        </div>
    `;

    dynamicDetails.appendChild(actionsDiv);

    if (window.lucide) window.lucide.createIcons();

    modal.classList.remove('hidden');
}

window.editStudent = function (uid) {
    const student = allStudents.find(s => s.uid === uid);
    if (!student) return;

    modalMode = 'edit';
    currentEditUid = uid;
    modalTitle.textContent = 'Edit Student';
    const subTitleEl = document.getElementById('modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = 'Update student information';
    document.getElementById('modal-icon').className = 'icon-pencil';
    const iconContainer = document.getElementById('modal-icon-container');
    if (iconContainer) iconContainer.style.background = 'rgba(15, 50, 96, 0.08)';

    const modalCard = document.getElementById('student-modal-card') || document.querySelector('#student-modal .card');
    if (modalCard) {
        modalCard.style.maxWidth = '560px';
        modalCard.style.padding = '24px';
    }

    // Ensure the form is visible
    studentForm.style.display = 'flex';

    // Show form inputs
    Array.from(studentForm.querySelectorAll('input, select')).forEach(el => {
        el.parentElement.style.display = '';
        if (el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.tagName === 'LABEL') {
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
    if (student.birthdate) {
        // Simple conversion if format is mm/dd/yyyy
        let [m, d, y] = student.birthdate.split('/');
        if (y && m && d) {
            inpBirthdate.value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
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

window.deleteStudent = async function (uid) {
    if (!confirm('Are you sure you want to permanently delete this student record?')) return;
    try {
        const { error } = await supabase.from('student_grantees').delete().eq('uid', uid);
        if (error) throw error;
        alert('Student deleted.');
        hideModal();
        loadStudents();
    } catch (err) {
        console.error('Error deleting student:', err);
        alert('Failed to delete student.');
    }
};

function hideModal() {
    modal.classList.add('hidden');
    const modalCard = document.getElementById('student-modal-card') || document.querySelector('#student-modal .card');
    if (modalCard) {
        modalCard.style.maxWidth = '560px';
        modalCard.style.padding = '24px';
    }
}

window.approveStudent = async function (uid) {
    const student = allStudents.find(s => s.uid === uid);
    const hasSubmitted = StudentSyncService.hasStudentSubmitted(student);
    if (!hasSubmitted) {
        if (!confirm('Notice: This grantee currently has "No Submission Yet" and has not uploaded any required documents.\n\nAre you sure you want to bypass requirements and manually approve this student?')) {
            return;
        }
    } else if (!confirm('Are you sure you want to approve this student?')) {
        return;
    }
    try {
        const currentDocs = student?.documents || {};
        const updatedDocs = {
            ...currentDocs,
            saVerificationStatus: 'Approved',
            idValidationStatus: 'Approved'
        };

        const { error } = await supabase.from('student_grantees').update({
            status: 'Approved',
            documents: updatedDocs,
            updatedAt: new Date().toISOString()
        }).eq('uid', uid);
        if (error) {
            // If student_grantees record doesn't exist yet, insert it
            await supabase.from('student_grantees').insert([{
                uid: uid,
                student_no: student?.student_no || student?.studentId,
                studentId: student?.student_no || student?.studentId,
                fullName: student?.fullName || student?.full_name,
                status: 'Approved',
                documents: updatedDocs,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }]);
        }

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
    } catch (err) {
        console.error('Error approving student:', err);
        alert('Failed to approve student.');
    }
};

window.rejectStudent = async function (uid) {
    if (!confirm('Are you sure you want to reject this student?')) return;
    try {
        const student = allStudents.find(s => s.uid === uid);
        const currentDocs = student?.documents || {};
        const updatedDocs = {
            ...currentDocs,
            saVerificationStatus: 'Rejected',
            idValidationStatus: 'Rejected'
        };

        const { error } = await supabase.from('student_grantees').update({
            status: 'Rejected',
            documents: updatedDocs,
            updatedAt: new Date().toISOString()
        }).eq('uid', uid);
        if (error) throw error;

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
    } catch (err) {
        console.error('Error rejecting student:', err);
        alert('Failed to reject student.');
    }
};

// Event Listeners
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (filterStatus) filterStatus.addEventListener('change', applyFilters);
if (filterCourse) filterCourse.addEventListener('change', applyFilters);
if (filterScholarship) filterScholarship.addEventListener('change', applyFilters);
if (sortBy) sortBy.addEventListener('change', applyFilters);
if (filterAy) filterAy.addEventListener('change', () => {
    if (ayDisplay) ayDisplay.innerText = filterAy.options[filterAy.selectedIndex].text;
    applyFilters();
});
if (refreshStudentsBtn) refreshStudentsBtn.addEventListener('click', () => loadStudents());

if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
const modalCancel = document.getElementById('modal-cancel-btn');
if (modalCancel) modalCancel.addEventListener('click', hideModal);

// Realtime Subscription
let realtimeChannel = null;
function setupRealtimeStudentSubscription() {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        realtimeChannel = supabase.channel('public:student_records_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annex_form_2' }, (payload) => {
                console.log('[Realtime] annex_form_2 change in student_records:', payload.eventType);
                loadStudents();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'school_students' }, (payload) => {
                console.log('[Realtime] school_students change in student_records:', payload.eventType);
                loadStudents();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_grantees' }, (payload) => {
                console.log('[Realtime] students change in student_records:', payload.eventType);
                loadStudents();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] student_records subscribed to annex_form_2, school_students and student_grantees');
                }
            });
    } catch (e) {
        console.warn('Could not establish realtime channel in student_records:', e);
    }
}

// Init
loadStudents();
setupRealtimeStudentSubscription();

