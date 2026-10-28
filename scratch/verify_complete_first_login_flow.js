const assert = require('assert');

async function verifyFlow() {
    console.log('===============================================================');
    console.log('🔒 VERIFYING COMPLETE FIRST-LOGIN SECURITY VERIFICATION FLOW');
    console.log('===============================================================\n');

    const baseUrl = 'http://localhost:8080';
    const studentId = '2023304850';

    // 1. Static Pages Availability Check
    console.log('1. Checking HTTP availability of Web Pages...');
    const loginRes = await fetch(`${baseUrl}/login.html`);
    assert.strictEqual(loginRes.status, 200, 'login.html must be served with 200 OK');
    const loginHtml = await loginRes.text();
    assert.ok(loginHtml.includes('id="loginForm"'), 'login.html must contain loginForm');
    console.log('   ✓ login.html is accessible (HTTP 200)');

    const otpRes = await fetch(`${baseUrl}/otp.html`);
    assert.strictEqual(otpRes.status, 200, 'otp.html must be served with 200 OK');
    const otpHtml = await otpRes.text();
    assert.ok(otpHtml.includes('SMS Security Verification'), 'otp.html must render verification header');
    assert.ok(otpHtml.includes('otpDigit0'), 'otp.html must render OTP input fields');
    assert.ok(otpHtml.includes('resendBtn'), 'otp.html must render resend button');
    console.log('   ✓ otp.html is accessible (HTTP 200)\n');

    // 2. Reset student state to first login
    console.log('2. Resetting student 2023304850 to first-login status...');
    const resetRes = await fetch(`${baseUrl}/api/auth/otp/reset-first-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId })
    });
    assert.strictEqual(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.success, true);
    console.log('   ✓ Reset successful. Student is in first-login state\n');

    // 3. Verify Route Guard / Status endpoint confirms first login is required
    console.log('3. Checking /api/auth/otp/status route guard before verification...');
    const statusPreRes = await fetch(`${baseUrl}/api/auth/otp/status?studentId=${studentId}`);
    assert.strictEqual(statusPreRes.status, 200);
    const statusPreData = await statusPreRes.json();
    assert.strictEqual(statusPreData.isEligible, true);
    assert.strictEqual(statusPreData.firstLoginCompleted, false, 'First login must NOT be completed yet');
    assert.strictEqual(statusPreData.requiresOtp, true, 'OTP must be required');
    console.log(`   ✓ Route guard confirmed: requiresOtp = true, firstLoginCompleted = false\n`);

    // 4. Test unauthorized non-grantee login attempt
    console.log('4. Testing login with non-grantee ID (9999999999)...');
    const nonGranteeRes = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: '9999999999', password: '9999999999' })
    });
    assert.strictEqual(nonGranteeRes.status, 403, 'Non-grantee must be blocked with 403 Forbidden');
    const nonGranteeData = await nonGranteeRes.json();
    assert.strictEqual(nonGranteeData.isEligible, false);
    console.log(`   ✓ Non-grantee login prevented (HTTP 403): ${nonGranteeData.message}\n`);

    // 5. Test first login with invalid initial password (must equal Student ID)
    console.log('5. Testing first login with incorrect initial password (not Student ID)...');
    const wrongPwdRes = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, password: 'password123' })
    });
    assert.strictEqual(wrongPwdRes.status, 401, 'Must reject with 401 when initial password != Student ID');
    const wrongPwdData = await wrongPwdRes.json();
    assert.strictEqual(wrongPwdData.isFirstLogin, true);
    assert.ok(wrongPwdData.error.includes('Student ID as both your username and password'));
    console.log(`   ✓ Enforced Student ID as initial credentials: ${wrongPwdData.error}\n`);

    // 6. First login with Student ID as both username and password
    console.log('6. Logging in with Student ID as both username and password...');
    const loginAttemptRes = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, password: studentId })
    });
    assert.strictEqual(loginAttemptRes.status, 200);
    const loginAttemptData = await loginAttemptRes.json();
    assert.strictEqual(loginAttemptData.requiresOtp, true, 'First login must return requiresOtp: true');
    assert.strictEqual(loginAttemptData.isFirstLogin, true);
    assert.ok(loginAttemptData.maskedPhone.includes('••••'));
    assert.strictEqual(loginAttemptData.resendCooldown, 60);
    assert.strictEqual(loginAttemptData.expiresIn, 300);
    console.log(`   ✓ Success! OTP generated and dispatched via Semaphore SMS to ${loginAttemptData.maskedPhone}`);
    console.log(`   ✓ Client will redirect to /otp.html?student_id=${studentId}&phone=${encodeURIComponent(loginAttemptData.maskedPhone)}\n`);

    // 7. Verify Rate Limiting on Immediate Resend (< 60s cooldown)
    console.log('7. Verifying rate limit on immediate OTP resend request...');
    const resendRes = await fetch(`${baseUrl}/api/auth/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId })
    });
    assert.strictEqual(resendRes.status, 429, 'Immediate resend must be blocked with 429 Rate Limit');
    const resendData = await resendRes.json();
    assert.ok(resendData.error.includes('Please wait'));
    console.log(`   ✓ Rate limit enforced: ${resendData.error}\n`);

    // 8. Test Invalid OTP Submission
    console.log('8. Testing invalid OTP submission (000000)...');
    const wrongOtpRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId, otp: '000000' })
    });
    assert.strictEqual(wrongOtpRes.status, 400);
    const wrongOtpData = await wrongOtpRes.json();
    assert.strictEqual(wrongOtpData.remainingAttempts, 4);
    console.log(`   ✓ Invalid OTP rejected: ${wrongOtpData.error} (Remaining: ${wrongOtpData.remainingAttempts})\n`);

    console.log('===============================================================');
    console.log('🎉 ALL FIRST-LOGIN SECURITY FLOW CHECKS PASSED PERFECTLY!');
    console.log('===============================================================\n');
}

verifyFlow().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
