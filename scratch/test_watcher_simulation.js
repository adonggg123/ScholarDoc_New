const fs = require('fs');
const path = require('path');

// Test that server.js exports and functions load cleanly
const serverModule = require('../server.js');
console.log('server.js exports loaded:', Object.keys(serverModule));

const PROCESSED_FILE = path.join(__dirname, 'processed_grantee_email_ids.json');
console.log('Checking if scratch/processed_grantee_email_ids.json exists:', fs.existsSync(PROCESSED_FILE));

if (fs.existsSync(PROCESSED_FILE)) {
    const ids = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    console.log('Processed grantee IDs count:', ids.length);
}
