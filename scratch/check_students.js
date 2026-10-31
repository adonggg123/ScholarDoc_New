const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const anonKey = env.match(/SUPABASE_ANON_KEY=([^\r\n]+)/)[1].trim();
const url = env.match(/SUPABASE_URL=([^\r\n]+)/)[1].trim();

fetch(`${url}/rest/v1/student_grantees?select=student_no,full_name,mobile_number,email_address`, {
    headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
    }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(err => console.error(err));

