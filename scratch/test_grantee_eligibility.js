const assert = require('assert');
const { validateGranteeEligibility } = require('../server.js');

async function runTests() {
    console.log('--- Testing Grantee Eligibility Authentication Logic ---');

    // Test 1: Real Grantee from database (e.g., student_no 2023304843 - ARIAS, WARREN P)
    console.log('1. Testing known eligible grantee (2023304843)...');
    const resultGrantee = await validateGranteeEligibility('2023304843');
    console.log('Result:', resultGrantee);
    assert.strictEqual(resultGrantee.isEligible, true);
    assert.strictEqual(resultGrantee.success, true);
    assert.ok(resultGrantee.grantee, 'Expected grantee details to be returned');
    console.log('✓ Eligible grantee properly confirmed');

    // Test 2: Non-existent / Non-grantee student
    console.log('2. Testing non-grantee / invalid student ID (9999999999)...');
    const resultNonGrantee = await validateGranteeEligibility('9999999999');
    console.log('Result:', resultNonGrantee);
    assert.strictEqual(resultNonGrantee.isEligible, false);
    assert.strictEqual(resultNonGrantee.success, false);
    assert.ok(resultNonGrantee.message.includes('Access denied'), 'Expected access denied message');
    assert.ok(resultNonGrantee.message.includes('not registered as an eligible grantee'), 'Expected clear grantee eligibility explanation');
    console.log('✓ Non-grantee properly denied with clear message');

    // Test 3: Empty identifier
    console.log('3. Testing empty identifier...');
    const resultEmpty = await validateGranteeEligibility('');
    assert.strictEqual(resultEmpty.isEligible, false);
    console.log('✓ Empty identifier handled safely');

    // Test 4: Live HTTP API check against running server
    console.log('4. Testing HTTP endpoint /api/auth/validate-grantee on ephemeral port...');
    const { server } = require('../server.js');
    await new Promise((resolve) => {
        const testServer = server.listen(0, async () => {
            const port = testServer.address().port;
            try {
                // Test 4a: Non-grantee via HTTP
                const httpRes403 = await fetch(`http://localhost:${port}/api/auth/validate-grantee`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: '9999999999' })
                });
                const httpData403 = await httpRes403.json();
                assert.strictEqual(httpRes403.status, 403);
                assert.strictEqual(httpData403.isEligible, false);
                assert.ok(httpData403.message.includes('not registered as an eligible grantee'));
                console.log('✓ 4a: Non-grantee returned 403 Forbidden with clear message over HTTP');

                // Test 4b: Real grantee via HTTP
                const httpRes200 = await fetch(`http://localhost:${port}/api/auth/validate-grantee`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: '2023304843' })
                });
                const httpData200 = await httpRes200.json();
                assert.strictEqual(httpRes200.status, 200);
                assert.strictEqual(httpData200.isEligible, true);
                assert.strictEqual(httpData200.grantee.student_no, '2023304843');
                console.log('✓ 4b: Eligible grantee returned 200 OK over HTTP');

                // Test 4c: Empty body via HTTP
                const httpRes400 = await fetch(`http://localhost:${port}/api/auth/validate-grantee`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                assert.strictEqual(httpRes400.status, 400);
                console.log('✓ 4c: Missing identifier returned 400 Bad Request over HTTP');

                testServer.close(resolve);
            } catch (err) {
                testServer.close(() => { throw err; });
            }
        });
    });

    console.log('\nALL GRANTEE ELIGIBILITY TESTS PASSED! 🎉');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
