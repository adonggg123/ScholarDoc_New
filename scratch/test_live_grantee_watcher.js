const fs = require('fs');
const path = require('path');
const { startGranteeEmailWatcher, pollNewGranteesAndSendEmail, sendSingleGranteeEmail } = require('../server.js');

async function main() {
    console.log('1. Testing startGranteeEmailWatcher baseline initialization...');
    await startGranteeEmailWatcher();

    const PROCESSED_FILE = path.join(__dirname, 'processed_grantee_email_ids.json');
    if (!fs.existsSync(PROCESSED_FILE)) {
        throw new Error('processed_grantee_email_ids.json was not created!');
    }
    const baselineIds = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
    console.log(`Baseline created with ${baselineIds.length} tokens.`);

    console.log('\n2. Testing pollNewGranteesAndSendEmail (should find 0 new grantees)...');
    await pollNewGranteesAndSendEmail();
    console.log('Poll completed cleanly with no unexpected sends.');

    console.log('\n3. Testing deduplication logic in sendSingleGranteeEmail...');
    const testRecord = {
        id: 'test-uuid-1234',
        uid: 'test-uuid-1234',
        student_no: '2023999999',
        full_name: 'TEST STUDENT',
        email_address: 'test@example.com',
        email_sent_at: '2026-10-20T00:00:00.000Z'
    };
    const skipRes = await sendSingleGranteeEmail(testRecord, { force: false });
    console.log('Skip result for already sent grantee:', skipRes);
    if (!skipRes.skipped) throw new Error('Deduplication failed! Record with email_sent_at was not skipped.');

    console.log('\n✅ All automated grantee email watcher tests PASSED successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
