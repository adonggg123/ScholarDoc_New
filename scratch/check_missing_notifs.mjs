const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

async function checkNotifications() {
    console.log('Querying notifications table via REST API...');
    const res = await fetch(`${supabaseUrl}/rest/v1/notifications?title=ilike.*Missing%20Requirements*&select=*`, {
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        }
    });

    if (res.ok) {
        const data = await res.json();
        console.log(`Found ${data.length} missing requirement notifications:`);
        data.forEach(n => console.log(`ID: ${n.id} | StudentId: ${n.studentId} | Title: ${n.title} | Message: ${n.message}`));
    } else {
        console.error('Fetch error:', await res.text());
    }
}

checkNotifications().catch(console.error);
