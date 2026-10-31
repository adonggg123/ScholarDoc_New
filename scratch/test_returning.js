async function testReturningStudent() {
    const res = await fetch('http://localhost:8080/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: '2023305322',
            password: 'any_valid_student_password'
        })
    });
    const data = await res.json();
    console.log('Returning student login response:', data);
}
testReturningStudent();

