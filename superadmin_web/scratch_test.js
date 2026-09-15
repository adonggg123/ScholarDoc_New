const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';
const base = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

fetch(`${base}/notifications`, {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    studentId: 'admin',
    title: 'Test Admin Notification',
    message: 'Test message',
    type: 'info',
    isRead: false,
    timestamp: new Date().toISOString()
  })
})
  .then(async r => {
    console.log('Insert Status:', r.status);
    const data = await r.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    // If it succeeded, delete it to clean up
    if (r.status === 201 || r.status === 200) {
      const createdId = data[0].id;
      await fetch(`${base}/notifications?id=eq.${createdId}`, {
        method: 'DELETE',
        headers
      });
      console.log('Cleaned up.');
    }
  })
  .catch(e => console.error(e));
