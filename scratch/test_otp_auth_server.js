const assert = require('assert');
const { server, activeOtpSessions, completedFirstLoginStudents } = require('../server.js');

async function runTests() {
    console.log('========================================================');
    console.log('🧪 TESTING SMS OTP AUTHENTICATION BACKEND ENGINE');
    console.log('========================================================\n');

    const testServer = server.listen(0);
    await new Promise((r) => testServer.on('listening', r));
    const port = testServer.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
        const studentId = '2023304850';

        // Reset any prior state for test isolation
        completedFirstLoginStudents.delete(studentId);
        activeOtpSessions.delete(studentId);

        // TEST 1: Unauthorized Student Attempt (Non-Grantee)
        console.log('1. Testing unauthorized student attempt (non-existent ID: 9999999999)...');
        const resNonGrantee = await fetch(`${baseUrl}/api/auth/student-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: '9999999999', password: 'password123' })
        });
        const dataNonGrantee = await resNonGrantee.json();
        assert.strictEqual(resNonGrantee.status, 403, 'Expected 403 Forbidden for non-grantee');
        assert.strictEqual(dataNonGrantee.isEligible, false);
        assert.ok(dataNonGrantee.message.includes('not registered as an eligible grantee'));
        console.log('   ✓ Unauthorized student login prevented with 403 Forbidden\n');

        // TEST 2: First-login with invalid initial password (must use Student ID)
        console.log('2. Testing first-login with incorrect initial password...');
        const resWrongPwd = await fetch(`${baseUrl}/api/auth/student-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, password: 'wrongpassword' })
        });
        const dataWrongPwd = await resWrongPwd.json();
        assert.strictEqual(resWrongPwd.status, 401, 'Expected 401 Unauthorized for wrong initial password');
        assert.strictEqual(dataWrongPwd.isFirstLogin, true);
        assert.ok(dataWrongPwd.error.includes('Student ID as both your username and password'));
        console.log('   ✓ Student ID as initial password enforced on first login\n');

        // TEST 3: First-login with valid initial credentials (Student ID as password)
        console.log('3. Testing first-login with valid Student ID credentials...');
        const resOtpGen = await fetch(`${baseUrl}/api/auth/student-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, password: studentId })
        });
        const dataOtpGen = await resOtpGen.json();
        assert.strictEqual(resOtpGen.status, 200, 'Expected 200 OK');
        assert.strictEqual(dataOtpGen.requiresOtp, true, 'Expected requiresOtp: true');
        assert.strictEqual(dataOtpGen.isFirstLogin, true, 'Expected isFirstLogin: true');
        assert.strictEqual(dataOtpGen.resendCooldown, 60, 'Expected 60s cooldown');
        assert.strictEqual(dataOtpGen.expiresIn, 300, 'Expected 300s expiration');
        assert.ok(dataOtpGen.maskedPhone.includes('••••'), 'Expected masked phone number');
        console.log(`   ✓ OTP generated and dispatched via Semaphore SMS to ${dataOtpGen.maskedPhone}\n`);

        // TEST 4: Rate Limiting on Immediate Resend Request (< 60 seconds)
        console.log('4. Testing resend rate limit (immediate request under cooldown)...');
        const resCooldown = await fetch(`${baseUrl}/api/auth/otp/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId })
        });
        const dataCooldown = await resCooldown.json();
        assert.strictEqual(resCooldown.status, 429, 'Expected 429 Too Many Requests during cooldown');
        assert.ok(dataCooldown.error.includes('Please wait'), 'Expected cooldown warning message');
        console.log(`   ✓ Rate limit enforced: ${dataCooldown.error}\n`);

        // TEST 5: Wrong OTP Submission & Attempt Limiting
        console.log('5. Testing wrong OTP submission...');
        const resWrongOtp = await fetch(`${baseUrl}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, otp: '000000' })
        });
        const dataWrongOtp = await resWrongOtp.json();
        assert.strictEqual(resWrongOtp.status, 400, 'Expected 400 for wrong OTP');
        assert.strictEqual(dataWrongOtp.remainingAttempts, 4, 'Expected 4 remaining attempts');
        console.log(`   ✓ Failed attempt tracked: ${dataWrongOtp.error}\n`);

        // TEST 6: Correct OTP Submission & Verification
        console.log('6. Testing correct OTP verification...');
        // Look up the active session on backend to get the actual session phone & check hash
        const session = activeOtpSessions.get(studentId);
        assert.ok(session, 'Expected active session to exist');
        
        // We know the SHA-256 hash in session. Let's test with a simulated or stored test OTP
        // For test verification, let's create a known test code and hash
        const crypto = require('crypto');
        const testCode = '654321';
        session.otpHash = crypto.createHash('sha256').update(testCode).digest('hex');

        const resVerify = await fetch(`${baseUrl}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, otp: testCode })
        });
        const dataVerify = await resVerify.json();
        assert.strictEqual(resVerify.status, 200, 'Expected 200 OK on correct OTP');
        assert.strictEqual(dataVerify.verified, true, 'Expected verified: true');
        console.log('   ✓ OTP successfully verified! First login marked completed.\n');

        // TEST 7: Single-Use Guarantee (Cannot reuse already verified OTP)
        console.log('7. Testing single-use guarantee (reusing verified OTP code)...');
        const resReuse = await fetch(`${baseUrl}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, otp: testCode })
        });
        const dataReuse = await resReuse.json();
        assert.strictEqual(resReuse.status, 400, 'Expected 400 Bad Request on reuse');
        assert.ok(dataReuse.error.includes('No active OTP session'), 'Expected single-use session purge');
        console.log('   ✓ Single-use guarantee confirmed: OTP session purged immediately after verification\n');

        // TEST 8: Subsequent Login (No longer requires OTP, preserves standard flow)
        console.log('8. Testing subsequent login for student who completed first login...');
        const resSubsequent = await fetch(`${baseUrl}/api/auth/student-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, password: studentId })
        });
        const dataSubsequent = await resSubsequent.json();
        assert.strictEqual(resSubsequent.status, 200);
        assert.strictEqual(dataSubsequent.requiresOtp, false, 'Expected requiresOtp: false for returning student');
        assert.strictEqual(dataSubsequent.isFirstLogin, false, 'Expected isFirstLogin: false');
        console.log('   ✓ Returning student preserves standard login flow without OTP prompt\n');

        console.log('========================================================');
        console.log('🎉 ALL BACKEND SMS OTP TESTS PASSED SUCCESSFULLY!');
        console.log('========================================================\n');
    } finally {
        await new Promise((r) => testServer.close(r));
    }
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
