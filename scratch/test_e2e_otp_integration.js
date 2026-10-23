const assert = require('assert');

async function runE2E() {
    console.log('========================================================');
    console.log('🚀 LIVE END-TO-END SMS OTP INTEGRATION TEST (PORT 8080)');
    console.log('========================================================\n');

    const baseUrl = 'http://localhost:8080';
    const testStudentId = '2023304850';

    // 0. Reset test student to first-login state
    console.log('0. Resetting student 2023304850 to first-login state...');
    const resetRes = await fetch(`${baseUrl}/api/auth/otp/reset-first-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: testStudentId })
    });
    assert.strictEqual(resetRes.status, 200);
    console.log('   ✓ Student first-login state successfully reset\n');

    // 1. Validate Grantee Status
    console.log('1. Checking grantee eligibility via /api/auth/validate-grantee...');
    const valRes = await fetch(`${baseUrl}/api/auth/validate-grantee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testStudentId })
    });
    const valData = await valRes.json();
    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valData.isEligible, true);
    assert.strictEqual(valData.grantee.is_first_login, true);
    console.log(`   ✓ Grantee confirmed: ${valData.grantee.full_name} (${valData.grantee.mobile_number})`);
    console.log(`   ✓ First login detected: ${valData.grantee.is_first_login}\n`);

    // 2. Attempt login with wrong initial password
    console.log('2. Attempting student-login with wrong initial password...');
    const wrongRes = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: testStudentId, password: 'randompassword' })
    });
    const wrongData = await wrongRes.json();
    assert.strictEqual(wrongRes.status, 401);
    assert.strictEqual(wrongData.isFirstLogin, true);
    assert.ok(wrongData.error.includes('Student ID as both your username and password'));
    console.log(`   ✓ Rejected invalid initial credentials: ${wrongData.error}\n`);

    // 3. Initiate first login with Student ID as password
    console.log('3. Initiating first login with Student ID as password...');
    const initRes = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: testStudentId, password: testStudentId })
    });
    const initData = await initRes.json();
    assert.strictEqual(initRes.status, 200);
    assert.strictEqual(initData.requiresOtp, true);
    assert.strictEqual(initData.isFirstLogin, true);
    assert.strictEqual(initData.studentId, testStudentId);
    assert.strictEqual(initData.resendCooldown, 60);
    assert.strictEqual(initData.expiresIn, 300);
    assert.ok(initData.maskedPhone.includes('••••'));
    console.log(`   ✓ SMS OTP dispatched via Semaphore to ${initData.maskedPhone}`);
    console.log(`   ✓ Cooldown: ${initData.resendCooldown}s, Expiry: ${initData.expiresIn}s\n`);

    // 4. Rate Limiting Check on Resend
    console.log('4. Testing rate limit on rapid resend request...');
    const resendRes = await fetch(`${baseUrl}/api/auth/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: testStudentId })
    });
    const resendData = await resendRes.json();
    assert.strictEqual(resendRes.status, 429);
    assert.ok(resendData.error.includes('Please wait'));
    console.log(`   ✓ Resend rate limit enforced: ${resendData.error}\n`);

    // 5. Submit Wrong OTP Code
    console.log('5. Testing wrong OTP code verification...');
    const failRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: testStudentId, otp: '111111' })
    });
    const failData = await failRes.json();
    assert.strictEqual(failRes.status, 400);
    assert.strictEqual(failData.remainingAttempts, 4);
    console.log(`   ✓ Wrong OTP rejected. Remaining attempts: ${failData.remainingAttempts}\n`);

    console.log('========================================================');
    console.log('🎉 LIVE BACKEND E2E TEST PASSED ON PORT 8080!');
    console.log('========================================================\n');
}

runE2E().catch(err => {
    console.error('❌ E2E Test Failed:', err);
    process.exit(1);
});
