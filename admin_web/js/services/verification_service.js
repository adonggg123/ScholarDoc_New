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
     * Canonicalizes and cleans full names into structured parts and tokens.
     */
    static normalizeName(fullName) {
        fullName = String(fullName || '').trim();
        if (!fullName) return { lastName: '', firstName: '', middleName: '', mi: '', cleanKey: '', tokens: [] };

        // Clean up common "N/A" artifacts
        fullName = fullName.replace(/\bN\/A\b/gi, '').replace(/\s+/g, ' ').trim();

        let lastName = '';
        let firstName = '';
        let middleName = '';
        let mi = '';

        if (fullName.includes(',')) {
            const parts = fullName.split(',');
            lastName = parts[0].trim();
            const rest = parts.slice(1).join(',').trim().split(/\s+/).filter(Boolean);
            if (rest.length > 1) {
                const lastToken = rest[rest.length - 1];
                if (lastToken.length === 1 || (lastToken.length === 2 && lastToken.endsWith('.'))) {
                    mi = lastToken.charAt(0).toUpperCase();
                    middleName = rest.pop().replace(/\.$/, '');
                    firstName = rest.join(' ');
                } else if (rest.length >= 2) {
                    // In Philippine lists formatted "LASTNAME, FIRSTNAME MIDDLENAME",
                    // the trailing token is the middle name
                    middleName = rest.pop();
                    mi = middleName.charAt(0).toUpperCase();
                    firstName = rest.join(' ');
                } else {
                    firstName = rest.join(' ');
                }
            } else {
                firstName = rest.join(' ');
            }
        } else {
            const parts = fullName.split(/\s+/).filter(Boolean);
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
                    middleName = parts.pop().replace(/\.$/, '');
                    firstName = parts.join(' ');
                } else {
                    firstName = parts.join(' ');
                }
            }
        }

        const cleanKey = `${lastName} ${firstName} ${middleName}`
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        const tokens = `${lastName} ${firstName} ${middleName}`
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length > 1);

        return { lastName, firstName, middleName, mi, cleanKey, tokens };
    }

    /**
     * Calculates the token overlap similarity between two sets of name tokens (0.0 to 1.0)
     */
    static calculateTokenOverlap(tokens1 = [], tokens2 = []) {
        if (!tokens1.length || !tokens2.length) return 0.0;
        const shorter = tokens1.length <= tokens2.length ? tokens1 : tokens2;
        const longer = tokens1.length <= tokens2.length ? tokens2 : tokens1;

        let matchCount = 0;
        for (const tShort of shorter) {
            let best = 0;
            for (const tLong of longer) {
                const sim = this.calculateJaroWinkler(tShort, tLong);
                if (sim > best) best = sim;
            }
            if (best >= 0.85) {
                matchCount++;
            }
        }

        return matchCount / shorter.length;
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
        const granteeId = String(grantee.student_id || grantee.studentId || '').trim();
        const granteeProg = grantee.course || grantee.program || '';
        const granteeYear = String(grantee.year || grantee.year_level || '1').replace(/[^0-9]/g, '');

        const hasValidGranteeId = Boolean(granteeId && !['unassigned', 'n/a', 'none', 'null', 'undefined', ''].includes(granteeId.toLowerCase()));

        let bestMatch = null;
        let highestConfidence = 0;
        let matchBreakdown = { idScore: 0, nameScore: 0, progScore: 0, yearScore: 0, totalScore: 0 };

        for (const student of (schoolStudents || [])) {
            const studentName = this.normalizeName(student.fullName || student.name || `${student.lastName || student.last_name || ''} ${student.firstName || student.first_name || ''}`);
            const studentId = String(student.studentId || student.student_id || student.id || '').trim();
            const studentProg = student.course || student.program || '';
            const studentYear = String(student.year || student.scholarYearLevel || student.year_level || '1').replace(/[^0-9]/g, '');

            const hasValidStudentId = Boolean(studentId && !['unassigned', 'n/a', 'none', 'null', 'undefined', ''].includes(studentId.toLowerCase()));
            const canMatchId = hasValidGranteeId && hasValidStudentId;

            // Extract structured names (prefer explicit fields if present on objects)
            const gLast = (grantee.last_name || granteeName.lastName || '').trim();
            const gFirst = (grantee.first_name || granteeName.firstName || '').trim();
            const gMiddle = (grantee.middle_name || granteeName.middleName || '').replace(/\b(n\/a|na|none|null|undefined)\b/gi, '').trim();
            const gMI = gMiddle ? gMiddle.charAt(0).toUpperCase() : (granteeName.mi || '');

            const sLast = (student.lastName || student.last_name || studentName.lastName || '').trim();
            const sFirst = (student.firstName || student.first_name || studentName.firstName || '').trim();
            const sMiddle = (student.middleName || student.middle_name || studentName.middleName || '').replace(/\b(n\/a|na|none|null|undefined)\b/gi, '').trim();
            const sMI = sMiddle ? sMiddle.charAt(0).toUpperCase() : (studentName.mi || '');

            // 1. Last Name Matching
            const lastNameSim = this.calculateJaroWinkler(gLast, sLast);
            if (lastNameSim < 0.70) {
                continue; // Surnames do not match, skip candidate
            }

            // 2. First Name Matching (exact, Jaro-Winkler, and token overlap)
            let firstNameSim = 0.0;
            if (gFirst && sFirst) {
                if (gFirst.toLowerCase() === sFirst.toLowerCase()) {
                    firstNameSim = 1.0;
                } else {
                    const jaroFirst = this.calculateJaroWinkler(gFirst, sFirst);
                    const gTokens = gFirst.toLowerCase().split(/\s+/).filter(Boolean);
                    const sTokens = sFirst.toLowerCase().split(/\s+/).filter(Boolean);
                    const tokenOverlap = this.calculateTokenOverlap(gTokens, sTokens);
                    firstNameSim = Math.max(jaroFirst, tokenOverlap);
                }
            } else {
                firstNameSim = 0.85;
            }

            if (firstNameSim < 0.60) {
                continue; // First names do not match, skip candidate
            }

            // 3. User Rule:
            // Match JUST with firstname and lastname if there is no middle name, or if middle initial
            const hasMiddleG = Boolean(gMiddle && gMiddle.toLowerCase() !== 'na' && gMiddle.toLowerCase() !== 'none');
            const hasMiddleS = Boolean(sMiddle && sMiddle.toLowerCase() !== 'na' && sMiddle.toLowerCase() !== 'none');
            const isInitialG = hasMiddleG && gMiddle.length === 1;
            const isInitialS = hasMiddleS && sMiddle.length === 1;

            let nameSim = 0.0;

            if (!hasMiddleG || !hasMiddleS || isInitialG || isInitialS) {
                // Match JUST with firstname and lastname!
                nameSim = (lastNameSim * 0.5) + (firstNameSim * 0.5);

                // If both happen to have initials and they match, or initial matches the other's middle name initial:
                if (gMI && sMI && gMI.toUpperCase() === sMI.toUpperCase()) {
                    nameSim = Math.max(nameSim, 0.98);
                }

                if (lastNameSim >= 0.95 && firstNameSim >= 0.90) {
                    nameSim = 1.0;
                }
            } else {
                // Both have full middle names: compare middle names as well
                const middleSim = this.calculateJaroWinkler(gMiddle, sMiddle);
                nameSim = (lastNameSim * 0.45) + (firstNameSim * 0.45) + (middleSim * 0.10);
                if (lastNameSim >= 0.95 && firstNameSim >= 0.90 && middleSim >= 0.85) {
                    nameSim = 1.0;
                }
            }

            // 2. Program Similarity
            const progSim = this.fuzzyMatchProgram(granteeProg, studentProg);

            // 3. Year Level Similarity
            const yearSim = (granteeYear && studentYear && granteeYear === studentYear) ? 1.0 : (granteeYear ? 0.6 : 0.8);

            let idScore = 0;
            let nameScore = 0;
            let progScore = 0;
            let yearScore = 0;

            if (canMatchId) {
                const idSim = this.matchStudentId(granteeId, studentId);
                idScore = idSim * 35;
                nameScore = nameSim * 45;
                progScore = progSim * 10;
                yearScore = yearSim * 10;
            } else {
                // Adaptive weighting when ID is unassigned or not present in grantee record
                idScore = 0;
                nameScore = nameSim * 70;
                progScore = progSim * 15;
                yearScore = yearSim * 15;
            }

            const totalScore = Math.round(idScore + nameScore + progScore + yearScore);

            if (totalScore > highestConfidence) {
                highestConfidence = totalScore;
                bestMatch = student;
                matchBreakdown = { idScore, nameScore, progScore, yearScore, totalScore };
            }
        }

        // Evaluate Status from school student records
        let rawStatus = String(bestMatch?.status || bestMatch?.enrollmentStatus || bestMatch?.submissionStatus || '').trim();
        if (!bestMatch || highestConfidence < 40) {
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
        if (!bestMatch || highestConfidence < 40) {
            discrepancies.push('Student not found in school student masterlist');
        } else {
            if (hasValidGranteeId && matchBreakdown.idScore < 25) discrepancies.push('Student ID mismatch');
            if (matchBreakdown.nameScore < 50) discrepancies.push('Name spelling difference');
            if (matchBreakdown.progScore < 10 && granteeProg) discrepancies.push('Program difference');
            if (!isEnrolled) discrepancies.push(`Inactive in school records: ${specialStatusReason}`);
        }

        // Classification
        let classification = 'NEEDS_REVIEW';

        if (highestConfidence >= 80) {
            if (isEnrolled) {
                classification = 'MATCHED_FORM2';
            } else {
                classification = 'INACTIVE_FORM3';
            }
        } else if (highestConfidence >= 65 && !isEnrolled && discrepancies.length <= 1) {
            classification = 'INACTIVE_FORM3';
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

        if (!schoolStudents || schoolStudents.length === 0) {
            // When school students are not yet loaded, all grantees are placed into
            // needsReviewList so they remain fully accessible for manual review/approval
            const emptyReviewList = (grantees || []).map((grantee, idx) => ({
                grantee,
                granteeIndex: idx,
                matchedStudent: null,
                confidence: 0,
                classification: 'NEEDS_REVIEW',
                isEnrolled: false,
                specialStatusReason: 'Not enrolled',
                discrepancies: ['School student masterlist is empty or not yet loaded'],
                breakdown: { idScore: 0, nameScore: 0, progScore: 0, yearScore: 0, totalScore: 0 }
            }));

            return {
                total: grantees ? grantees.length : 0,
                form2List,
                form3List,
                needsReviewList: emptyReviewList,
                accuracyRate: 0
            };
        }

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
