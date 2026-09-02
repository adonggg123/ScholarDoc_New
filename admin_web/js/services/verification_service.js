// js/services/verification_service.js
/**
 * Smart AI & Intelligent Student Verification Engine
 * Compares imported scholarship grantee records (from Super Admin) against
 * official school student records (from Admin's uploaded list or school database)
 * using multi-field fuzzy, semantic similarity, and academic rule scoring.
 */

// Known Program Acronym and Equivalent Mappings
const PROGRAM_MAPPINGS = {
    'bsit': ['bachelor of science in information technology', 'bs in information technology', 'information technology', 'bsit', 'bs-it'],
    'bscs': ['bachelor of science in computer science', 'bs in computer science', 'computer science', 'bscs', 'bs-cs'],
    'bsee': ['bachelor of science in electrical engineering', 'bs in electrical engineering', 'electrical engineering', 'bsee', 'bs-ee'],
    'bsce': ['bachelor of science in civil engineering', 'bs in civil engineering', 'civil engineering', 'bsce', 'bs-ce'],
    'bsme': ['bachelor of science in mechanical engineering', 'bs in mechanical engineering', 'mechanical engineering', 'bsme', 'bs-me'],
    'bsece': ['bachelor of science in electronics engineering', 'bs in electronics engineering', 'electronics engineering', 'bsece', 'bs-ece'],
    'bsba': ['bachelor of science in business administration', 'bs in business administration', 'business administration', 'bsba', 'bs-ba'],
    'bsed': ['bachelor of secondary education', 'bs in secondary education', 'secondary education', 'bsed', 'bs-ed'],
    'beed': ['bachelor of elementary education', 'bs in elementary education', 'elementary education', 'beed', 'bs-ed'],
    'bstm': ['bachelor of science in tourism management', 'tourism management', 'bstm', 'bs-tm'],
    'bshm': ['bachelor of science in hospitality management', 'hospitality management', 'bshm', 'bs-hm'],
    'bsa': ['bachelor of science in agriculture', 'agriculture', 'bsa', 'bs-a'],
    'bs crim': ['bachelor of science in criminology', 'criminology', 'bs crim', 'bscrim']
};

export class VerificationService {
    /**
     * Canonicalizes and cleans full names into structured parts.
     */
    static normalizeName(fullName) {
        fullName = String(fullName || '').trim();
        if (!fullName) return { lastName: '', firstName: '', middleName: '', mi: '', cleanKey: '' };

        let lastName = '';
        let firstName = '';
        let middleName = '';
        let mi = '';

        if (fullName.includes(',')) {
            const parts = fullName.split(',');
            lastName = parts[0].trim();
            const rest = parts.slice(1).join(',').trim().split(/\s+/);
            if (rest.length > 1) {
                const lastToken = rest[rest.length - 1];
                if (lastToken.length === 1 || (lastToken.length === 2 && lastToken.endsWith('.'))) {
                    mi = lastToken.charAt(0).toUpperCase();
                    middleName = rest.pop();
                    firstName = rest.join(' ');
                } else {
                    firstName = rest.join(' ');
                }
            } else {
                firstName = rest.join(' ');
            }
        } else {
            const parts = fullName.split(/\s+/);
            if (parts.length === 1) {
                lastName = parts[0];
            } else if (parts.length === 2) {
                firstName = parts[0];
                lastName = parts[1];
            } else {
                lastName = parts.pop();
                const lastToken = parts[parts.length - 1];
                if (lastToken.length === 1 || (lastToken.length === 2 && lastToken.endsWith('.'))) {
                    mi = lastToken.charAt(0).toUpperCase();
                    middleName = parts.pop();
                }
                firstName = parts.join(' ');
            }
        }

        const cleanKey = `${lastName} ${firstName} ${middleName}`
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        return { lastName, firstName, middleName, mi, cleanKey };
    }

