const https = require('https');

const SUPABASE_URL = 'https://ywavesulvkqwpsejprxp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

function request(method, endpoint) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL + endpoint);
    const req = https.request(url, {
      method: method,
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
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

async function purgeOrphanNotifications() {
  const annRes = await request('GET', '/rest/v1/announcements?select=id,isActive');
  const activeAnnouncements = Array.isArray(annRes.body) ? annRes.body.filter(a => a.isActive !== false) : [];
  const activeIds = new Set(activeAnnouncements.map(a => String(a.id)));
  console.log('Active announcement IDs in DB:', [...activeIds]);

  const notifRes = await request('GET', '/rest/v1/notifications?select=id,title,announcementId&announcementId=not.is.null');
  if (!Array.isArray(notifRes.body)) {
    console.error('Failed to get notifications:', notifRes.body);
    return;
  }

  const orphanIds = [];
  for (const n of notifRes.body) {
    if (!n.announcementId || !activeIds.has(String(n.announcementId))) {
      orphanIds.push(n.id);
    }
  }

  console.log('Total notifications checked:', notifRes.body.length);
  console.log('Orphan notifications found to delete:', orphanIds.length);

  for (let i = 0; i < orphanIds.length; i += 20) {
    const batch = orphanIds.slice(i, i + 20);
    const delRes = await request('DELETE', '/rest/v1/notifications?id=in.(' + batch.join(',') + ')');
    console.log('Deleted batch:', i, 'to', i + batch.length, 'status:', delRes.status);
  }

  console.log('Orphan purge complete!');
}

purgeOrphanNotifications();
