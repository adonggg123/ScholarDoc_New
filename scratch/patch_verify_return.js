const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

const target = `                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    verified: true,
                    channel: verifiedChannel,
                    studentId: cleanId,
                    message: \`\${verifiedChannel === 'email' ? 'Email' : 'SMS'} OTP verified successfully. First login completed.\`
                }));`;

const replacement = `                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    verified: true,
                    channel: verifiedChannel,
                    studentId: cleanId,
                    email: session.email || null,
                    granteeUid: session.granteeUid || null,
                    message: \`\${verifiedChannel === 'email' ? 'Email' : 'SMS'} OTP verified successfully. First login completed.\`
                }));`;

if (!content.includes(target)) {
    console.error('Target not found in server.js');
    process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully patched otp/verify response in server.js');

