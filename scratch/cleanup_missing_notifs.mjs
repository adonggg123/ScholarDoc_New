const supabaseUrl = 'https://ywavesulvkqwpsejprxp.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

async function cleanupMissingNotifications() {
    console.log('Deleting existing Missing Requirements Notice notifications from Supabase...');
    const res = await fetch(`${supabaseUrl}/rest/v1/notifications?title=ilike.*Missing%20Requirements*`, {
        method: 'DELETE',
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        }
    });

    console.log('Delete response status:', res.status);
    if (res.ok) {
        console.log('Successfully deleted all existing Missing Requirements Notice notifications from database!');
    } else {
        console.error('Delete failed:', await res.text());
    }
}

cleanupMissingNotifications().catch(console.error);
