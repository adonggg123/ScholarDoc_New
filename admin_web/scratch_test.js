const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const base = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

// Seed the current student's documents with verification status fields
fetch(`${base}/students?uid=eq.2f48f582-c769-45a4-af84-d6d683bc4c18&select=documents`, { 
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(async data => {
    const currentDocs = data[0]?.documents || {};
    const updatedDocs = {
      ...currentDocs,
      saVerificationStatus: 'Pending',
      idValidationStatus: 'Pending'
    };

    const res = await fetch(`${base}/students?uid=eq.2f48f582-c769-45a4-af84-d6d683bc4c18`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ documents: updatedDocs, status: 'Pending' })
    });

    const body = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', body);
  });
