const https = require('https');

const SUPABASE_URL = 'https://ywavesulvkqwpsejprxp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

function query(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL + endpoint);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

async function check() {
  const students = await query('/rest/v1/student_grantees?select=id,uid,fullName,full_name,studentId,student_no');
  const notifs = await query('/rest/v1/notifications?select=id,studentId,title,isRead,timestamp');
  console.log('--- STUDENT GRANTEES & NOTIFICATIONS COUNT ---');
  if (Array.isArray(students)) {
    for (const s of students) {
      const studentUid = s.uid || s.id;
      const studentName = s.fullName || s.full_name;
      const studentNo = s.studentId || s.student_no;
      const sNotifs = Array.isArray(notifs) ? notifs.filter(n => n.studentId === studentUid || n.studentId === studentNo || n.studentId === s.id) : [];
      const unread = sNotifs.filter(n => !n.isRead);
      console.log(`${studentName} (${studentNo}) [UID: ${studentUid}] -> Total: ${sNotifs.length}, Unread: ${unread.length}`);
      if (sNotifs.length > 0) {
        console.log('   Titles:', sNotifs.map(n => `${n.title} (read: ${n.isRead})`));
      }
    }
  }

  // Also check if any notification has studentId that doesn't match any student
  if (Array.isArray(notifs) && Array.isArray(students)) {
    const allUids = new Set(students.flatMap(s => [s.uid, s.id, s.studentId, s.student_no].filter(Boolean)));
    const otherNotifs = notifs.filter(n => !allUids.has(n.studentId));
    console.log('\n--- NOTIFICATIONS FOR OTHER / UNMATCHED STUDENT IDs ---');
    console.log('Count:', otherNotifs.length);
    for (const n of otherNotifs) {
      console.log(`studentId: ${n.studentId} | Title: ${n.title} | isRead: ${n.isRead}`);
    }
  }
}

check();
