async function testSendEmail() {
    const res = await fetch('http://localhost:8080/api/auth/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: '2023305322',
            channel: 'email'
        })
    });
    const data = await res.json();
    console.log('Resend Response:', data);
}
testSendEmail();

