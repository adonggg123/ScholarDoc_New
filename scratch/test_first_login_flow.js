async function runTest() {
    const baseUrl = 'http://localhost:8080';

    console.log('--- Step 1: Initial Login (No channel chosen) ---');
    let res = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: '2023305322',
            password: '2023305322'
        })
    });
    let data = await res.json();
    console.log('Status:', res.status);
    console.log('Requires OTP:', data.requiresOtp);
    console.log('Requires Channel Selection:', data.requiresChannelSelection);
    console.log('Masked Phone:', data.maskedPhone);
    console.log('Masked Email:', data.maskedEmail);
    console.log('Available Channels:', data.availableChannels);

    if (!data.requiresChannelSelection) {
        console.error('FAILED: expected requiresChannelSelection to be true!');
        process.exit(1);
    }

    console.log('\n--- Step 2: User Chooses Email Delivery ---');
    res = await fetch(`${baseUrl}/api/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: '2023305322',
            password: '2023305322',
            channel: 'email'
        })
    });
    data = await res.json();
    console.log('Status:', res.status);
    console.log('Channel:', data.channel);
    console.log('Delivery Status:', data.deliveryStatus);
    console.log('Delivery Message:', data.deliveryMessage);
    console.log('Message:', data.message);

    console.log('\nSUCCESS! Both Step 1 and Step 2 work as designed.');
}

runTest().catch(console.error);

