const fs = require('fs');
const path = require('path');

const SUPABASE_REST_URL = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

const processedGranteeEmailIds = new Set();
const GRANTEE_EMAIL_PROCESSED_FILE = path.join(__dirname, 'test_processed_grantee_email_ids.json');

async function testInitBaseline() {
    console.log('Testing baseline initialization...');
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };

    const res = await fetch(`${SUPABASE_REST_URL}/student_grantees?select=id,uid,student_no,email_sent_at,created_at`, { headers });
    const rows = await res.json();
    console.log(`Fetched ${rows.length} existing student_grantees.`);
    
    rows.forEach(r => {
        if (r.id) processedGranteeEmailIds.add(String(r.id));
        if (r.uid) processedGranteeEmailIds.add(String(r.uid));
        if (r.student_no) processedGranteeEmailIds.add(String(r.student_no));
    });
    console.log(`Baseline cached: ${processedGranteeEmailIds.size} identifier tokens.`);

    // Check polling query
    const pendingRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?email_sent_at=is.null&order=created_at.desc&limit=10`, { headers });
    const pending = await pendingRes.json();
    console.log(`Pending query returned ${pending.length} rows.`);

    // Filter using processedGranteeEmailIds
    const toSend = pending.filter(g => {
        const idStr = String(g.id || '');
        const uidStr = String(g.uid || '');
        const stuNo = String(g.student_no || '');
        return !processedGranteeEmailIds.has(idStr) && !processedGranteeEmailIds.has(uidStr) && !processedGranteeEmailIds.has(stuNo);
    });

    console.log(`New grantees eligible for automated sending: ${toSend.length} (Expected 0 for existing baseline)`);
}

testInitBaseline().catch(console.error);
