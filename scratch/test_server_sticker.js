const assert = require('assert');
const {
    normalizeYear,
    normalizeSemester,
    isYearMatching,
    isSemesterMatching,
    parseStickerText,
    verifyBirthdateMatch
} = require('../server.js');

console.log('--- Running Server Sticker & Normalization Tests ---');

// 1. Year Normalization Tests
console.log('Testing Year Normalization...');
assert.strictEqual(normalizeYear('2026-2027'), '2026-2027');
assert.strictEqual(normalizeYear('A.Y. 2026 - 2027'), '2026-2027');
assert.strictEqual(normalizeYear('AY 2026–2027'), '2026-2027'); // en-dash
assert.strictEqual(normalizeYear('2026—2027'), '2026-2027'); // em-dash
assert.strictEqual(normalizeYear('2026/2027'), '2026-2027');
assert.strictEqual(normalizeYear('2026 - 27'), '2026-2027');
assert.strictEqual(normalizeYear('2026'), '2026-2027');
assert.strictEqual(normalizeYear('2O26-2O27'), '2026-2027'); // OCR letter O
assert.strictEqual(normalizeYear('20 26 - 20 27'), '2026-2027'); // Spaced digits
assert.ok(isYearMatching('2026-2027', 'A.Y. 2026 - 2027'));
assert.ok(isYearMatching('2026–2027', '2026/2027'));
assert.ok(!isYearMatching('2025-2026', '2026-2027'));
console.log('✓ Year Normalization passed');

// 2. Semester Normalization Tests
console.log('Testing Semester Normalization...');
assert.strictEqual(normalizeSemester('1st Semester'), '1st Semester');
assert.strictEqual(normalizeSemester('1st Sem'), '1st Semester');
assert.strictEqual(normalizeSemester('1°* Semester'), '1st Semester');
assert.strictEqual(normalizeSemester('1* Semester'), '1st Semester');
assert.strictEqual(normalizeSemester('1st'), '1st Semester');
assert.strictEqual(normalizeSemester('Sem 1'), '1st Semester');
assert.strictEqual(normalizeSemester('1st Sem.'), '1st Semester');
assert.strictEqual(normalizeSemester('2nd Semester'), '2nd Semester');
assert.strictEqual(normalizeSemester('2nd Sem'), '2nd Semester');
assert.strictEqual(normalizeSemester('2* Semester'), '2nd Semester');
assert.strictEqual(normalizeSemester('Sem 2'), '2nd Semester');
assert.strictEqual(normalizeSemester('Summer'), 'Summer / Midyear');
assert.strictEqual(normalizeSemester('Midyear'), 'Summer / Midyear');
assert.ok(isSemesterMatching('1st Semester', '1°* Semester'));
assert.ok(isSemesterMatching('2nd Sem', '2nd Semester'));
assert.ok(!isSemesterMatching('1st Semester', '2nd Semester'));
console.log('✓ Semester Normalization passed');

// 3. parseStickerText Tests
console.log('Testing parseStickerText...');

// Real world OCR string
const realWorldOcr = `
UNIVERSITY OF SCIENCE AND TECHNOLOGY OF SOUTHERN PHILIPPINES
OFFICE OF THE REGISTRAR
VALID: 1°* Semester A.Y. 2026 - 2027
CAMPUS REGISTRAR
`;
const parsed1 = parseStickerText(realWorldOcr, '2026-2027', '1st Semester');
assert.strictEqual(parsed1.isValid, true);
assert.strictEqual(parsed1.academicYear, '2026-2027');
assert.strictEqual(parsed1.semester, '1st Semester');
assert.strictEqual(parsed1.hasValidationStamp, true);
console.log('✓ Real-world OCR text parsed and validated successfully');

// Expired year
const expiredOcr = `USTP Office of the Registrar VALID: 1st Semester A.Y. 2024 - 2025`;
const parsedExpired = parseStickerText(expiredOcr, '2026-2027', '1st Semester');
assert.strictEqual(parsedExpired.isValid, false);
assert.strictEqual(parsedExpired.academicYear, '2024-2025');
assert.strictEqual(parsedExpired.semester, '1st Semester');
assert.ok(parsedExpired.message.includes('expired'), `Expected expired message, got: ${parsedExpired.message}`);
console.log('✓ Expired sticker correctly identified and explained');

// Semester mismatch
const semMismatchOcr = `USTP Registrar VALID 2nd Semester AY 2026-2027`;
const parsedSemMismatch = parseStickerText(semMismatchOcr, '2026-2027', '1st Semester');
assert.strictEqual(parsedSemMismatch.isValid, false);
assert.strictEqual(parsedSemMismatch.semesterMatches, false);
assert.strictEqual(parsedSemMismatch.yearMatches, true);
assert.ok(parsedSemMismatch.message.includes('Semester mismatch'), `Expected semester mismatch, got: ${parsedSemMismatch.message}`);
console.log('✓ Semester mismatch correctly flagged with clear reason');

// Unreadable sticker
const unreadableOcr = `Some random text with no terms or years anywhere on card`;
const parsedUnreadable = parseStickerText(unreadableOcr, '2026-2027', '1st Semester');
assert.strictEqual(parsedUnreadable.isValid, false);
assert.strictEqual(parsedUnreadable.academicYear, null);
assert.strictEqual(parsedUnreadable.semester, null);
console.log('✓ Unreadable sticker handled gracefully');

// 4. Back ID Verification Logic (Sticker + DOB)
console.log('Testing Back ID Birthdate Matching Behavior...');

// Case A: Back of card does NOT contain birthdate (normal case for USTP ID back)
const noDobText = `USTP Registrar VALID: 1st Semester AY 2026-2027`;
const dobResA = verifyBirthdateMatch(noDobText, '2004-05-15');
const hasDetectedDobA = !!dobResA.detectedBirthdate;
const dobValidA = hasDetectedDobA ? (dobResA.matches === true) : true;
assert.strictEqual(dobValidA, true, 'Absence of DOB on back ID should not cause rejection');
console.log('✓ Missing DOB on back ID does not cause false rejection');

// Case B: Back of card contains MATCHING birthdate
const matchingDobText = `USTP Registrar VALID: 1st Semester AY 2026-2027 DOB: 05/15/2004`;
const dobResB = verifyBirthdateMatch(matchingDobText, '2004-05-15');
const hasDetectedDobB = !!dobResB.detectedBirthdate;
const dobValidB = hasDetectedDobB ? (dobResB.matches === true) : true;
assert.strictEqual(dobValidB, true);
assert.strictEqual(dobResB.matches, true);
console.log('✓ Matching DOB on back ID verified');

// Case C: Back of card contains CONFLICTING birthdate
const conflictDobText = `USTP Registrar VALID: 1st Semester AY 2026-2027 DOB: 12/25/1990`;
const dobResC = verifyBirthdateMatch(conflictDobText, '2004-05-15');
const hasDetectedDobC = !!dobResC.detectedBirthdate;
const dobValidC = hasDetectedDobC ? (dobResC.matches === true) : true;
assert.strictEqual(dobValidC, false, 'Conflicting DOB should fail validation');
assert.strictEqual(dobResC.matches, false);
console.log('✓ Conflicting DOB on back ID properly rejected');

console.log('\nALL SERVER TESTS PASSED SUCCESSFULLY! ✨');
