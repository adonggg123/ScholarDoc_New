// Test scratch file for Semaphore SMS normalization and API structure
function normalizePhilippineMobile(rawPhone) {
    if (!rawPhone) return null;
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length === 12) {
        digits = '0' + digits.substring(2);
    } else if (digits.startsWith('9') && digits.length === 10) {
        digits = '0' + digits;
    }
    if (/^09\d{9}$/.test(digits)) {
        return digits;
    }
    return null;
}

const testNumbers = [
    '09171234567',
    '+639171234567',
    '639171234567',
    '9171234567',
    '0917-123-4567',
    '+63 917 123 4567',
    '12345',
    '0912345678', // 10 digits (too short)
    '091234567890' // 12 digits (too long)
];

console.log('--- Testing Number Normalization ---');
testNumbers.forEach(num => {
    console.log(`${num} -> ${normalizePhilippineMobile(num)}`);
});
