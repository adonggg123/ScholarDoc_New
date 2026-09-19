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
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

const tables = [
  'students',
  'admins',
  'scholarships',
  'audit_logs',
  'notifications',
  'announcements',
  'reports',
  'presence',
  'system_settings',
  'school_students',
  'annex_form_2',
  'annex_form_3',
  'scholar_masterlist',
  'new_grantees_masterlist',
  'non_qualified_masterlist'
];

async function run() {
  for (const t of tables) {
    const res = await query(`/rest/v1/${t}?select=*&limit=1`);
    if (res.status === 200) {
      const keys = Array.isArray(res.body) && res.body.length > 0 ? Object.keys(res.body[0]) : '(Table exists, 0 rows)';
      console.log(`[${t}]:`, keys);
    } else {
      console.log(`[${t}] Status:`, res.status, res.body?.message || res.body);
    }
  }
}

run();
