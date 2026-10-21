// js/services/verification_service.js
/**
 * Smart AI & Intelligent Cross-Matching Engine
 * Compares imported scholarship grantee records (from Super Admin) against
 * official school student records (from Admin's uploaded list or school database)
 * using multi-field fuzzy, Levenshtein edit distance, token overlap, and academic rule scoring.
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

        // Clean up common "N/A" artifacts and leading/trailing commas
        fullName = fullName.replace(/\bN\/A\b/gi, '').replace(/\s+/g, ' ').replace(/^,\s*|,\s*$/g, '').trim();
        if (!fullName || fullName === ',') return { lastName: '', firstName: '', middleName: '', mi: '', cleanKey: '', tokens: [] };

        let lastName = '';
        let firstName = '';
        let middleName = '';
        let mi = '';

        const suffixes = new Set(['JR', 'JR.', 'SR', 'SR.', 'II', 'III', 'IV', 'V', 'VI']);
        const surnamePrefixes = new Set(['DE', 'DEL', 'DELA', 'DELOS', 'SAN', 'STA', 'STA.', 'SANTA', 'VAN', 'VON', 'AL']);

        if (fullName.includes(',')) {
            const parts = fullName.split(',');
            lastName = parts[0].trim();
            const rest = parts.slice(1).join(',').trim().split(/\s+/).filter(Boolean);
            if (rest.length > 0) {
                const lastToken = rest[rest.length - 1];
                if (suffixes.has(lastToken.toUpperCase())) {
                    const suff = rest.pop();
                    if (rest.length > 1) {
                        middleName = rest.pop().replace(/\.$/, '');
                        mi = middleName ? middleName.charAt(0).toUpperCase() : '';
                        firstName = rest.join(' ');
                    } else {
                        firstName = rest.join(' ');
                    }
                    lastName = `${lastName} ${suff}`.trim();
                } else if (lastToken.length === 1 || (lastToken.length === 2 && lastToken.endsWith('.'))) {
                    mi = lastToken.charAt(0).toUpperCase();
                    middleName = rest.pop().replace(/\.$/, '');
                    firstName = rest.join(' ');
                } else if (rest.length >= 2) {
                    middleName = rest.pop();
                    mi = middleName.charAt(0).toUpperCase();
                    firstName = rest.join(' ');
                } else {
                    firstName = rest.join(' ');
                }
            }
        } else {
            let tokens = fullName.split(/\s+/).filter(Boolean);
            if (tokens.length === 1) {
                lastName = tokens[0];
            } else if (tokens.length === 2) {
                firstName = tokens[0];
                lastName = tokens[1];
            } else {
                let suffix = '';
                if (suffixes.has(tokens[tokens.length - 1].toUpperCase())) {
                    suffix = tokens.pop();
                }

                if (tokens.length >= 4 && (tokens[tokens.length - 3].toUpperCase() === 'DE' && (tokens[tokens.length - 2].toUpperCase() === 'LA' || tokens[tokens.length - 2].toUpperCase() === 'LOS'))) {
                    lastName = tokens.slice(tokens.length - 3).join(' ');
                    tokens = tokens.slice(0, tokens.length - 3);
                    if (tokens.length > 1) {
                        middleName = tokens.pop().replace(/\.$/, '');
                        firstName = tokens.join(' ');
                    } else {
                        firstName = tokens[0] || '';
                    }
                } else if (tokens.length >= 3 && surnamePrefixes.has(tokens[tokens.length - 2].toUpperCase())) {
                    lastName = tokens.slice(tokens.length - 2).join(' ');
                    tokens = tokens.slice(0, tokens.length - 2);
                    if (tokens.length > 1) {
                        middleName = tokens.pop().replace(/\.$/, '');
                        firstName = tokens.join(' ');
                    } else {
                        firstName = tokens[0] || '';
                    }
                } else {
                    lastName = tokens.pop();
                    const lastToken = tokens[tokens.length - 1];
                    if (lastToken.length === 1 || (lastToken.length === 2 && lastToken.endsWith('.'))) {
                        middleName = tokens.pop().replace(/\.$/, '');
                        firstName = tokens.join(' ');
                    } else if (tokens.length >= 2) {
                        middleName = tokens.pop();
                        firstName = tokens.join(' ');
                    } else {
                        firstName = tokens.join(' ');
                    }
                }

                if (suffix) {
                    lastName = `${lastName} ${suffix}`.trim();
                }
                if (middleName) {
                    mi = middleName.charAt(0).toUpperCase();
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
            .filter(t => t.length > 0);

        return { lastName, firstName, middleName, mi, cleanKey, tokens };
    }

    /**
     * Computes the Levenshtein edit distance between two strings
     */
    static levenshteinDistance(s1, s2) {
        s1 = String(s1 || '').toLowerCase();
        s2 = String(s2 || '').toLowerCase();
        if (s1 === s2) return 0;
        if (!s1.length) return s2.length;
        if (!s2.length) return s1.length;

        const prev = new Array(s2.length + 1);
        const curr = new Array(s2.length + 1);
        for (let j = 0; j <= s2.length; j++) prev[j] = j;

        for (let i = 1; i <= s1.length; i++) {
            curr[0] = i;
            const c1 = s1.charCodeAt(i - 1);
            for (let j = 1; j <= s2.length; j++) {
                const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(
                    prev[j] + 1,
                    curr[j - 1] + 1,
                    prev[j - 1] + cost
                );
            }
            for (let j = 0; j <= s2.length; j++) prev[j] = curr[j];
        }
        return prev[s2.length];
    }

    /**
     * Normalized Levenshtein similarity (0.0 to 1.0)
     */
    static levenshteinSimilarity(s1, s2) {
        s1 = String(s1 || '').trim().toLowerCase();
        s2 = String(s2 || '').trim().toLowerCase();
        if (s1 === s2) return 1.0;
        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen === 0) return 1.0;
        const dist = this.levenshteinDistance(s1, s2);
        return Math.max(0, 1 - (dist / maxLen));
    }

    /**
     * Calculates token similarity between two arrays of tokens (0.0 to 1.0).
     * Handles compound names, slight typos (e.g. MAY vs MAE), and token subsets.
     */
    static calculateTokenSimilarity(tokensA = [], tokensB = []) {
        if (!tokensA.length || !tokensB.length) return 0.0;

        let scoreA = 0;
        for (const tA of tokensA) {
            let best = 0;
            for (const tB of tokensB) {
                if (tA === tB) { best = 1.0; break; }
                const lev = this.levenshteinSimilarity(tA, tB);
                const jaro = this.calculateJaroWinkler(tA, tB);
                const sim = Math.max(lev, jaro);
                if (sim > best) best = sim;
            }
            scoreA += best;
        }
        const avgA = scoreA / tokensA.length;

        let scoreB = 0;
        for (const tB of tokensB) {
            let best = 0;
            for (const tA of tokensA) {
                if (tA === tB) { best = 1.0; break; }
                const lev = this.levenshteinSimilarity(tA, tB);
                const jaro = this.calculateJaroWinkler(tA, tB);
                const sim = Math.max(lev, jaro);
                if (sim > best) best = sim;
            }
            scoreB += best;
        }
        const avgB = scoreB / tokensB.length;

        return Math.max((avgA + avgB) / 2, Math.min(avgA, avgB) * 0.85 + Math.max(avgA, avgB) * 0.15);
    }

    /**
     * Backward-compatible alias for token overlap/similarity
     */
    static calculateTokenOverlap(tokens1 = [], tokens2 = []) {
        return this.calculateTokenSimilarity(tokens1, tokens2);
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

        if (p1.includes(p2) || p2.includes(p1)) return 0.90;

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
     * Matches a single Super Admin imported grantee against the official school student records.
     * Uses strict surname verification, token-based given name matching, and robust candidate rejection.
     */
    static verifyGrantee(grantee, schoolStudents) {
        const granteeRawName = grantee.name || grantee.fullName || grantee.full_name || `${grantee.last_name || grantee.lastName || ''} ${grantee.first_name || grantee.firstName || ''} ${grantee.middle_name || grantee.middleName || ''}`;
        const granteeName = this.normalizeName(granteeRawName);
        const granteeId = String(grantee.student_id || grantee.studentId || grantee.student_no || grantee.studentNo || '').trim();
        const granteeProg = grantee.course || grantee.program || grantee.program_name || grantee.programName || '';
        const granteeYear = String(grantee.year || grantee.year_level || grantee.yearLevel || '1').replace(/[^0-9]/g, '');

        const hasValidGranteeId = Boolean(granteeId && !['unassigned', 'n/a', 'none', 'null', 'undefined', ''].includes(granteeId.toLowerCase()));

        let bestMatch = null;
        let highestConfidence = 0;
        let bestBreakdown = { idScore: 0, nameScore: 0, progScore: 0, yearScore: 0, totalScore: 0 };
        let bestNameSim = 0;

        // Structured grantee fields
        const gLast = (grantee.last_name || grantee.lastName || granteeName.lastName || '').trim();
        const gFirst = (grantee.first_name || grantee.firstName || granteeName.firstName || '').trim();
        const gMiddle = (grantee.middle_name || grantee.middleName || granteeName.middleName || '').replace(/\b(n\/a|na|none|null|undefined)\b/gi, '').trim();
        const gMI = gMiddle ? gMiddle.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() : (granteeName.mi || '');
        const gTokens = gFirst.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
        const gLastClean = gLast.toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const student of (schoolStudents || [])) {
            const studentRawName = student.fullName || student.full_name || student.name || `${student.lastName || student.last_name || ''} ${student.firstName || student.first_name || ''}`;
            const studentName = this.normalizeName(studentRawName);
            const studentId = String(student.studentId || student.student_id || student.studentNo || student.student_no || student.id || '').trim();
            const studentProg = student.course || student.program || student.programName || student.program_name || '';
            const studentYear = String(student.year || student.scholarYearLevel || student.year_level || student.yearLevel || '1').replace(/[^0-9]/g, '');

            const hasValidStudentId = Boolean(studentId && !['unassigned', 'n/a', 'none', 'null', 'undefined', ''].includes(studentId.toLowerCase()));
            const canMatchId = hasValidGranteeId && hasValidStudentId;

            let idMatch = false;
            let idSim = 0;
            if (canMatchId) {
                idSim = this.matchStudentId(granteeId, studentId);
                if (idSim >= 0.85) {
                    idMatch = true;
                } else if (granteeId.length >= 5 && studentId.length >= 5) {
                    // Conflicting valid institutional student IDs -> Strict rejection
                    continue;
                }
            }

            const sLast = (student.lastName || student.last_name || studentName.lastName || '').trim();
            const sFirst = (student.firstName || student.first_name || studentName.firstName || '').trim();
            const sMiddle = (student.middleName || student.middle_name || studentName.middleName || '').replace(/\b(n\/a|na|none|null|undefined)\b/gi, '').trim();
            const sMI = sMiddle ? sMiddle.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() : (studentName.mi || '');
            const sTokens = sFirst.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
            const sLastClean = sLast.toLowerCase().replace(/[^a-z0-9]/g, '');

            // 1. Surname Matching
            let lastSim = this.levenshteinSimilarity(gLastClean, sLastClean);
            if (gLastClean && sLastClean && (gLastClean.includes(sLastClean) || sLastClean.includes(gLastClean))) {
                lastSim = Math.max(lastSim, 0.90);
            }

            // Hard candidate rejection: Surname must match strongly (>= 0.82) unless valid matching student ID
            if (!idMatch && lastSim < 0.82) {
                continue;
            }

            // 2. First Name Matching (token similarity & Levenshtein)
            let firstSim = this.calculateTokenSimilarity(gTokens, sTokens);
            if (gFirst && sFirst) {
                const jaroFirst = this.calculateJaroWinkler(gFirst, sFirst);
                firstSim = Math.max(firstSim, jaroFirst);
            }

            // Hard candidate rejection: First name must match reasonably (>= 0.70) unless valid matching student ID
            if (!idMatch && firstSim < 0.70) {
                continue;
            }

            // 3. Middle Name / Initial Influence (Bonus or Penalty only)
            let miModifier = 0.0;
            if (gMI && sMI) {
                if (gMI === sMI) {
                    miModifier = 0.05; // Bonus for confirmed matching initial
                } else {
                    miModifier = -0.10; // Penalty for conflicting middle initials
                }
            }

            // 4. Combined Name Similarity
            let nameSim = Math.min(1.0, Math.max(0.0, (lastSim * 0.52) + (firstSim * 0.43) + miModifier));
            if (lastSim >= 0.95 && firstSim >= 0.90) {
                nameSim = 1.0;
            }

            // Hard candidate rejection: Name similarity must be >= 0.75 unless valid matching student ID
            if (!idMatch && nameSim < 0.75) {
                continue;
            }

            // 5. Program & Year Level Matching
            const progSim = this.fuzzyMatchProgram(granteeProg, studentProg);
            const yearSim = (granteeYear && studentYear && granteeYear === studentYear) ? 1.0 : (granteeYear ? 0.7 : 0.85);

            let idScore = 0;
            let nameScore = 0;
            let progScore = 0;
            let yearScore = 0;

            if (canMatchId) {
                idScore = idSim * 35;
                nameScore = nameSim * 45;
                progScore = progSim * 10;
                yearScore = yearSim * 10;
            } else {
                idScore = 0;
                nameScore = nameSim * 85;
                progScore = progSim * 10;
                yearScore = yearSim * 5;
            }

            const totalScore = Math.round(idScore + nameScore + progScore + yearScore);

            if (totalScore > highestConfidence) {
                highestConfidence = totalScore;
                bestMatch = student;
                bestBreakdown = { idScore, nameScore, progScore, yearScore, totalScore };
                bestNameSim = nameSim;
            }
        }

        // If no candidate met the minimum standards, grantee is NOT FOUND
        if (!bestMatch || highestConfidence < 50) {
            return {
                grantee,
                matchedStudent: null,
                confidence: 0,
                classification: 'NEEDS_REVIEW',
                isEnrolled: false,
                specialStatusReason: 'Not enrolled',
                discrepancies: ['Student not found in school student masterlist'],
                breakdown: { idScore: 0, nameScore: 0, progScore: 0, yearScore: 0, totalScore: 0 }
            };
        }

        // Evaluate Enrollment Status from verified school records
        let rawStatus = String(bestMatch.status || bestMatch.enrollmentStatus || bestMatch.submissionStatus || '').trim();
        if (!rawStatus) rawStatus = 'Enrolled';

        const lowerStatus = rawStatus.toLowerCase();
        const isEnrolled = lowerStatus === 'enrolled' || lowerStatus === 'active' || lowerStatus === 'verified' || lowerStatus === 'approved' || lowerStatus === 'regular' || lowerStatus === 'irregular';

        // Specific Special Status Categorization for Form 3
        let specialStatusReason = 'Not enrolled';
        if (lowerStatus.includes('drop')) specialStatusReason = 'Dropped';
        else if (lowerStatus.includes('waiv')) specialStatusReason = 'Waived';
        else if (lowerStatus.includes('loa') || lowerStatus.includes('leave')) specialStatusReason = 'On Leave of Absence (LOA)';
        else if (lowerStatus.includes('transfer')) specialStatusReason = 'Transferee';
        else if (lowerStatus.includes('graduat')) specialStatusReason = 'Graduated';
        else if (!isEnrolled) specialStatusReason = 'Not enrolled';

        // Discrepancy Diagnostics
        const discrepancies = [];
        if (hasValidGranteeId && bestBreakdown.idScore < 25) discrepancies.push('Student ID mismatch');
        if (bestNameSim < 0.90) discrepancies.push('Name spelling difference');
        if (bestBreakdown.progScore < 7 && granteeProg) discrepancies.push('Program difference');
        if (!isEnrolled) discrepancies.push(`Inactive in school records: ${specialStatusReason}`);

        // Intelligent Classification
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
            breakdown: bestBreakdown
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
