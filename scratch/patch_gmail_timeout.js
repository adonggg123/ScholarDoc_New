const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

const target = `        connectionTimeout: 6000,
        greetingTimeout: 5000,
        socketTimeout: 10000,`;

const replacement = `        connectionTimeout: 30000,
        greetingTimeout: 25000,
        socketTimeout: 45000,`;

if (!content.includes(target)) {
    console.error('Target not found in server.js');
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully patched Gmail timeouts in server.js');

