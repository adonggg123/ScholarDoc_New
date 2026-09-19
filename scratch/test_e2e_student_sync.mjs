import { StudentSyncService } from '../superadmin_web/js/services/student_sync_service.js';

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const baseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };

globalThis.window = {
  supabaseClient: {
    from: (table) => ({
      select: (cols) => fetch(baseUrl + '/' + table + '?select=' + (cols || '*'), { headers }).then(r => r.json()).then(data => ({ data })),
      upsert: (rows, opts) => fetch(baseUrl + '/' + table + (opts?.onConflict ? '?on_conflict=' + opts.onConflict : ''), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(rows)
      }).then(r => ({ error: r.ok ? null : new Error(r.statusText) }))
    })
  }
};

async function test() {
  const students = await StudentSyncService.loadAndSyncStudents();
  console.log('Total students returned by StudentSyncService:', students.length);
  students.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.student_no}] ${s.full_name} | Program: ${s.program_name} | Status: ${s.status} | Scholarship: ${s.scholarship_name}`);
  });
}

test();
