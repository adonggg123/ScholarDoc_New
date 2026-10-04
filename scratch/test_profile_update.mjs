const supabaseUrl = 'https://dc2wi71nx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjMndpNzFueCIsInJvbGUiOiJhb24iLCJpYXQiOjE3MTY4ODg4MDAsImV4cCI6MjAzMjQ2NDgwMH0.placeholder'; // public key or service key

async function testFetch() {
    console.log('Fetching student record via REST API...');
    const res = await fetch(`${supabaseUrl}/rest/v1/student_grantees?select=*&limit=1`, {
        headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjMndpNzFueCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzE2ODg4ODAwLCJleHAiOjIwMzI0NjQ4MDB9.placeholder',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjMndpNzFueCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzE2ODg4ODAwLCJleHAiOjIwMzI0NjQ4MDB9.placeholder'
        }
    });
    console.log('Response status:', res.status);
    if (res.ok) {
        const data = await res.json();
        console.log('Data:', data[0]?.full_name || data[0]?.fullName, '| UID:', data[0]?.uid);
    } else {
        const text = await res.text();
        console.log('Error text:', text);
    }
}

testFetch().catch(console.error);
