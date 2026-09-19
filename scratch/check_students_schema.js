const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Let's check environment variables or server config for Supabase URL and key
const fs = require('fs');
let envFile = '';
if (fs.existsSync('.env')) {
  envFile = fs.readFileSync('.env', 'utf8');
}
console.log('ENV exists:', fs.existsSync('.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ywavesulvkqwpsejprxp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Let's check server.js or other files if key is there
async function check() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.from('students').select('*').limit(3);
  if (error) {
    console.error('Error fetching students:', error);
  } else {
    console.log('Sample student keys:', data.length > 0 ? Object.keys(data[0]) : 'No rows');
    console.log('Sample student row:', JSON.stringify(data[0], null, 2));
  }
}
check();
