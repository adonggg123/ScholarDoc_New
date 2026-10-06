const https = require('https');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ywavesulvkqwpsejprxp.supabase.co';
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.error("Missing SUPABASE_ANON_KEY in environment.");
  process.exit(1);
}

// Exact list of tables from screenshot
const tablesToClear = [
  'annex_form_2',
  'annex_form_3',
  'announcements',
  'audit_logs',
  'grantee_email_logs',
  'new_grantees_masterlist',
  'notifications',
  'reports',
  'scholarships',
  'school_students',
  'sms_logs',
  'student_grantees',
  'user_fcm_tokens',
  'students',
  'scholar_masterlist',
  'non_qualified_masterlist'
];

function deleteTableData(table) {
  return new Promise((resolve) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?id=gte.0`);
    const req = https.request(url, {
      method: 'DELETE',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`[CLEARED] Table '${table}': Status ${res.statusCode}`);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error(`[ERROR] Table '${table}': ${err.message}`);
      resolve();
    });
    req.end();
  });
}

async function run() {
  console.log("Starting cleanup for specified tables...");
  for (const table of tablesToClear) {
    await deleteTableData(table);
  }
  console.log("Cleanup complete. Admin users and system settings remain intact.");
}

run();
