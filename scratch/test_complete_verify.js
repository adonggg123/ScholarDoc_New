async function testVerify() {
    const res = await fetch('http://localhost:8080/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: '2023305322',
            otp: '453099'
        })
    });
    const data = await res.json();
    console.log('Verify response:', data);

    const checkRes = await fetch('http://localhost:8080/api/auth/otp/status?studentId=2023305322');
    const checkData = await checkRes.json();
    console.log('Post-verify status:', checkData);
}
testVerify();

