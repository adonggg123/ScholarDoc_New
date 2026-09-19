const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const baseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };

function clean(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameTokens(str) {
  return (str || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

function isMatch(student, grantee) {
  const sNo = clean(student.student_no || student.studentId);
  const gNo = clean(grantee.student_number || grantee.student_no || grantee.studentId);
  if (sNo && gNo && sNo === gNo) return true;

  const sNameClean = clean(student.full_name || student.fullName);
  const gFullName = grantee.name || `${grantee.last_name || ''} ${grantee.given_name || grantee.first_name || ''}`;
  const gNameClean = clean(gFullName);
  if (sNameClean && gNameClean && (sNameClean === gNameClean || sNameClean.includes(gNameClean) || gNameClean.includes(sNameClean))) return true;

  const sToks = nameTokens(student.full_name || student.fullName);
  const gLast = (grantee.last_name || '').toLowerCase().trim();
  const gFirst = (grantee.given_name || grantee.first_name || '').toLowerCase().trim();
  if (gLast && gFirst) {
    const hasLast = sToks.some(t => t.includes(gLast) || gLast.includes(t));
    const hasFirst = sToks.some(t => t.includes(gFirst) || gFirst.includes(t));
    if (hasLast && hasFirst) return true;
  }
  return false;
}

async function runSync() {
  const [ssRes, f2Res, gmRes] = await Promise.all([
    fetch(baseUrl + '/school_students?select=*', { headers }).then(r => r.json()),
    fetch(baseUrl + '/annex_form_2?select=*', { headers }).then(r => r.json()),
    fetch(baseUrl + '/new_grantees_masterlist?select=*', { headers }).then(r => r.json())
  ]);

  const syncedStudents = [];

  (ssRes || []).forEach(ss => {
    const f2Match = (f2Res || []).find(f => isMatch(ss, f));
    const gmMatch = (gmRes || []).find(g => isMatch(ss, g));

    if (f2Match || gmMatch) {
      const saNo = f2Match?.tes_application_number && f2Match.tes_application_number !== 'N/A'
        ? f2Match.tes_application_number
        : 'N/A';

      const record = {
        student_no: ss.student_no,
        full_name: ss.full_name,
        program_name: ss.program_name,
        year_level: ss.year_level,
        date_of_birth: ss.date_of_birth,
        age: ss.age || 20,
        gender: ss.gender || 'Female',
        civil_status: ss.civil_status || 'Single',
        religion: ss.religion || 'Roman Catholic',
        mobile_number: ss.mobile_number,
        email_address: ss.email_address,
        father_full_name: ss.father_full_name,
        father_occupation: ss.father_occupation,
        mother_full_name: ss.mother_full_name,
        mother_occupation: ss.mother_occupation,
        status: f2Match ? 'Verified' : 'Approved',
        scholarship_name: ss.scholarship_name || 'CHED TES',
        role: 'student',
        sa_number: saNo,
        academic_year: f2Match?.academic_year || '2024-2025',
        semester: f2Match?.semester || '1st Semester',
        familyDetails: {
          fatherName: ss.father_full_name || '',
          fatherEduStatus: ss.father_occupation || '',
          motherName: ss.mother_full_name || '',
          motherEduStatus: ss.mother_occupation || '',
          religion: ss.religion || '',
          saNumber: saNo
        }
      };
      syncedStudents.push(record);
    }
  });

  console.log('Total matched students ready to sync:', syncedStudents.length);

  // Perform upsert to Supabase
  const upsertRes = await fetch(baseUrl + '/students?on_conflict=student_no', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(syncedStudents)
  });
  console.log('Upsert to students status:', upsertRes.status);
  const upsertedData = await upsertRes.json();
  console.log('Upserted records count in students:', upsertedData.length);
  if (upsertedData.length > 0) {
    console.log('First student in database:', upsertedData[0].student_no, upsertedData[0].full_name, upsertedData[0].status);
  }
}

runSync();
