const SUPABASE_URL = 'https://ywavesulvkqwpsejprxp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

async function checkSystemSettings() {
    console.log('Fetching system_settings via REST API...');
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?select=*`, { headers });
        const data = await res.json();
        console.log('GET system_settings status:', res.status, data);

        // Try upserting notification_preferences
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/system_settings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                key: 'notification_preferences',
                value: {
                    email_notifications: true,
                    sms_alerts: false,
                    updated_at: new Date().toISOString()
                }
            })
        });

        console.log('UPSERT status:', upsertRes.status, await upsertRes.text());
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

checkSystemSettings();
