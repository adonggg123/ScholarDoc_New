const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const baseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };

function cleanStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeNameParts(name) {
  return (name || '').toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1);
}

function isMatch(student, grantee) {
  // 1. By student number
  const sNo = cleanStr(student.student_no || student.studentId);
  const gNo = cleanStr(grantee.student_number || grantee.student_no || grantee.studentId);
  if (sNo && gNo && sNo === gNo) return { matched: true, reason: 'student_number' };

  // 2. Exact clean string match
  const sNameClean = cleanStr(student.full_name || student.fullName);
  const gFullName = grantee.name || `${grantee.last_name || ''} ${grantee.given_name || grantee.first_name || ''}`;
  const gNameClean = cleanStr(gFullName);
  if (sNameClean && gNameClean && (sNameClean === gNameClean || sNameClean.includes(gNameClean) || gNameClean.includes(sNameClean))) {
    return { matched: true, reason: 'clean_name' };
  }

  // 3. Last name + First name token match
  const sTokens = normalizeNameParts(student.full_name || student.fullName);
  const gLast = (grantee.last_name || '').toLowerCase().trim();
  const gFirst = (grantee.given_name || grantee.first_name || '').toLowerCase().trim();

  if (gLast && gFirst) {
    const hasLast = sTokens.some(t => t.includes(gLast) || gLast.includes(t));
    const hasFirst = sTokens.some(t => t.includes(gFirst) || gFirst.includes(t));
    if (hasLast && hasFirst) return { matched: true, reason: 'last_and_first' };
  }

  return { matched: false };
}

async function testMatch() {
  const [ssRes, f2Res, gmRes] = await Promise.all([
    fetch(baseUrl + '/school_students?select=*', { headers }).then(r => r.json()),
    fetch(baseUrl + '/annex_form_2?select=*', { headers }).then(r => r.json()),
    fetch(baseUrl + '/new_grantees_masterlist?select=*', { headers }).then(r => r.json())
  ]);

  console.log('School students count:', ssRes.length);
  console.log('Form 2 count:', f2Res.length);
  console.log('Grantee Masterlist count:', gmRes.length);

  const matchedStudents = [];

  ssRes.forEach(student => {
    let matchedF2 = f2Res.find(f2 => isMatch(student, f2).matched);
    let matchedGM = gmRes.find(gm => isMatch(student, gm).matched);

    if (matchedF2 || matchedGM) {
      matchedStudents.push({
        student: student.full_name,
        student_no: student.student_no,
        program: student.program_name,
        matchedIn: matchedF2 ? 'Annex Form 2' : 'Grantee Masterlist',
        batch: matchedF2?.tes_batch || matchedGM?.batch || 'Batch 1'
      });
    }
  });

  console.log('\n--- MATCHED STUDENTS (' + matchedStudents.length + ') ---');
  matchedStudents.forEach(m => console.log(`${m.student_no} | ${m.student} | ${m.program} | in: ${m.matchedIn} (${m.batch})`));
}

testMatch();