    /**
     * Jaro-Winkler string distance algorithm (0.0 to 1.0)
     */
    static calculateJaroWinkler(s1, s2) {
        s1 = String(s1 || '').toLowerCase().trim();
        s2 = String(s2 || '').toLowerCase().trim();
        if (s1 === s2) return 1.0;
        if (!s1 || !s2) return 0.0;

        const mRange = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
        const s1Matches = new Array(s1.length).fill(false);
        const s2Matches = new Array(s2.length).fill(false);

        let matches = 0;
        for (let i = 0; i < s1.length; i++) {
            const start = Math.max(0, i - mRange);
            const end = Math.min(i + mRange + 1, s2.length);
            for (let j = start; j < end; j++) {
                if (!s2Matches[j] && s1[i] === s2[j]) {
                    s1Matches[i] = true;
                    s2Matches[j] = true;
                    matches++;
                    break;
                }
            }
        }

        if (matches === 0) return 0.0;

        let transpositions = 0;
        let k = 0;
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i]) {
                while (!s2Matches[k]) k++;
                if (s1[i] !== s2[k]) transpositions++;
                k++;
            }
        }

        const jaro = (
            (matches / s1.length) +
            (matches / s2.length) +
            ((matches - transpositions / 2) / matches)
        ) / 3;

        // Prefix scale
        let prefix = 0;
        for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }

        return jaro + prefix * 0.1 * (1 - jaro);
    }

    /**
     * Semantic and acronym matching for degree programs
     */
    static fuzzyMatchProgram(p1, p2) {
        p1 = String(p1 || '').toLowerCase().trim();
        p2 = String(p2 || '').toLowerCase().trim();
        if (!p1 || !p2) return 0.5;
        if (p1 === p2) return 1.0;

        const p1Clean = p1.replace(/[^a-z0-9]/g, '');
        const p2Clean = p2.replace(/[^a-z0-9]/g, '');
        if (p1Clean === p2Clean) return 1.0;

        for (const [, variants] of Object.entries(PROGRAM_MAPPINGS)) {
            const p1Has = variants.some(v => p1.includes(v) || v.includes(p1));
            const p2Has = variants.some(v => p2.includes(v) || v.includes(p2));
            if (p1Has && p2Has) return 0.95;
        }

        return this.calculateJaroWinkler(p1, p2);
    }

    /**
     * Compares Student IDs with normalization
     */
    static matchStudentId(id1, id2) {
        id1 = String(id1 || '').trim().replace(/[^0-9a-zA-Z]/g, '');
        id2 = String(id2 || '').trim().replace(/[^0-9a-zA-Z]/g, '');
        if (!id1 || !id2) return 0.0;
        if (id1 === id2) return 1.0;
        if (id1.includes(id2) || id2.includes(id1)) return 0.85;
        return 0.0;
    }

    /**
     * Matches a single Super Admin imported grantee against the Admin's school student masterlist.
     */
    static verifyGrantee(grantee, schoolStudents) {
        const granteeName = this.normalizeName(grantee.name || `${grantee.last_name || ''} ${grantee.first_name || ''} ${grantee.middle_name || ''}`);
        const granteeId = grantee.student_id || grantee.studentId || '';
        const granteeProg = grantee.course || grantee.program || '';
        const granteeYear = String(grantee.year || grantee.year_level || '1').replace(/[^0-9]/g, '');

        let bestMatch = null;
        let highestConfidence = 0;
        let matchBreakdown = { idScore: 0, nameScore: 0, progScore: 0, yearScore: 0 };

        for (const student of schoolStudents) {
            const studentName = this.normalizeName(student.fullName || student.name || `${student.lastName || student.last_name || ''} ${student.firstName || student.first_name || ''}`);
            const studentId = student.studentId || student.student_id || student.id || '';
            const studentProg = student.course || student.program || '';
            const studentYear = String(student.year || student.scholarYearLevel || student.year_level || '1').replace(/[^0-9]/g, '');

            // 1. Student ID Score (Max 40 points)
            const idSim = this.matchStudentId(granteeId, studentId);
            const idScore = idSim * 40;

            // 2. Name Score (Max 40 points)
            const lastNameSim = this.calculateJaroWinkler(granteeName.lastName, studentName.lastName);
            const firstNameSim = this.calculateJaroWinkler(granteeName.firstName, studentName.firstName);
            const directSim = this.calculateJaroWinkler(granteeName.cleanKey, studentName.cleanKey);
            const nameSim = Math.max(directSim, (lastNameSim * 0.6 + firstNameSim * 0.4));
            const nameScore = nameSim * 40;

            // 3. Program Score (Max 10 points)
            const progSim = this.fuzzyMatchProgram(granteeProg, studentProg);
            const progScore = progSim * 10;

            // 4. Year Level Score (Max 10 points)
            const yearScore = (granteeYear && studentYear && granteeYear === studentYear) ? 10 : 5;

            const totalScore = Math.round(idScore + nameScore + progScore + yearScore);

            if (totalScore > highestConfidence) {
                highestConfidence = totalScore;
                bestMatch = student;
                matchBreakdown = { idScore, nameScore, progScore, yearScore, totalScore };
            }
        }

        // Evaluate Status from school student records
        let rawStatus = String(bestMatch?.status || bestMatch?.enrollmentStatus || bestMatch?.submissionStatus || '').trim();
        if (!bestMatch || highestConfidence < 50) {
            rawStatus = 'Not enrolled';
        } else if (!rawStatus) {
            rawStatus = 'Enrolled'; // Present in official school masterlist file
        }

        const lowerStatus = rawStatus.toLowerCase();
        const isEnrolled = lowerStatus === 'enrolled' || lowerStatus === 'active' || lowerStatus === 'verified' || lowerStatus === 'approved' || lowerStatus === 'regular' || lowerStatus === 'irregular';

        // Specific Special Status Categorization
        let specialStatusReason = 'Not enrolled';
        if (lowerStatus.includes('drop')) specialStatusReason = 'Dropped';
        else if (lowerStatus.includes('waiv')) specialStatusReason = 'Waived';
        else if (lowerStatus.includes('loa') || lowerStatus.includes('leave')) specialStatusReason = 'On Leave of Absence (LOA)';
        else if (lowerStatus.includes('transfer')) specialStatusReason = 'Transferee';
        else if (lowerStatus.includes('graduat')) specialStatusReason = 'Graduated';
        else if (!isEnrolled) specialStatusReason = 'Not enrolled';

        // Discrepancies
        const discrepancies = [];
        if (!bestMatch || highestConfidence < 50) {
            discrepancies.push('Student not found in school student masterlist');
        } else {
            if (matchBreakdown.idScore < 30 && granteeId) discrepancies.push('Student ID mismatch');
            if (matchBreakdown.nameScore < 30) discrepancies.push('Name spelling difference');
            if (matchBreakdown.progScore < 6 && granteeProg) discrepancies.push('Program difference');
            if (!isEnrolled) discrepancies.push(`Inactive in school records: ${specialStatusReason}`);
        }

        // Classification
        let classification = 'NEEDS_REVIEW';

        if (highestConfidence >= 85) {
            if (isEnrolled) {
                classification = 'MATCHED_FORM2';
            } else {
                classification = 'INACTIVE_FORM3';
            }
        } else if (highestConfidence >= 65 && !isEnrolled && discrepancies.length === 1) {
            classification = 'INACTIVE_FORM3';
        } else if (!bestMatch || highestConfidence < 40) {
            classification = 'INACTIVE_FORM3'; // Not found in school records
            specialStatusReason = 'Not enrolled';
        } else {
            classification = 'NEEDS_REVIEW';
        }

        return {
            grantee,
            matchedStudent: bestMatch,
            confidence: highestConfidence,
            classification,
            isEnrolled,
            specialStatusReason,
            discrepancies,
            breakdown: matchBreakdown
        };
    }

    /**
     * Cross-verifies an entire list of Super Admin grantees against the Admin's school students list.
     */
    static runBatchVerification(grantees, schoolStudents) {
        const form2List = [];
        const form3List = [];
        const needsReviewList = [];

        grantees.forEach((grantee, idx) => {
            const verification = this.verifyGrantee(grantee, schoolStudents);
            verification.granteeIndex = idx;

            if (verification.classification === 'MATCHED_FORM2') {
                form2List.push(verification);
            } else if (verification.classification === 'INACTIVE_FORM3') {
                form3List.push(verification);
            } else {
                needsReviewList.push(verification);
            }
        });

        const total = grantees.length;
        const verifiedCount = form2List.length + form3List.length;
        const accuracyRate = total > 0 ? Math.round((verifiedCount / total) * 100) : 100;

        return {
            total,
            form2List,
            form3List,
            needsReviewList,
            accuracyRate
        };
    }
}
