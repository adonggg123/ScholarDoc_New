const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env if present
if (fs.existsSync(path.join(__dirname, '.env'))) {
    try {
        const envLines = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/);
        for (const line of envLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const k = trimmed.substring(0, eqIdx).trim();
                let v = trimmed.substring(eqIdx + 1).trim();
                if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                    v = v.slice(1, -1);
                }
                if (!process.env[k]) process.env[k] = v;
            }
        }
    } catch (_) {}
}

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
};

function findFilePath(urlPath) {
    // 1. Specific routing for Landing & Login
    if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/landing.html') {
        const landingFile = path.join(ROOT, 'student_web', 'landing.html');
        if (fs.existsSync(landingFile)) return landingFile;
    }

    if (urlPath === '/login' || urlPath === '/login.html') {
        const rootLogin = path.join(ROOT, 'login.html');
        if (fs.existsSync(rootLogin)) return rootLogin;
        const loginSuperAdmin = path.join(ROOT, 'superadmin_web', 'login.html');
        if (fs.existsSync(loginSuperAdmin)) return loginSuperAdmin;
        const loginAdmin = path.join(ROOT, 'admin_web', 'login.html');
        if (fs.existsSync(loginAdmin)) return loginAdmin;
    }

    // 2. Direct path resolution
    const directPath = path.join(ROOT, urlPath);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return directPath;
    }

    // 3. Fallback to superadmin_web
    const superAdminPath = path.join(ROOT, 'superadmin_web', urlPath);
    if (fs.existsSync(superAdminPath) && fs.statSync(superAdminPath).isFile()) {
        return superAdminPath;
    }

    // 4. Fallback to admin_web
    const adminPath = path.join(ROOT, 'admin_web', urlPath);
    if (fs.existsSync(adminPath) && fs.statSync(adminPath).isFile()) {
        return adminPath;
    }

    // 5. Fallback to student_web
    const studentPath = path.join(ROOT, 'student_web', urlPath);
    if (fs.existsSync(studentPath) && fs.statSync(studentPath).isFile()) {
        return studentPath;
    }

    return null;
}

// Active academic term settings (dynamically updated from system_settings)
let activeAcademicYear = '2026-2027';
let activeSemester = '1st Semester';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';

const https = require('https');

// Dynamic academic period synchronization with Supabase
async function syncAcademicTermFromDb() {
    try {
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        };
        const res = await fetch(`${SUPABASE_REST_URL}/system_settings?key=in.(current_academic_year,current_semester,academic_term)`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                for (const row of data) {
                    if (row.key === 'current_academic_year' && row.value) activeAcademicYear = String(row.value).trim();
                    if (row.key === 'current_semester' && row.value) activeSemester = String(row.value).trim();
                    if (row.key === 'academic_term' && typeof row.value === 'object') {
                        if (row.value.academic_year) activeAcademicYear = String(row.value.academic_year).trim();
                        if (row.value.semester) activeSemester = String(row.value.semester).trim();
                    }
                }
            }
        }
    } catch (e) {
        // Fallback to default
    }
}
setTimeout(syncAcademicTermFromDb, 1500);

function callOcrSpace(base64Image) {
    return new Promise((resolve) => {
        const postData = 'apikey=helloworld&language=eng&isOverlayRequired=false&OCREngine=2&base64Image=' + encodeURIComponent('data:image/jpeg;base64,' + base64Image);
        const req = https.request({
            hostname: 'api.ocr.space',
            path: '/parse/image',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const text = json.ParsedResults?.[0]?.ParsedText || '';
                    resolve(text);
                } catch (_) {
                    resolve('');
                }
            });
        });
        req.on('error', () => resolve(''));
        req.setTimeout(8000, () => {
            req.destroy();
            resolve('');
        });
        req.write(postData);
        req.end();
    });
}

// ── Document AI & OCR Caching Layer ──────────────────────────────────────────
const ocrTextCache = new Map(); // SHA-256(image) -> { text, engine, timestamp }
const documentAiEndpointCache = new Map(); // SHA-256(urlPath + payload) -> { response, timestamp }
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes TTL
const MAX_CACHE_ENTRIES = 500;

function getSha256(str) {
    return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function getFromCache(cache, key) {
    if (!cache.has(key)) return null;
    const entry = cache.get(key);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setInCache(cache, key, value) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
    cache.set(key, { value, timestamp: Date.now() });
}

function callVisionApi(base64Image) {
    return new Promise((resolve) => {
        if (!base64Image) return resolve({ text: '', engine: 'None' });

        const imgHash = getSha256(base64Image);
        const cached = getFromCache(ocrTextCache, imgHash);
        if (cached) {
            return resolve({ text: cached.text, engine: `${cached.engine} (Server Cached)` });
        }

        const visionPayload = JSON.stringify({
            requests: [{
                image: { content: base64Image },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
            }]
        });

        let finished = false;
        function finish(text, engine) {
            if (finished) return;
            finished = true;
            if (text && text.trim().length > 0) {
                setInCache(ocrTextCache, imgHash, { text, engine });
            }
            resolve({ text, engine });
        }

        const visionReq = https.request({
            hostname: 'vision.googleapis.com',
            path: '/v1/images:annotate?key=' + GOOGLE_API_KEY,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(visionPayload)
            }
        }, (visionRes) => {
            let visionData = '';
            visionRes.on('data', c => visionData += c);
            visionRes.on('end', async () => {
                let extractedText = '';
                let engine = 'Google Document AI via ScholarDoc Server';
                try {
                    const vJson = JSON.parse(visionData);
                    if (vJson.responses && vJson.responses[0]?.fullTextAnnotation) {
                        extractedText = vJson.responses[0].fullTextAnnotation.text || '';
                    } else if (vJson.responses && vJson.responses[0]?.textAnnotations?.[0]?.description) {
                        extractedText = vJson.responses[0].textAnnotations[0].description || '';
                    }
                } catch (_) {}

                if (!extractedText) {
                    extractedText = await callOcrSpace(base64Image);
                    if (extractedText) {
                        engine = 'High-Accuracy Document OCR via ScholarDoc Server';
                    }
                }
                finish(extractedText, engine);
            });
        });

        visionReq.on('error', async (err) => {
            console.warn('[Document AI] Google Vision error:', err.message);
            const ocrText = await callOcrSpace(base64Image);
            finish(ocrText, ocrText ? 'High-Accuracy Document OCR via ScholarDoc Server' : 'Fallback Engine');
        });

        // Fast failover timeout: 4s instead of 12s to prevent long hangs
        visionReq.setTimeout(4000, async () => {
            visionReq.destroy();
            const ocrText = await callOcrSpace(base64Image);
            finish(ocrText, ocrText ? 'High-Accuracy Document OCR via ScholarDoc Server' : 'Fallback Engine');
        });

        visionReq.write(visionPayload);
        visionReq.end();
    });
}

function normalizeName(name) {
    if (!name) return '';
    return name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\b(MR|MS|MRS|STUDENT|NAME|HON|DR|JR|SR|II|III|IV)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function verifyNameMatch(rawText, expectedName) {
    const raw = (rawText || '').toUpperCase();
    const expClean = normalizeName(expectedName);
    if (!expClean) {
        return {
            matches: false,
            detectedName: '',
            confidence: 0,
            message: 'No registered name provided for comparison.'
        };
    }

    if (!raw.trim()) {
        return {
            matches: false,
            detectedName: '',
            confidence: 0,
            message: "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible."
        };
    }

    const expTokens = expClean.split(' ').filter(t => t.length > 1);
    if (expTokens.length === 0) {
        return { matches: true, detectedName: expectedName, confidence: 1.0, message: 'Name verified' };
    }

    // Direct exact or substring match
    if (raw.includes(expClean)) {
        return {
            matches: true,
            detectedName: expectedName,
            confidence: 0.98,
            message: 'The name on your school ID matches your registered profile.'
        };
    }

    const surname = expTokens[expTokens.length - 1];
    const firstName = expTokens[0];

    const matchedTokens = expTokens.filter(token => {
        const regex = new RegExp(`\\b${token}\\b`, 'i');
        if (regex.test(raw)) return true;
        if (token.length >= 4 && raw.includes(token)) return true;
        return false;
    });

    const tokenRatio = matchedTokens.length / expTokens.length;

    // Line-by-line similarity
    const lines = raw.split(/[\r\n]+/).map(l => normalizeName(l)).filter(l => l.length >= 3);
    let bestLine = '';
    let bestScore = 0;

    for (const line of lines) {
        const lineTokens = line.split(' ').filter(Boolean);
        const intersect = expTokens.filter(t => lineTokens.includes(t));
        const score = intersect.length / Math.max(expTokens.length, 1);
        if (score > bestScore) {
            bestScore = score;
            bestLine = line;
        }
    }

    const hasFirstAndLast = (
        (raw.includes(firstName) || matchedTokens.includes(firstName)) &&
        (raw.includes(surname) || matchedTokens.includes(surname))
    );

    const isMatch = (tokenRatio >= 0.60 && (hasFirstAndLast || expTokens.length <= 2)) || bestScore >= 0.65;

    let message = '';
    if (isMatch) {
        message = 'The name on your school ID matches your registered profile.';
    } else {
        message = 'The name on your school ID does not match your registered profile. Please scan your own valid school ID again.';
    }

    return {
        matches: isMatch,
        detectedName: bestLine || matchedTokens.join(' '),
        confidence: Math.max(tokenRatio, bestScore),
        message
    };
}

const MONTH_NAMES = {
    'JAN': 1, 'JANUARY': 1, 'ENE': 1, 'ENERO': 1,
    'FEB': 2, 'FEBRUARY': 2, 'PEB': 2, 'PEBRERO': 2,
    'MAR': 3, 'MARCH': 3, 'MARSO': 3,
    'APR': 4, 'APRIL': 4, 'ABR': 4, 'ABRIL': 4,
    'MAY': 5, 'MAYO': 5,
    'JUN': 6, 'JUNE': 6, 'HUN': 6, 'HUNYO': 6,
    'JUL': 7, 'JULY': 7, 'HUL': 7, 'HULYO': 7,
    'AUG': 8, 'AUGUST': 8, 'AGO': 8, 'AGOSTO': 8,
    'SEP': 9, 'SEPT': 9, 'SEPTEMBER': 9, 'SET': 9, 'SETYEMBRE': 9,
    'OCT': 10, 'OCTOBER': 10, 'OKT': 10, 'OKTUBRE': 10,
    'NOV': 11, 'NOVEMBER': 11, 'NOB': 11, 'NOBYEMBRE': 11,
    'DEC': 12, 'DECEMBER': 12, 'DIS': 12, 'DISYEMBRE': 12
};

function parseDateComponents(dateStr) {
    if (!dateStr) return null;
    const clean = String(dateStr).trim();

    const isoMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
    if (isoMatch) {
        return {
            year: parseInt(isoMatch[1], 10),
            month: parseInt(isoMatch[2], 10),
            day: parseInt(isoMatch[3], 10)
        };
    }

    const slashMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
    if (slashMatch) {
        const p1 = parseInt(slashMatch[1], 10);
        const p2 = parseInt(slashMatch[2], 10);
        const y = parseInt(slashMatch[3], 10);
        if (p1 > 12 && p2 <= 12) {
            return { year: y, month: p2, day: p1 };
        }
        return { year: y, month: p1, day: p2 };
    }

    const textMonthMatch = clean.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/) ||
                           clean.match(/(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})/);
    if (textMonthMatch) {
        let mStr = textMonthMatch[1].toUpperCase();
        let dStr = textMonthMatch[2];
        let yStr = textMonthMatch[3];
        if (MONTH_NAMES[dStr.toUpperCase()]) {
            mStr = dStr.toUpperCase();
            dStr = textMonthMatch[1];
        }
        const m = MONTH_NAMES[mStr];
        if (m) {
            return {
                year: parseInt(yStr, 10),
                month: m,
                day: parseInt(dStr, 10)
            };
        }
    }

    return null;
}

function verifyBirthdateMatch(rawText, expectedBirthdate) {
    const exp = parseDateComponents(expectedBirthdate);
    if (!exp) {
        return {
            matches: true,
            detectedBirthdate: null,
            message: 'No registered birthdate on file to compare.'
        };
    }

    const text = (rawText || '').trim();
    if (!text) {
        return {
            matches: false,
            detectedBirthdate: null,
            message: "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible."
        };
    }

    const dobRegexes = [
        /(?:DOB|D\.O\.B|Birth\s*Date|Date\s*of\s*Birth|Birthday|Kapanganakan)\s*[:\.\-]?\s*([A-Za-z0-9\s,\/\-\.]+)/gi,
        /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})\b/g,
        /\b(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})\b/g,
        /\b([a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4})\b/g,
        /\b(\d{1,2}\s+[a-zA-Z]{3,9},?\s+\d{4})\b/g
    ];

    const candidateStrings = [];
    for (const r of dobRegexes) {
        let m;
        while ((m = r.exec(text)) !== null) {
            candidateStrings.push(m[1] || m[0]);
        }
    }

    let detectedDate = null;
    let matches = false;

    for (const cand of candidateStrings) {
        const parsed = parseDateComponents(cand);
        if (parsed) {
            const formatted = `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}/${parsed.year}`;
            if (!detectedDate) detectedDate = formatted;
            if (parsed.year === exp.year) {
                if ((parsed.month === exp.month && parsed.day === exp.day) ||
                    (parsed.month === exp.day && parsed.day === exp.month)) {
                    matches = true;
                    detectedDate = formatted;
                    break;
                }
            }
        }
    }

    if (!matches) {
        const hasYear = text.includes(String(exp.year));
        const hasDay = new RegExp(`\\b${exp.day}\\b`).test(text);
        if (hasYear && hasDay) {
            matches = true;
            detectedDate = `${String(exp.month).padStart(2, '0')}/${String(exp.day).padStart(2, '0')}/${exp.year}`;
        }
    }

    let message = '';
    if (matches) {
        message = `Birthdate verified! Matches registered information (${detectedDate}).`;
    } else if (detectedDate) {
        message = 'The birthdate on your school ID does not match your registered information. Please check your ID and try again.';
    } else {
        message = 'Could not detect a matching birthdate on the back of your ID.';
    }

    return {
        matches: detectedDate ? matches : true,
        detectedBirthdate: detectedDate,
        message
    };
}

function verifyAtmProof(rawText, expectedName, expectedSaNumber) {
    const text = (rawText || '').trim();
    if (!text) {
        return {
            isValid: false,
            nameMatches: false,
            saMatches: false,
            detectedName: '',
            detectedSaNumber: '',
            message: "We couldn't read the document clearly. Please retake the scan with better lighting and ensure all details are visible."
        };
    }

    const cleanExpectedSa = (expectedSaNumber || '').replace(/\D/g, '');

    const digitSequences = [];
    const allNumberMatches = text.match(/\b\d{9,18}\b/g) || [];
    for (const n of allNumberMatches) digitSequences.push(n);

    const spacedMatch = text.match(/\b\d{3,6}[\s\-]\d{3,6}[\s\-]\d{2,6}\b/g) || [];
    for (const s of spacedMatch) digitSequences.push(s.replace(/\D/g, ''));

    const saRegex = /(?:SA\s*(?:No\.?|Number)?|Account\s*(?:No\.?|Number)?|Acct\s*(?:No\.?)?)?\s*[:\.\-]?\s*(\b\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,6}\b)/gi;
    let m;
    while ((m = saRegex.exec(text)) !== null) {
        digitSequences.push(m[1].replace(/\D/g, ''));
    }

    let detectedSa = '';
    let saMatches = false;

    const strippedAllText = text.replace(/\D/g, '');
    if (cleanExpectedSa && strippedAllText.includes(cleanExpectedSa)) {
        saMatches = true;
        detectedSa = cleanExpectedSa;
    } else {
        for (const cand of digitSequences) {
            const cleanCand = cand.replace(/\D/g, '');
            if (cleanCand.length >= 9) {
                if (!detectedSa) detectedSa = cleanCand;
                if (cleanExpectedSa && (cleanCand === cleanExpectedSa || cleanCand.includes(cleanExpectedSa) || cleanExpectedSa.includes(cleanCand))) {
                    saMatches = true;
                    detectedSa = cleanCand;
                    break;
                }
            }
        }
    }

    const nameResult = verifyNameMatch(text, expectedName);
    const nameMatches = nameResult.matches;
    const detectedName = nameResult.detectedName;

    const isValid = saMatches && nameMatches;

    let message = '';
    if (isValid) {
        message = 'ATM Proof verified! Account holder name and SA number match registered records.';
    } else if (!saMatches && !nameMatches) {
        message = "The account holder's name or SA number does not match your registered information. Please upload the correct ATM Proof.";
    } else if (!saMatches) {
        message = `The SA number on your ATM proof does not match your entered SA number. Please upload the correct ATM Proof.`;
    } else {
        message = "The account holder's name does not match your registered information. Please upload the correct ATM Proof.";
    }

    return {
        isValid,
        saMatches,
        nameMatches,
        detectedSaNumber: detectedSa || cleanExpectedSa,
        detectedName,
        message
    };
}

function normalizeYear(raw) {
    if (!raw) return '';
    let clean = String(raw).trim()
        .replace(/\b2[oO]([0-9]{2})/gi, '20$1')
        .replace(/[oO](?=\d)/g, '0')
        .replace(/(?<=\d)[oO]/g, '0');

    // Replace all Unicode dashes, slashes, "to", dots, and underscores between numbers with hyphen
    clean = clean.replace(
        /[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D/\\~_\.]|(?<=\d)\s*(?:to|until)\s*(?=\d)/g,
        '-'
    );

    // Remove unintended spaces inside digit pairs (e.g. "20 26" -> "2026")
    clean = clean.replace(/\b(20)\s+(\d{2})\b/g, '$1$2');

    const match = clean.match(/(20\d{2})\s*-\s*(20\d{2}|\d{2})/);
    if (match) {
        const start = match[1];
        let end = match[2];
        if (end.length === 2) {
            end = `${start.slice(0, 2)}${end}`;
        }
        return `${start}-${end}`;
    }

    const singleMatch = clean.match(/\b(20\d{2})\b/);
    if (singleMatch) {
        const y = parseInt(singleMatch[1], 10);
        return `${y}-${y + 1}`;
    }

    return clean.trim();
}

function normalizeSemester(raw) {
    if (!raw) return '';
    const lower = String(raw).toLowerCase().trim()
        .replace(/[\u00B0\u00BA˚]/g, '*')
        .replace(/\s+/g, ' ');

    // 2nd Semester check (handles 2nd, second, 2*, 2°*, 2 nd, 2-nd, 2rd, sem 2, sem2)
    const is2nd = /\b(?:2\s*nd|2\s*rd|second|2[\*+\#\~\^•]+|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b/i.test(lower) ||
        /\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:2|ii)\b/i.test(lower) ||
        /\b(?:2|ii)\s*[\/\-]\s*sem\b/i.test(lower) ||
        /\b2nd\s+semester\b/i.test(lower) ||
        /\bsecond\s+semester\b/i.test(lower) ||
        lower.includes('2* semester') || lower.includes('2* sem');
    if (is2nd) return '2nd Semester';

    // 1st Semester check (handles 1st, first, 1*, 1°*, 1 st, 1-st, ist, 1sl, 1si, sem 1, sem1)
    const is1st = /\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+\#\~\^•]+|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b/i.test(lower) ||
        /\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:1|i)\b/i.test(lower) ||
        /\b(?:1|i)\s*[\/\-]\s*sem\b/i.test(lower) ||
        /\b1st\s+semester\b/i.test(lower) ||
        /\bfirst\s+semester\b/i.test(lower) ||
        /\b[il]st\s+sem(?:ester)?\b/i.test(lower) ||
        lower.includes('1* semester') || lower.includes('1* sem');
    if (is1st) return '1st Semester';

    if (/\b(?:summer|mid\s*[\-]?year)\b/i.test(lower)) {
        return 'Summer / Midyear';
    }

    if (lower === '1st sem' || lower === '1st semester' || lower === 'first sem' || lower === 'first semester' || lower === '1st') {
        return '1st Semester';
    }
    if (lower === '2nd sem' || lower === '2nd semester' || lower === 'second sem' || lower === 'second semester' || lower === '2nd') {
        return '2nd Semester';
    }

    return raw.trim();
}

function isYearMatching(a, b) {
    const normA = normalizeYear(a);
    const normB = normalizeYear(b);
    if (!normA || !normB) return false;
    return normA === normB;
}

function isSemesterMatching(a, b) {
    const normA = normalizeSemester(a);
    const normB = normalizeSemester(b);
    if (!normA || !normB) return false;
    return normA === normB;
}

function parseStickerText(rawText, currentYear = activeAcademicYear, currentSem = activeSemester) {
    const text = (rawText || '').trim();
    if (!text) {
        return {
            stickerFound: false,
            isValid: false,
            academicYear: null,
            semester: null,
            hasValidationStamp: false,
            message: 'No readable text detected on sticker region.'
        };
    }

    let cleaned = text
        .replace(/\b2[oO]([0-9]{2})/gi, '20$1')
        .replace(/[oO](?=\d)/g, '0')
        .replace(/(?<=\d)[oO]/g, '0')
        .replace(/[\u002D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D/\\~_\.]|(?<=\d)\s*(?:to|until)\s*(?=\d)/g, '-');
    cleaned = cleaned.replace(/\b(20)\s+(\d{2})\b/g, '$1$2');

    // 1. Extract Academic Year with priority scoring
    let detectedYear = null;

    // Priority 1: Lines containing sticker keywords (sem, registrar, valid, ustp)
    const lines = cleaned.split(/[\r\n]+/);
    for (const line of lines) {
        if (/(?:sem|registrar|valid|ustp|campus)/i.test(line)) {
            const lineAyMatch = line.match(/(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)?(202[0-9]|203[0-5])\s*[-–—/\\~_\.\s]+\s*(202[0-9]|203[0-5]|\d{2})\b/i);
            if (lineAyMatch) {
                const start = parseInt(lineAyMatch[1], 10);
                const endStr = lineAyMatch[2];
                const end = endStr.length === 2 ? parseInt(lineAyMatch[1].slice(0, 2) + endStr, 10) : parseInt(endStr, 10);
                if (end === start + 1 || (end >= 2020 && end <= 2035 && end > start)) {
                    detectedYear = `${start}-${end}`;
                    break;
                }
            }
        }
    }

    // Priority 2: Explicit prefix A.Y. / S.Y. / Academic Year
    if (!detectedYear) {
        const explicitAyRegex = /(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)(20\d{2})\s*[-–—/\\~_\.\s]+\s*(20\d{2}|\d{2})\b/gi;
        let match;
        while ((match = explicitAyRegex.exec(cleaned)) !== null) {
            const start = parseInt(match[1], 10);
            let endStr = match[2];
            let end = endStr.length === 2 ? parseInt(match[1].slice(0, 2) + endStr, 10) : parseInt(endStr, 10);
            if (end === start + 1 || (end >= 2020 && end <= 2035 && end > start)) {
                detectedYear = `${start}-${end}`;
                break;
            }
        }
    }

    // Priority 3: Consecutive year range (e.g. 2026-2027) where end == start + 1
    if (!detectedYear) {
        const rangeRegex = /\b(202[0-9]|203[0-5])\s*[-–—/\\~_\.]\s*(202[0-9]|203[0-5]|\d{2})\b/g;
        let match;
        while ((match = rangeRegex.exec(cleaned)) !== null) {
            const start = parseInt(match[1], 10);
            let endStr = match[2];
            let end = endStr.length === 2 ? parseInt(match[1].slice(0, 2) + endStr, 10) : parseInt(endStr, 10);
            if (end === start + 1) {
                detectedYear = `${start}-${end}`;
                break;
            }
        }
    }

    // Priority 4: Explicit single year with prefix
    if (!detectedYear) {
        const singleAyRegex = /(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year|AY|SY)\s*[:\.\-]?\s*)(202[0-9]|203[0-5])\b/i;
        const singleMatch = cleaned.match(singleAyRegex);
        if (singleMatch) {
            const y = parseInt(singleMatch[1], 10);
            detectedYear = `${y}-${y + 1}`;
        }
    }

    // 2. Extract Semester
    let detectedSem = null;

    function checkSem(s) {
        const lower = s.toLowerCase().replace(/[\u00B0\u00BA˚]/g, '*').replace(/\s+/g, ' ');
        const hasSemesterWord = /\bsem(?:est(?:er|el|r|ev|or)?)?\b/i.test(lower);

        const is2nd = /\b(?:2\s*nd|2\s*rd|second|2[\*+\#\~\^•]+|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b/i.test(lower) ||
            /\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:2|ii)\b/i.test(lower) ||
            /\b(?:2|ii)\s*[\/\-]\s*sem\b/i.test(lower) ||
            /\b2nd\s+semester\b/i.test(lower) ||
            /\bsecond\s+semester\b/i.test(lower) ||
            (hasSemesterWord && (lower.includes('2*') || lower.includes('2°') || lower.includes('2º')));
        if (is2nd) return '2nd Semester';

        const is1st = /\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+\#\~\^•]+|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev|or)?)?\b/i.test(lower) ||
            /\bsem(?:est(?:er|el|r|ev|or)?)?\s*[\.\-:\/]?\s*(?:1|i)\b/i.test(lower) ||
            /\b(?:1|i)\s*[\/\-]\s*sem\b/i.test(lower) ||
            /\b1st\s+semester\b/i.test(lower) ||
            /\bfirst\s+semester\b/i.test(lower) ||
            /\b[il]st\s+sem(?:ester)?\b/i.test(lower) ||
            (hasSemesterWord && (lower.includes('1*') || lower.includes('1°') || lower.includes('1º')));
        if (is1st) return '1st Semester';

        if (/\b(?:summer|mid\s*[\-]?year)\b/i.test(lower)) {
            return 'Summer / Midyear';
        }
        return null;
    }

    for (const line of lines) {
        detectedSem = checkSem(line);
        if (detectedSem) break;
    }
    if (!detectedSem) {
        detectedSem = checkSem(cleaned);
    }

    const hasValidationStamp = /\b(?:VALIDATED|VALID|VALIDO|VALIDATION|ENROLLED)\b/i.test(text) ||
        /\b(?:Campus\s+)?Registrar\b/i.test(text) ||
        /\b(?:USTP|UST\s*P|U\.S\.T\.P\.)\b/i.test(text);

    const normDetectedYear = detectedYear ? normalizeYear(detectedYear) : null;
    const normDetectedSem = detectedSem ? normalizeSemester(detectedSem) : null;
    const targetNormYear = normalizeYear(currentYear);
    const targetNormSem = normalizeSemester(currentSem);

    const yearMatches = !!(normDetectedYear && isYearMatching(normDetectedYear, targetNormYear));
    const semMatches = !!(normDetectedSem && isSemesterMatching(normDetectedSem, targetNormSem));
    const isValid = yearMatches && semMatches;

    let message = '';
    if (!normDetectedYear && !normDetectedSem) {
        message = 'Could not detect an academic year or semester validation sticker on ID.';
    } else if (isValid) {
        message = `Validation sticker verified! Matched active school period (AY ${targetNormYear} • ${targetNormSem}).`;
    } else if (!normDetectedYear) {
        message = `Academic Year unreadable on validation sticker (Detected: None, Required: ${targetNormYear}).`;
    } else if (!normDetectedSem) {
        message = `Semester unreadable on validation sticker (Detected: None, Required: ${targetNormSem}).`;
    } else if (!yearMatches && !semMatches) {
        message = `The validation sticker does not match the active school period (Detected: AY ${normDetectedYear} • ${normDetectedSem}, Required: AY ${targetNormYear} • ${targetNormSem}).`;
    } else if (!yearMatches) {
        const isExpired = normDetectedYear && normDetectedYear < targetNormYear;
        message = isExpired
            ? `The validation sticker on your ID is expired (${normDetectedYear}). The active school period requires AY ${targetNormYear} • ${targetNormSem}.`
            : `Academic Year mismatch (Detected: ${normDetectedYear}, Required: ${targetNormYear}).`;
    } else {
        message = `Semester mismatch (Detected: ${normDetectedSem}, Required: ${targetNormSem}).`;
    }

    return {
        stickerFound: !!(normDetectedYear || normDetectedSem || hasValidationStamp),
        isValid,
        yearMatches,
        semesterMatches: semMatches,
        academicYear: normDetectedYear,
        semester: normDetectedSem,
        hasValidationStamp,
        currentYear: targetNormYear,
        currentSem: targetNormSem,
        message,
        rawText
    };
}

// ── Google OAuth2 Access Token for FCM HTTP v1 ───────────────────────────
async function getGoogleAccessToken() {
    // 1. Check for serviceAccountKey.json
    const serviceAccountPath = path.join(ROOT, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        try {
            const { GoogleAuth } = require('google-auth-library');
            const auth = new GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
            });
            const client = await auth.getClient();
            const tokenResponse = await client.getAccessToken();
            if (tokenResponse && tokenResponse.token) {
                return tokenResponse.token;
            }
        } catch (e) {
            console.warn('[Push Notification] serviceAccountKey.json auth error:', e.message);
        }
    }

    // 2. Check local Firebase CLI authenticated session
    try {
        const os = require('os');
        const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const tokens = config.tokens;
            if (tokens) {
                if (tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 60000) {
                    return tokens.access_token;
                }
                if (tokens.refresh_token) {
                    const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
                    const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';
                    const body = new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: tokens.refresh_token,
                        grant_type: 'refresh_token'
                    });
                    const res = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: body.toString()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        tokens.access_token = data.access_token;
                        tokens.expires_at = Date.now() + (data.expires_in * 1000);
                        try {
                            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
                        } catch (_) {}
                        return data.access_token;
                    }
                }
                return tokens.access_token;
            }
        }
    } catch (e) {
        console.warn('[Push Notification] Local Firebase CLI token error:', e.message);
    }

    return null;
}

// ── Push Notification & In-App Notification Broadcast Engine ─────────────
const SUPABASE_REST_URL = 'https://ywavesulvkqwpsejprxp.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3YXZlc3Vsdmtxd3BzZWpwcnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTQ5NjcsImV4cCI6MjA5NjgzMDk2N30.2PdPn3Z88Hn0q_1AUlSFjv94wxKSvZaPa_fi2umKHbk';

// ── Semaphore SMS Messaging Engine (https://semaphore.co) ───────────────
const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4';

/**
 * Dynamically resolves Semaphore API Key from process.env or re-reads .env if newly configured.
 */
function getSemaphoreApiKey() {
    if (process.env.SEMAPHORE_API_KEY && process.env.SEMAPHORE_API_KEY.trim()) {
        return process.env.SEMAPHORE_API_KEY.trim();
    }
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
            for (const line of envLines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const k = trimmed.substring(0, eqIdx).trim();
                    let v = trimmed.substring(eqIdx + 1).trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.slice(1, -1);
                    }
                    process.env[k] = v;
                }
            }
        }
    } catch (_) {}
    return (process.env.SEMAPHORE_API_KEY || '').trim();
}

/**
 * Dynamically resolves Semaphore Sender Name.
 */
function getSemaphoreSenderName() {
    return (process.env.SEMAPHORE_SENDER_NAME || 'ScholarDoc').trim();
}

/**
 * Normalizes any Philippine mobile phone number string into standard format.
 * Acceptable inputs:
 *  - 09171234567
 *  - +639171234567
 *  - 639171234567
 *  - 9171234567
 *  - Formatted with dashes/spaces: 0917-123-4567, (0917) 123 4567
 * Returns standard 11-digit '09XXXXXXXXX' string, or null if invalid.
 */
function normalizePhilippineMobile(rawPhone) {
    if (!rawPhone) return null;
    let digits = String(rawPhone).replace(/\D/g, '');
    if (digits.startsWith('63')) {
        digits = digits.substring(2);
    }
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    if (/^9\d{9}$/.test(digits)) {
        return '0' + digits;
    }
    return null;
}

/**
 * Checks if a string is a valid UUID v4 format.
 */
function isUuidString(str) {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
}

/**
 * Builds a type-safe PostgREST query filter for student lookup, avoiding Postgres UUID syntax errors.
 */
function buildStudentQueryFilter(targetId) {
    if (!targetId) return null;
    const cleanId = String(targetId).trim();
    if (isUuidString(cleanId)) {
        return `or=(id.eq.${encodeURIComponent(cleanId)},uid.eq.${encodeURIComponent(cleanId)})`;
    } else {
        return `or=(student_no.eq.${encodeURIComponent(cleanId)},studentId.eq.${encodeURIComponent(cleanId)})`;
    }
}

/**
 * Validates whether a student identifier exists in the Supabase student_grantees table.
 * Students not in student_grantees are strictly denied access.
 */
async function validateGranteeEligibility(identifier) {
    if (!identifier) {
        return {
            success: false,
            isEligible: false,
            message: 'Student identifier is required.'
        };
    }

    const cleanId = String(identifier).trim();
    const cleanNo = cleanId.replace(/[- ]/g, '');
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };

    const filterTerms = [
        `student_no.eq.${encodeURIComponent(cleanId)}`,
        `studentId.eq.${encodeURIComponent(cleanId)}`
    ];

    if (cleanNo && cleanNo !== cleanId) {
        filterTerms.push(`student_no.eq.${encodeURIComponent(cleanNo)}`);
        filterTerms.push(`studentId.eq.${encodeURIComponent(cleanNo)}`);
    }

    if (cleanId.includes('@')) {
        filterTerms.push(`email_address.eq.${encodeURIComponent(cleanId)}`);
        filterTerms.push(`email.eq.${encodeURIComponent(cleanId)}`);
    }

    if (isUuidString(cleanId)) {
        filterTerms.push(`id.eq.${encodeURIComponent(cleanId)}`);
        filterTerms.push(`uid.eq.${encodeURIComponent(cleanId)}`);
    }

    try {
        const url = `${SUPABASE_REST_URL}/student_grantees?or=(${filterTerms.join(',')})&limit=1`;
        const res = await fetch(url, { headers });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                const grantee = rows[0];
                return {
                    success: true,
                    isEligible: true,
                    grantee: {
                        id: grantee.id,
                        uid: grantee.uid,
                        student_no: grantee.student_no || grantee.studentId,
                        full_name: grantee.full_name || grantee.fullName,
                        course: grantee.course || grantee.program_name
                    },
                    message: 'Student is registered as an eligible grantee.'
                };
            }
        }
    } catch (e) {
        console.error('[validateGranteeEligibility error]', e.message);
    }

    return {
        success: false,
        isEligible: false,
        message: `Access denied. Student ID "${cleanId}" is not registered as an eligible grantee in the scholarship database.`
    };
}

/**
 * Queries Semaphore account balance and details (without exposing API key to client).
 */
async function getSemaphoreAccountInfo() {
    const apiKey = getSemaphoreApiKey();
    if (!apiKey) {
        return {
            configured: false,
            status: 'unconfigured',
            message: 'Semaphore API key is not configured in .env'
        };
    }
    try {
        const res = await fetch(`${SEMAPHORE_API_URL}/account?apikey=${encodeURIComponent(apiKey)}`);
        if (!res.ok) {
            const errText = await res.text();
            return {
                configured: true,
                status: 'error',
                message: `Semaphore API error (${res.status}): ${errText}`
            };
        }
        const data = await res.json();
        return {
            configured: true,
            status: 'active',
            account_id: data.account_id,
            account_name: data.account_name,
            credit_balance: data.credit_balance,
            sender_name: getSemaphoreSenderName() || 'Default'
        };
    } catch (err) {
        return {
            configured: true,
            status: 'network_error',
            message: err.message
        };
    }
}

/**
 * Inserts SMS delivery log and updates student_grantees SMS state in Supabase.
 */
async function recordSmsLog({ studentId, granteeUid, recipientPhone, message, eventType = 'general', status = 'sent', messageId = null, network = null, errorMessage = null }) {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };

    const now = new Date().toISOString();

    // 1. Audit log row
    try {
        await fetch(`${SUPABASE_REST_URL}/sms_logs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                student_id: studentId || null,
                grantee_uid: granteeUid || null,
                recipient_phone: recipientPhone,
                message: message,
                event_type: eventType,
                status: status,
                semaphore_message_id: messageId ? String(messageId) : null,
                network: network || null,
                error_message: errorMessage || null,
                sent_at: now
            })
        });
    } catch (_) {}

    // 2. Update student_grantees row
    let matchQuery = '';
    if (granteeUid && isUuidString(granteeUid)) matchQuery = `uid=eq.${encodeURIComponent(granteeUid)}`;
    else if (studentId) matchQuery = buildStudentQueryFilter(studentId);

    if (matchQuery) {
        try {
            await fetch(`${SUPABASE_REST_URL}/student_grantees?${matchQuery}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    sms_sent_at: (status === 'sent' || status === 'queued') ? now : null,
                    sms_status: status,
                    sms_sent_to: recipientPhone,
                    sms_error: errorMessage || null,
                    sms_message_id: messageId ? String(messageId) : null
                })
            });
        } catch (_) {}
    }
}

/**
 * Sends SMS via Semaphore v4 API
 */
async function sendSemaphoreSms({ numbers, message, sendername = null }) {
    const apiKey = getSemaphoreApiKey();
    if (!apiKey) {
        console.warn('[Semaphore SMS] Cannot send SMS: SEMAPHORE_API_KEY is not configured in .env');
        return {
            success: false,
            error: 'Semaphore API key is not configured. Please add SEMAPHORE_API_KEY to your .env file on the server.',
            unconfigured: true
        };
    }

    const rawList = Array.isArray(numbers) ? numbers : String(numbers || '').split(',');
    const validNumbers = [...new Set(rawList.map(n => normalizePhilippineMobile(n)).filter(Boolean))];

    if (validNumbers.length === 0) {
        return {
            success: false,
            error: 'No valid Philippine mobile number provided (must be 11 digits starting with 09).'
        };
    }

    const safeMessage = String(message || '').trim();
    if (!safeMessage) {
        return {
            success: false,
            error: 'SMS message content cannot be empty.'
        };
    }

    const effectiveSender = (sendername || getSemaphoreSenderName() || '').trim().slice(0, 11);

    const payload = {
        apikey: apiKey,
        number: validNumbers.join(','),
        message: safeMessage
    };
    if (effectiveSender) {
        payload.sendername = effectiveSender;
    }

    try {
        console.log(`[Semaphore SMS] Sending to ${validNumbers.length} recipient(s): ${validNumbers.join(', ')}`);
        let res = await fetch(`${SEMAPHORE_API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data = await res.json().catch(() => ({}));

        // If custom sendername failed (e.g. sendername not yet approved), auto-retry without sendername
        if (!res.ok && payload.sendername) {
            console.warn(`[Semaphore SMS] Dispatch failed with sendername "${payload.sendername}", retrying with default sender...`);
            delete payload.sendername;
            const retryRes = await fetch(`${SEMAPHORE_API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (retryRes.ok) {
                res = retryRes;
                data = await retryRes.json().catch(() => ({}));
            }
        }

        if (!res.ok) {
            const errMsg = Array.isArray(data)
                ? data.map(d => d.message || JSON.stringify(d)).join(', ')
                : (data.error || data.message || `HTTP ${res.status}`);
            console.error('[Semaphore SMS] Delivery error response:', errMsg);
            return {
                success: false,
                status: 'failed',
                error: errMsg,
                details: data
            };
        }

        console.log('[Semaphore SMS] Sent successfully:', data);
        const first = Array.isArray(data) ? data[0] : data;
        return {
            success: true,
            status: first?.status || 'sent',
            message_id: first?.message_id ? String(first.message_id) : null,
            recipient: first?.recipient || validNumbers.join(','),
            network: first?.network || null,
            count: validNumbers.length,
            details: data
        };
    } catch (err) {
        console.error('[Semaphore SMS] Network error:', err.message);
        return {
            success: false,
            status: 'failed',
            error: err.message
        };
    }
}

/**
 * Sends official scholarship grantee notification SMS to a confirmed student.
 */
async function sendSingleGranteeSms(grantee, { force = false } = {}) {
    const targetPhone = grantee.mobile_number || grantee.contactNumber || grantee.phone_number;
    const normalizedPhone = normalizePhilippineMobile(targetPhone);
    const targetId = grantee.uid || grantee.id || grantee.student_no || grantee.studentId;

    if (!normalizedPhone) {
        return {
            success: false,
            student_id: targetId,
            error: `Invalid or missing Philippine mobile number: "${targetPhone || ''}"`
        };
    }

    if (!force && grantee.sms_sent_at) {
        return {
            success: true,
            skipped: true,
            student_id: targetId,
            phone: normalizedPhone,
            reason: `SMS already sent at ${grantee.sms_sent_at}`
        };
    }

    const fullName = grantee.full_name || grantee.fullName || 'Student Grantee';
    const scholarshipName = grantee.scholarship_name || grantee.scholarshipName || 'CHED TES';

    const smsMessage = `[ScholarDoc] Application Approved: Congratulations ${fullName}! Your scholarship application has been officially approved.`;

    const smsResult = await sendSemaphoreSms({
        numbers: normalizedPhone,
        message: smsMessage
    });

    await recordSmsLog({
        studentId: grantee.student_no || grantee.studentId || targetId,
        granteeUid: grantee.uid || grantee.id,
        recipientPhone: normalizedPhone,
        message: smsMessage,
        eventType: 'grantee_confirmed',
        status: smsResult.success ? 'sent' : 'failed',
        messageId: smsResult.message_id,
        network: smsResult.network,
        errorMessage: smsResult.error
    });

    return {
        ...smsResult,
        student_id: targetId,
        phone: normalizedPhone
    };
}

/**
 * Dispatches an event-driven SMS notification to a student (with deduplication & audit).
 */
async function sendStudentSmsNotification({
    studentId,
    uid,
    studentNo,
    phone,
    eventType = 'custom',
    customMessage,
    title,
    feedback = '',
    force = false
}) {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };

    const targetId = studentId || uid || studentNo;
    let granteeRecord = null;

    if (targetId) {
        try {
            const filter = buildStudentQueryFilter(targetId);
            if (filter) {
                const fetchRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?${filter}&limit=1`, { headers });
                if (fetchRes.ok) {
                    const list = await fetchRes.json();
                    if (Array.isArray(list) && list.length > 0) {
                        granteeRecord = list[0];
                    }
                }
            }
        } catch (_) {}
    }

    if (!granteeRecord && targetId) {
        try {
            const filter = buildStudentQueryFilter(targetId);
            if (filter) {
                const fetchSchool = await fetch(`${SUPABASE_REST_URL}/school_students?${filter}&limit=1`, { headers });
                if (fetchSchool.ok) {
                    const listSchool = await fetchSchool.json();
                    if (Array.isArray(listSchool) && listSchool.length > 0) {
                        granteeRecord = listSchool[0];
                    }
                }
            }
        } catch (_) {}
    }

    // Fallback if not found in DB but phone or message details were provided
    if (!granteeRecord && (phone || customMessage)) {
        granteeRecord = {
            student_no: studentNo || studentId || targetId,
            uid: uid || targetId,
            full_name: 'Student',
            mobile_number: phone,
            contactNumber: phone,
            scholarship_name: 'Scholarship'
        };
    }

    const rawPhone = phone || granteeRecord?.mobile_number || granteeRecord?.contactNumber || granteeRecord?.phone_number;
    const normalizedPhone = normalizePhilippineMobile(rawPhone);

    if (!normalizedPhone) {
        return {
            success: false,
            student_id: targetId,
            error: `No valid Philippine mobile number registered for this student (${rawPhone || 'empty'}).`
        };
    }

    // Deduplication check
    if (!force && eventType === 'grantee_confirmed' && granteeRecord?.sms_sent_at) {
        return {
            success: true,
            skipped: true,
            student_id: targetId,
            phone: normalizedPhone,
            reason: `Grantee SMS was already sent at ${granteeRecord.sms_sent_at}`
        };
    }

    const studentName = granteeRecord?.full_name || granteeRecord?.fullName || 'Student';
    const scholarshipName = granteeRecord?.scholarship_name || granteeRecord?.scholarshipName || 'Scholarship';

    let message = (customMessage || '').trim();
    if (title && message) {
        if (!message.toLowerCase().includes(title.toLowerCase())) {
            message = `${title}: ${message}`;
        }
    }
    if (message && !message.startsWith('[ScholarDoc]')) {
        message = `[ScholarDoc] ${message}`;
    }

    if (!message) {
        switch (eventType) {
            case 'grantee_confirmed':
            case 'application_approved':
                message = `[ScholarDoc] Application Approved: Congratulations! Your scholarship application has been officially approved.`;
                break;
            case 'application_rejected':
                message = `[ScholarDoc] Application Rejected: We regret to inform you that your scholarship application has been rejected.${feedback ? ' Feedback: ' + feedback : ''}`;
                break;
            case 'sa_revision':
            case 'sa_verified':
                if (eventType === 'sa_verified') {
                    message = `[ScholarDoc] SA Number Verified: Great news! Your SA Number has been verified and approved.`;
                } else {
                    message = `[ScholarDoc] SA Number Rejected: Your SA Number submission requires correction.${feedback ? ' Feedback: ' + feedback : ''} Please update it in the ScholarDoc app.`;
                }
                break;
            case 'id_revision':
            case 'id_verified':
                if (eventType === 'id_verified') {
                    message = `[ScholarDoc] ID Validation Approved: Great news! Your School ID document has been verified and approved.`;
                } else {
                    message = `[ScholarDoc] ID Validation Rejected: Your School ID document requires correction.${feedback ? ' Feedback: ' + feedback : ''} Please review feedback in the ScholarDoc app.`;
                }
                break;
            case 'deadline_alert':
                message = `[ScholarDoc] Deadline Alert: Important scholarship deadline reminder for ${studentName}.${feedback ? ' ' + feedback : ''} Please check the ScholarDoc app immediately.`;
                break;
            default:
                message = `[ScholarDoc] Scholarship Notice: Important scholarship update for ${studentName}.${feedback ? ' ' + feedback : ''} Open the ScholarDoc app to review.`;
        }
    }

    const sendRes = await sendSemaphoreSms({
        numbers: normalizedPhone,
        message
    });

    await recordSmsLog({
        studentId: granteeRecord?.student_no || granteeRecord?.studentId || targetId,
        granteeUid: granteeRecord?.uid || granteeRecord?.id || targetId,
        recipientPhone: normalizedPhone,
        message,
        eventType,
        status: sendRes.success ? 'sent' : 'failed',
        messageId: sendRes.message_id,
        network: sendRes.network,
        errorMessage: sendRes.error
    });

    return {
        ...sendRes,
        student_id: targetId,
        phone: normalizedPhone,
        event_type: eventType
    };
}

async function broadcastAnnouncementNotification({ announcementId, title, content, type, forceResend, sendSms = true }) {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    // 1. Deduplication check: check if already sent
    if (announcementId && !forceResend) {
        try {
            const checkRes = await fetch(`${SUPABASE_REST_URL}/announcements?id=eq.${announcementId}&select=id,title,push_sent`, { headers });
            const checkData = await checkRes.json();
            if (checkData && checkData.length > 0 && checkData[0].push_sent) {
                console.log(`[Push Notification] Duplicate prevented for announcement ${announcementId}`);
                return {
                    success: true,
                    duplicatePrevented: true,
                    message: 'Push notification was already sent for this announcement.'
                };
            }
        } catch (checkErr) {
            console.warn('[Push Notification] Warning checking duplicate:', checkErr.message);
        }
    }

    // Clean preview message (up to 140 chars)
    const cleanPreview = (content || '')
        .replace(/\[Deadline:\s*[^\]]+\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    const shortMessage = cleanPreview.length > 140 ? cleanPreview.slice(0, 137) + '...' : cleanPreview;

    let notificationHistoryCount = 0;

    // 2. In-App Notification History: Fan-out notification records to all registered students
    try {
        const rpcRes = await fetch(`${SUPABASE_REST_URL}/rpc/broadcast_announcement_to_notifications`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                p_announcement_id: String(announcementId || ''),
                p_title: title || 'New Announcement',
                p_content: content || '',
                p_type: type || 'General'
            })
        });

        if (rpcRes.ok) {
            notificationHistoryCount = await rpcRes.json();
            console.log(`[Push Notification] Fanned out ${notificationHistoryCount} student notifications via RPC.`);
        } else {
            // Direct query fallback: query student grantees and batch insert
            const studentsRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?select=uid&uid=not.is.null`, { headers });
            const students = await studentsRes.json();

            if (Array.isArray(students) && students.length > 0) {
                const uniqueUids = [...new Set(students.map(s => s.uid).filter(Boolean))];
                const notifBatch = uniqueUids.map(uid => ({
                    studentId: uid,
                    title: title || 'New Announcement',
                    message: shortMessage || 'A new announcement has been posted.',
                    type: type === 'Deadline' ? 'warning' : 'info',
                    isRead: false,
                    timestamp: new Date().toISOString(),
                    announcementId: String(announcementId || '')
                }));

                const batchRes = await fetch(`${SUPABASE_REST_URL}/notifications`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(notifBatch)
                });
                if (batchRes.ok) {
                    notificationHistoryCount = uniqueUids.length;
                    console.log(`[Push Notification] Fanned out ${uniqueUids.length} in-app notification rows.`);
                }
            }
        }
    } catch (histErr) {
        console.error('[Push Notification] Error inserting in-app notification history:', histErr);
    }

    // 3. Mark announcement as push_sent in database
    if (announcementId) {
        try {
            await fetch(`${SUPABASE_REST_URL}/announcements?id=eq.${announcementId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    push_sent: true,
                    push_sent_at: new Date().toISOString()
                })
            });
        } catch (_) {}
    }

    // 4. Retrieve FCM tokens from user_fcm_tokens
    let tokens = [];
    try {
        const tokensRes = await fetch(`${SUPABASE_REST_URL}/user_fcm_tokens?select=fcm_token`, { headers });
        if (tokensRes.ok) {
            const tokenRows = await tokensRes.json();
            if (Array.isArray(tokenRows)) {
                tokens = [...new Set(tokenRows.map(r => r.fcm_token).filter(Boolean))];
            }
        }
    } catch (tokErr) {
        console.warn('[Push Notification] user_fcm_tokens query note:', tokErr.message);
    }

    // 5. Send FCM Push Notification directly to student mobile devices (HTTP v1)
    let pushSentCount = 0;
    const accessToken = await getGoogleAccessToken();

    if (!accessToken) {
        console.warn('[Push Notification] No Google OAuth2 access token available for FCM v1. Please configure serviceAccountKey.json or ensure Firebase CLI is logged in.');
    } else {
        const fcmAndroid = {
            priority: 'high',
            notification: {
                channel_id: 'scholardoc_announcements',
                icon: 'ic_notification',
                color: '#0F3260',
                sound: 'default',
                default_sound: true,
                default_vibrate_timings: true,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        const notificationData = {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            announcementId: String(announcementId || ''),
            title: title || '',
            message: shortMessage || '',
            content: content || '',
            type: type || 'General'
        };

        // A) Send to every registered student device token
        for (const token of tokens) {
            try {
                const fcmRes = await fetch('https://fcm.googleapis.com/v1/projects/scholardoc-40e03/messages:send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        message: {
                            token,
                            notification: {
                                title: title || 'ScholarDoc Announcement',
                                body: shortMessage || 'A new scholarship update has been posted.'
                            },
                            data: notificationData,
                            android: fcmAndroid
                        }
                    })
                });

                if (fcmRes.ok) {
                    pushSentCount++;
                    const resJson = await fcmRes.json().catch(() => ({}));
                    console.log(`[Push Notification] Delivered to device (${token.slice(0, 15)}...):`, resJson.name);
                } else {
                    const errJson = await fcmRes.json().catch(() => ({}));
                    console.warn(`[Push Notification] Device ${token.slice(0, 15)}... delivery error:`, errJson.error?.message || fcmRes.status);
                    // If unregistered/expired token, automatically clean it from database
                    if (errJson.error?.details?.[0]?.errorCode === 'UNREGISTERED' || errJson.error?.status === 'NOT_FOUND') {
                        await fetch(`${SUPABASE_REST_URL}/user_fcm_tokens?fcm_token=eq.${token}`, { method: 'DELETE', headers });
                        console.log(`[Push Notification] Cleaned up unregistered token ${token.slice(0, 15)}...`);
                    }
                }
            } catch (devErr) {
                console.warn('[Push Notification] Error sending to device token:', devErr.message);
            }
        }

        // B) Also broadcast to topic 'all_students'
        try {
            const topicRes = await fetch('https://fcm.googleapis.com/v1/projects/scholardoc-40e03/messages:send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    message: {
                        topic: 'all_students',
                        notification: {
                            title: title || 'ScholarDoc Announcement',
                            body: shortMessage || 'A new scholarship update has been posted.'
                        },
                        data: notificationData,
                        android: fcmAndroid
                    }
                })
            });
            if (topicRes.ok) {
                console.log('[Push Notification] Topic broadcast delivered to "all_students" successfully.');
            } else {
                console.warn('[Push Notification] Topic broadcast note:', await topicRes.text());
            }
        } catch (topErr) {
            console.warn('[Push Notification] Topic broadcast error:', topErr.message);
        }
    }

    // 6. Broadcast SMS via Semaphore matching notification content
    let smsSentCount = 0;
    let smsFailedCount = 0;
    if (sendSms !== false) {
        try {
            console.log('[Announcement] SMS broadcast requested, querying student mobile numbers...');
            const stuRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?select=student_no,uid,full_name,mobile_number,contactNumber`, { headers });
            if (stuRes.ok) {
                const stuList = await stuRes.json();
                if (Array.isArray(stuList) && stuList.length > 0) {
                    const phoneMap = new Map();
                    for (const s of stuList) {
                        const p = normalizePhilippineMobile(s.mobile_number || s.contactNumber);
                        if (p && !phoneMap.has(p)) {
                            phoneMap.set(p, s);
                        }
                    }
                    const uniquePhones = Array.from(phoneMap.keys());
                    if (uniquePhones.length > 0) {
                        const notifTitle = (title || 'ScholarDoc Announcement').trim();
                        const notifBody = (shortMessage || cleanPreview || 'A new scholarship update has been posted.').trim();
                        // Send identical content as the in-app notification & push notification
                        const annSmsText = `[ScholarDoc] ${notifTitle}: ${notifBody}`;

                        // Send in chunks of 50 recipients
                        for (let i = 0; i < uniquePhones.length; i += 50) {
                            const chunk = uniquePhones.slice(i, i + 50);
                            const smsRes = await sendSemaphoreSms({
                                numbers: chunk,
                                message: annSmsText
                            });
                            if (smsRes.success) {
                                smsSentCount += chunk.length;
                                for (const ph of chunk) {
                                    const st = phoneMap.get(ph);
                                    await recordSmsLog({
                                        studentId: st?.student_no,
                                        granteeUid: st?.uid,
                                        recipientPhone: ph,
                                        message: annSmsText,
                                        eventType: 'announcement',
                                        status: 'sent',
                                        messageId: smsRes.message_id
                                    });
                                }
                            } else {
                                smsFailedCount += chunk.length;
                                for (const ph of chunk) {
                                    const st = phoneMap.get(ph);
                                    await recordSmsLog({
                                        studentId: st?.student_no,
                                        granteeUid: st?.uid,
                                        recipientPhone: ph,
                                        message: annSmsText,
                                        eventType: 'announcement',
                                        status: 'failed',
                                        errorMessage: smsRes.error
                                    });
                                }
                            }
                            if (i + 50 < uniquePhones.length) {
                                await new Promise(r => setTimeout(r, 200));
                            }
                        }
                        console.log(`[Announcement] SMS broadcast complete. Sent: ${smsSentCount}, Failed: ${smsFailedCount}`);
                    }
                }
            }
        } catch (smsErr) {
            console.error('[Announcement] SMS broadcast exception:', smsErr.message);
        }
    }

    console.log(`[Push Notification] Broadcast complete. Push devices reached: ${pushSentCount}/${tokens.length}. SMS sent: ${smsSentCount}. In-app history created for ${notificationHistoryCount} student(s).`);

    return {
        success: true,
        tokensCount: tokens.length,
        notificationHistoryCount,
        pushSentCount,
        smsSentCount,
        smsFailedCount,
        message: `Notification broadcasted to ${tokens.length} device(s)${smsSentCount > 0 ? ` and texted to ${smsSentCount} mobile numbers` : ''} and recorded in student notification histories.`
    };
}

// ── Gmail SMTP Grantee Email Notification Engine ────────────────────────
let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    console.warn('[Gmail SMTP] nodemailer not installed, email sending disabled.');
}

const GMAIL_USER = process.env.GMAIL_USER || 'judeesidorejariol@gmail.com';
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || 'eoueeoikuorzymkq').replace(/\s+/g, '');
const APP_DOWNLOAD_URL = process.env.APP_DOWNLOAD_URL || 'https://scholardoc.app/download';

function getGmailTransporter() {
    if (!nodemailer) return null;
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD
        },
        tls: { rejectUnauthorized: false }
    });
}

function generateGranteeEmailHtml(grantee) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scholarship Grantee Notification - ScholarDoc</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; background-color: #f1f5f9; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0F3260 0%, #172554 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
    .badge { display: inline-block; margin-top: 14px; padding: 6px 16px; background-color: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 36px 32px; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .lead-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .card-info { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; }
    .card-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .cta-box { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 28px; }
    .cta-box h3 { margin: 0 0 8px 0; color: #166534; font-size: 17px; font-weight: 700; }
    .cta-box p { margin: 0 0 18px 0; color: #15803d; font-size: 13.5px; line-height: 1.5; }
    .btn-download { display: inline-block; background: linear-gradient(135deg, #0F3260 0%, #1e40af 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(15, 50, 96, 0.25); letter-spacing: 0.3px; }
    .instructions { background-color: #f8fafc; border-left: 4px solid #0F3260; padding: 14px 18px; margin-bottom: 28px; border-radius: 0 8px 8px 0; }
    .instructions h4 { margin: 0 0 8px 0; font-size: 13.5px; color: #0F3260; font-weight: 700; }
    .instructions ol { margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div style="margin-bottom: 16px;">
          <img src="https://ywavesulvkqwpsejprxp.supabase.co/storage/v1/object/public/public-assets/app_logo3.png" 
               alt="ScholarDoc Logo" 
               width="80" 
               height="80" 
               style="width: 80px; height: 80px; border-radius: 50%; background: #ffffff; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: contain;" />
        </div>
        <h1>ScholarDoc</h1>
        <p>Scholarship Management & Verification System</p>
        <div class="badge">Official Grantee Notice</div>
      </div>
      <div class="content">
        <div class="greeting">Dear ${grantee.fullName},</div>
        <p class="lead-text">
          Congratulations! We are pleased to formally inform you that you have been identified and confirmed as an official <strong>scholarship grantee</strong> of the institution for <strong>${grantee.scholarshipName}</strong>.
        </p>
        <div class="card-info">
          <div class="card-title">Your Grantee Details</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Student ID:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.studentId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Program / Course:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.course}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Scholarship Program:</td>
              <td style="padding: 6px 0; color: #047857; font-size: 13px; font-weight: 700; text-align: right;">${grantee.scholarshipName}</td>
            </tr>
            ${grantee.saNumber && grantee.saNumber !== 'N/A' ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">SA Number:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.saNumber}</td>
            </tr>` : ''}
            ${grantee.academicTerm ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Academic Term:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${grantee.academicTerm}</td>
            </tr>` : ''}
          </table>
        </div>
        <div class="cta-box">
          <h3>Get Started with ScholarDoc Mobile</h3>
          <p>Submit your scholarship documents (Certificate of Registration, School ID, and SA form) and track your stipend disbursement seamlessly on your mobile device.</p>
          <a href="${grantee.downloadUrl}" class="btn-download" target="_blank">Download ScholarDoc Application</a>
          <div style="margin-top: 14px; font-size: 11.5px; color: #64748b;">
            Direct link: <a href="${grantee.downloadUrl}" style="color: #0F3260; word-break: break-all;">${grantee.downloadUrl}</a>
          </div>
        </div>
        <div class="instructions">
          <h4>Next Steps for Confirmed Grantees:</h4>
          <ol>
            <li>Download and install the <strong>ScholarDoc</strong> app using the button above.</li>
            <li>Log in using your registered student ID number and email address.</li>
            <li>Complete your student profile and upload the required verification requirements.</li>
            <li>Monitor real-time approval status and stipend updates from your Scholarship Coordinator.</li>
          </ol>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
          If you have any questions or require assistance with your account, please reach out to the University Scholarship & Financial Assistance Office.
        </p>
      </div>
      <div class="footer">
        <p><strong>ScholarDoc System</strong> • University Scholarship and Financial Assistance Unit</p>
        <p>This is an automated notification sent from <em>${GMAIL_USER}</em>. Please do not reply directly to this email.</p>
        <p>&copy; ${new Date().getFullYear()} ScholarDoc. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendSingleGranteeEmail(grantee, { force = false } = {}) {
    const targetEmail = grantee.email_address || grantee.email;
    const targetId = grantee.uid || grantee.id || grantee.student_no || grantee.studentId;

    if (!targetEmail || !targetEmail.includes('@')) {
        return { success: false, student_id: targetId, error: `Invalid recipient email: "${targetEmail || ''}"` };
    }

    if (!force && grantee.email_sent_at) {
        return { success: true, skipped: true, student_id: targetId, email: targetEmail, reason: 'Already sent' };
    }

    const transporter = getGmailTransporter();
    if (!transporter) {
        return { success: false, student_id: targetId, error: 'Gmail transporter not configured' };
    }

    const fullName = grantee.full_name || grantee.fullName || 'Student Grantee';
    const studentNumber = grantee.student_no || grantee.studentId || 'N/A';
    const course = grantee.program_name || grantee.course || 'General Course';
    const scholarshipName = grantee.scholarship_name || grantee.scholarshipName || 'CHED TES';
    const saNumber = grantee.sa_number || grantee.saNumber || 'N/A';
    const academicTerm = [grantee.academic_year || grantee.academicYear, grantee.semester].filter(Boolean).join(' - ') || 'Current Academic Year';

    const html = generateGranteeEmailHtml({
        fullName,
        studentId: studentNumber,
        course,
        scholarshipName,
        academicTerm,
        saNumber,
        downloadUrl: APP_DOWNLOAD_URL
    });

    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    try {
        console.log(`[Gmail SMTP] Sending email to ${targetEmail} for ${fullName}...`);
        const info = await transporter.sendMail({
            from: `"ScholarDoc Scholarship Office" <${GMAIL_USER}>`,
            to: targetEmail,
            subject: `[ScholarDoc] Official Notice: You are confirmed as a ${scholarshipName} Grantee - ${fullName}`,
            text: `Dear ${fullName},\n\nCongratulations! You have been confirmed as an official scholarship grantee for ${scholarshipName}.\n\nStudent ID: ${studentNumber}\nCourse: ${course}\n\nPlease download the ScholarDoc mobile app to upload your documents and track your scholarship:\n${APP_DOWNLOAD_URL}\n\nScholarDoc Scholarship Office`,
            html
        });
        console.log(`[Gmail SMTP] Email successfully sent to ${targetEmail}! Message ID: ${info.messageId}`);

        const now = new Date().toISOString();

        // Update student_grantees in Supabase
        let matchQuery = '';
        if (grantee.uid) matchQuery = `uid=eq.${encodeURIComponent(grantee.uid)}`;
        else if (grantee.id) matchQuery = `id=eq.${encodeURIComponent(grantee.id)}`;
        else if (grantee.student_no) matchQuery = `student_no=eq.${encodeURIComponent(grantee.student_no)}`;

        if (matchQuery) {
            await fetch(`${SUPABASE_REST_URL}/student_grantees?${matchQuery}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    email_sent_at: now,
                    email_status: 'sent',
                    email_sent_to: targetEmail,
                    email_error: null
                })
            });
        }

        // Insert audit log
        try {
            await fetch(`${SUPABASE_REST_URL}/grantee_email_logs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    student_id: studentNumber,
                    grantee_uid: grantee.uid || grantee.id,
                    recipient_email: targetEmail,
                    scholarship_name: scholarshipName,
                    status: 'sent',
                    sent_at: now
                })
            });
        } catch (_) {}

        return { success: true, student_id: targetId, email: targetEmail };
    } catch (err) {
        console.error(`[Gmail SMTP] Send failed to ${targetEmail}:`, err.message);

        let matchQuery = '';
        if (grantee.uid) matchQuery = `uid=eq.${encodeURIComponent(grantee.uid)}`;
        else if (grantee.student_no) matchQuery = `student_no=eq.${encodeURIComponent(grantee.student_no)}`;

        if (matchQuery) {
            try {
                await fetch(`${SUPABASE_REST_URL}/student_grantees?${matchQuery}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        email_status: 'failed',
                        email_error: err.message
                    })
                });
            } catch (_) {}
        }

        return { success: false, student_id: targetId, email: targetEmail, error: err.message };
    }
}

const server = http.createServer(async (req, res) => {
    // Enable CORS for all incoming requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL and strip query string / hash
    let urlPath = req.url.split('?')[0].split('#')[0];

    // Normalize path
    try {
        urlPath = decodeURIComponent(urlPath);
    } catch (_) {}

    // ── API: Validate Grantee Eligibility for Student Login ───────────────
    if (urlPath === '/api/auth/validate-grantee' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const rawIdentifier = parsed.identifier || parsed.studentId || parsed.student_no || parsed.email || parsed.uid || '';
                const cleanId = String(rawIdentifier).trim();

                if (!cleanId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        isEligible: false,
                        message: 'Student identifier is required.'
                    }));
                    return;
                }

                const result = await validateGranteeEligibility(cleanId);
                const statusCode = result.isEligible ? 200 : 403;
                res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('[API validate-grantee error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, isEligible: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Get Current Academic Period ─────────────────────────────────
    if (urlPath === '/api/academic-term/current' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            academicYear: activeAcademicYear,
            semester: activeSemester,
            displayString: `AY ${activeAcademicYear} • ${activeSemester}`
        }));
        return;
    }

    // ── API: Push Notification Broadcast for Announcements ───────────────
    if (urlPath === '/api/notifications/broadcast-announcement' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const result = await broadcastAnnouncementNotification(parsed);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('[API broadcast-announcement error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Delete Announcement and Purge Associated Notifications ───────
    if (urlPath === '/api/announcements/delete' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { id } = JSON.parse(body || '{}');
                if (!id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Missing announcement id' }));
                    return;
                }
                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                };
                // 1. Delete announcement
                await fetch(`${SUPABASE_REST_URL}/announcements?id=eq.${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers
                });
                // 2. Permanently delete all associated notifications
                await fetch(`${SUPABASE_REST_URL}/notifications?announcementId=eq.${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    headers
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Announcement and notifications permanently deleted' }));
            } catch (err) {
                console.error('[API announcement delete error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Google Document AI Sticker Scanner (Legacy & Superadmin) ───
    if (urlPath === '/api/document-ai/scan-sticker' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const base64Image = parsed.image;
                const expectedBirthdate = parsed.expectedBirthdate || parsed.birthdate;

                if (!base64Image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                    return;
                }

                const cacheKey = getSha256(`sticker:${expectedBirthdate || ''}:${base64Image}`);
                const cachedRes = getFromCache(documentAiEndpointCache, cacheKey);
                if (cachedRes) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ...cachedRes, cached: true }));
                    return;
                }

                const { text, engine } = await callVisionApi(base64Image);
                const parsedSticker = parseStickerText(text) || {};
                const birthdateRes = verifyBirthdateMatch(text, expectedBirthdate) || {};

                const responseData = {
                    success: true,
                    ...parsedSticker,
                    birthdate: birthdateRes.detectedBirthdate,
                    birthdateMatches: birthdateRes.matches === true,
                    engine
                };
                setInCache(documentAiEndpointCache, cacheKey, responseData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseData));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // ── API: Front ID Name Verification ──────────────────────────────────
    if (urlPath === '/api/document-ai/scan-front-id' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const base64Image = parsed.image;
                const expectedName = parsed.expectedName || parsed.fullName || parsed.name || '';

                if (!base64Image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                    return;
                }

                const cacheKey = getSha256(`front:${expectedName.trim().toUpperCase()}:${base64Image}`);
                const cachedRes = getFromCache(documentAiEndpointCache, cacheKey);
                if (cachedRes) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ...cachedRes, cached: true }));
                    return;
                }

                const { text, engine } = await callVisionApi(base64Image);
                const nameRes = verifyNameMatch(text, expectedName);

                const responseData = {
                    success: true,
                    nameMatches: nameRes.matches,
                    detectedName: nameRes.detectedName,
                    confidence: nameRes.confidence,
                    engine,
                    rawText: text,
                    message: nameRes.message
                };
                setInCache(documentAiEndpointCache, cacheKey, responseData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseData));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // ── API: Back ID Term & Birthdate Verification ───────────────────────
    if (urlPath === '/api/document-ai/scan-back-id' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const base64Image = parsed.image;
                const expectedBirthdate = parsed.expectedBirthdate || parsed.birthdate;
                const targetYear = parsed.academicYear || parsed.currentYear || activeAcademicYear;
                const targetSem = parsed.semester || parsed.currentSem || activeSemester;
                const normTargetYear = normalizeYear(targetYear);
                const normTargetSem = normalizeSemester(targetSem);

                if (!base64Image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                    return;
                }

                const cacheKey = getSha256(`back:${expectedBirthdate || ''}:${normTargetYear}:${normTargetSem}:${base64Image}`);
                const cachedRes = getFromCache(documentAiEndpointCache, cacheKey);
                if (cachedRes) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ...cachedRes, cached: true }));
                    return;
                }

                const { text, engine } = await callVisionApi(base64Image);
                const sticker = parseStickerText(text, targetYear, targetSem) || {};
                const birthdateRes = verifyBirthdateMatch(text, expectedBirthdate) || {};

                // Only treat as mismatch if birthdate was actually detected on ID and conflicts
                const hasDetectedBdate = !!birthdateRes.detectedBirthdate;
                const birthdateValid = hasDetectedBdate ? (birthdateRes.matches === true) : true;
                const isValid = (sticker.isValid === true) && birthdateValid;

                let message = '';
                if (!sticker.stickerFound) {
                    message = "Could not clearly detect an academic year or semester validation sticker on ID. Please ensure the sticker is well-lit and retake the scan.";
                } else if (isValid) {
                    message = `Validation sticker verified! Matched active school period (AY ${sticker.academicYear} • ${sticker.semester}${birthdateRes.detectedBirthdate ? ` • DOB: ${birthdateRes.detectedBirthdate}` : ''}).`;
                } else if (hasDetectedBdate && !birthdateRes.matches) {
                    message = `The birthdate on your school ID (${birthdateRes.detectedBirthdate}) does not match your registered information. Please check your ID and try again.`;
                } else if (!sticker.isValid) {
                    message = sticker.message;
                } else {
                    message = "The academic year or semester on your ID sticker is not current. Please scan the correct ID.";
                }

                console.log(`[Document AI Scan] Back ID: AY=${sticker.academicYear}, Sem=${sticker.semester} | Req: AY=${normTargetYear}, Sem=${normTargetSem} | Valid=${isValid} | Reason=${message}`);

                const responseData = {
                    success: true,
                    stickerFound: !!sticker.stickerFound,
                    academicYear: sticker.academicYear,
                    semester: sticker.semester,
                    hasValidationStamp: !!sticker.hasValidationStamp,
                    yearMatches: !!sticker.yearMatches,
                    semesterMatches: !!sticker.semesterMatches,
                    birthdate: birthdateRes.detectedBirthdate,
                    birthdateMatches: birthdateValid,
                    isValid,
                    engine,
                    rawText: text,
                    message
                };
                setInCache(documentAiEndpointCache, cacheKey, responseData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseData));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // ── API: ATM Proof Account Holder & SA Number Verification ────────────
    if (urlPath === '/api/document-ai/scan-atm-proof' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const base64Image = parsed.image;
                const expectedName = parsed.expectedName || parsed.fullName || parsed.name || '';
                const expectedSa = parsed.expectedSaNumber || parsed.saNumber || parsed.sa_number || '';

                if (!base64Image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                    return;
                }

                const cacheKey = getSha256(`atm:${expectedName.trim().toUpperCase()}:${expectedSa.trim()}:${base64Image}`);
                const cachedRes = getFromCache(documentAiEndpointCache, cacheKey);
                if (cachedRes) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ...cachedRes, cached: true }));
                    return;
                }

                const { text, engine } = await callVisionApi(base64Image);
                const atmRes = verifyAtmProof(text, expectedName, expectedSa) || {};

                const responseData = {
                    success: true,
                    isValid: !!atmRes.isValid,
                    saMatches: !!atmRes.saMatches,
                    nameMatches: !!atmRes.nameMatches,
                    detectedSaNumber: atmRes.detectedSaNumber,
                    detectedName: atmRes.detectedName,
                    engine,
                    rawText: text,
                    message: atmRes.message
                };
                setInCache(documentAiEndpointCache, cacheKey, responseData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseData));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // ── API: Update Active Academic Period ────────────────────────────────
    if (urlPath === '/api/academic-term/update' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { academicYear, semester } = JSON.parse(body || '{}');
                if (academicYear) activeAcademicYear = String(academicYear).trim();
                if (semester) activeSemester = String(semester).trim();

                // Persist to Supabase system_settings
                try {
                    const headers = {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    };
                    await fetch(`${SUPABASE_REST_URL}/system_settings`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            key: 'academic_term',
                            value: {
                                academic_year: activeAcademicYear,
                                semester: activeSemester,
                                updated_at: new Date().toISOString()
                            }
                        })
                    });
                } catch (_) {}

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    academicYear: activeAcademicYear,
                    semester: activeSemester,
                    displayString: `AY ${activeAcademicYear} • ${activeSemester}`
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // ── API: Send Grantee Notification via Gmail SMTP & Semaphore SMS ────
    if (urlPath === '/api/send-grantee-notification' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body || '{}');
                const {
                    mode = 'single',
                    student_id,
                    uid,
                    student_no,
                    limit = 100,
                    force = false,
                    channel = 'both' // 'both' | 'email' | 'sms'
                } = payload;

                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                };

                if (mode === 'batch') {
                    // Fetch pending grantees
                    let url = `${SUPABASE_REST_URL}/student_grantees?select=*&limit=${limit}`;
                    if (!force) {
                        if (channel === 'sms') {
                            url += '&sms_sent_at=is.null';
                        } else {
                            url += '&email_sent_at=is.null';
                        }
                    }
                    const fetchRes = await fetch(url, { headers });
                    const candidates = await fetchRes.json();

                    if (!Array.isArray(candidates) || candidates.length === 0) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: 'All eligible grantees have already received notifications.',
                            total: 0, sent: 0, skipped: 0, failed: 0,
                            emailSent: 0, smsSent: 0
                        }));
                        return;
                    }

                    let sent = 0, skipped = 0, failed = 0;
                    let emailSent = 0, smsSent = 0;
                    const details = [];

                    for (const grantee of candidates) {
                        let emailRes = null;
                        let smsRes = null;

                        if (channel === 'both' || channel === 'email') {
                            emailRes = await sendSingleGranteeEmail(grantee, { force });
                            if (emailRes.success && !emailRes.skipped) emailSent++;
                        }

                        if (channel === 'both' || channel === 'sms') {
                            smsRes = await sendSingleGranteeSms(grantee, { force });
                            if (smsRes.success && !smsRes.skipped) smsSent++;
                        }

                        const overallSuccess = (emailRes ? emailRes.success : true) && (smsRes ? smsRes.success : true);
                        const isSkipped = (emailRes ? emailRes.skipped : false) && (smsRes ? smsRes.skipped : false);

                        if (overallSuccess && !isSkipped) sent++;
                        else if (isSkipped) skipped++;
                        else failed++;

                        details.push({
                            student_id: grantee.uid || grantee.id || grantee.student_no,
                            email: emailRes,
                            sms: smsRes
                        });

                        // Delay 200ms between sends to avoid spam filtering / rate limits
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: `Processed ${candidates.length} grantees. Total: ${sent}, Emails sent: ${emailSent}, SMS sent: ${smsSent}, Skipped: ${skipped}, Failed: ${failed}`,
                        total: candidates.length,
                        sent, emailSent, smsSent, skipped, failed,
                        details
                    }));
                    return;
                }

                // Single student notification
                const targetId = student_id || uid || student_no;
                let granteeRecord = null;

                if (targetId) {
                    const filter = buildStudentQueryFilter(targetId);
                    if (filter) {
                        const fetchRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?${filter}&limit=1`, { headers });
                        if (fetchRes.ok) {
                            const list = await fetchRes.json();
                            if (Array.isArray(list) && list.length > 0) {
                                granteeRecord = list[0];
                            }
                        }
                    }
                }

                // If not found by ID, try finding by email
                if (!granteeRecord && payload.email) {
                    const fetchEmail = await fetch(`${SUPABASE_REST_URL}/student_grantees?or=(email.eq.${encodeURIComponent(payload.email)},email_address.eq.${encodeURIComponent(payload.email)})&limit=1`, { headers });
                    const listEmail = await fetchEmail.json();
                    if (Array.isArray(listEmail) && listEmail.length > 0) {
                        granteeRecord = listEmail[0];
                    }
                }

                // If still not in database but details were passed, construct record
                if (!granteeRecord && (payload.email || payload.phone || payload.mobile_number)) {
                    granteeRecord = {
                        id: targetId,
                        uid: targetId,
                        student_no: payload.student_no || payload.studentNo || 'N/A',
                        full_name: payload.full_name || payload.fullName || 'Student Grantee',
                        email_address: payload.email,
                        mobile_number: payload.phone || payload.mobile_number || payload.contactNumber,
                        contactNumber: payload.phone || payload.mobile_number || payload.contactNumber,
                        course: payload.course || payload.program_name || 'General Course',
                        scholarship_name: payload.scholarship_name || payload.scholarshipName || 'CHED TES',
                        sa_number: payload.sa_number || payload.saNumber || 'N/A'
                    };
                }

                if (!granteeRecord) {
                    console.warn(`[API send-grantee-notification] Grantee record not found for: ${targetId || payload.email}`);
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: `Student grantee record not found for: ${targetId || payload.email || 'unknown ID'}` }));
                    return;
                }

                const shouldForce = force !== false;
                let emailResult = null;
                let smsResult = null;

                if (channel === 'both' || channel === 'email') {
                    console.log(`[API send-grantee-notification] Triggering email send to: ${granteeRecord.email_address || granteeRecord.email} (force=${shouldForce})`);
                    emailResult = await sendSingleGranteeEmail(granteeRecord, { force: shouldForce });
                }

                if (channel === 'both' || channel === 'sms') {
                    console.log(`[API send-grantee-notification] Triggering SMS send to: ${granteeRecord.mobile_number || granteeRecord.contactNumber} (force=${shouldForce})`);
                    smsResult = await sendSingleGranteeSms(granteeRecord, { force: shouldForce });
                }

                const overallSuccess = (emailResult ? emailResult.success : true) && (smsResult ? smsResult.success : true);

                res.writeHead(overallSuccess ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: overallSuccess,
                    student_id: targetId,
                    email: emailResult,
                    sms: smsResult,
                    message: `Notification dispatched: ${emailResult?.success ? 'Email sent. ' : ''}${smsResult?.success ? 'SMS sent.' : ''}`.trim()
                }));
                return;
            } catch (err) {
                console.error('[API send-grantee-notification error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Check Semaphore SMS Account Status & Balance ─────────────────
    if (urlPath === '/api/sms/account' && req.method === 'GET') {
        try {
            const info = await getSemaphoreAccountInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ configured: false, error: err.message }));
        }
        return;
    }

    // ── API: Send Single Student Event / Custom SMS ──────────────────────
    if (urlPath === '/api/sms/send' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body || '{}');
                const studentId = payload.student_id || payload.studentId || payload.uid || payload.student_no || payload.studentNo;
                const phone = payload.phone || payload.mobile_number || payload.contactNumber || payload.number;
                const eventType = payload.event_type || payload.eventType || 'custom';
                const title = payload.title || payload.notificationTitle || '';
                const message = payload.message || payload.customMessage || payload.custom_message || '';
                const feedback = payload.feedback || '';
                const force = Boolean(payload.force);

                const result = await sendStudentSmsNotification({
                    studentId: studentId,
                    uid: payload.uid || studentId,
                    studentNo: payload.student_no || payload.studentNo || studentId,
                    phone,
                    eventType,
                    title,
                    customMessage: message,
                    feedback,
                    force
                });

                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('[API sms/send error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Batch SMS Dispatch to Student List ──────────────────────────
    if (urlPath === '/api/sms/batch' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body || '{}');
                const { student_ids, event_type = 'grantee_confirmed', message, force = false, limit = 50 } = payload;
                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                };

                let studentsToNotify = [];
                if (Array.isArray(student_ids) && student_ids.length > 0) {
                    const idsFilter = student_ids.map(id => `student_no.eq.${encodeURIComponent(id)},uid.eq.${encodeURIComponent(id)}`).join(',');
                    const fetchRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?or=(${idsFilter})`, { headers });
                    if (fetchRes.ok) studentsToNotify = await fetchRes.json();
                } else {
                    let url = `${SUPABASE_REST_URL}/student_grantees?select=*&limit=${limit}`;
                    if (!force) url += '&sms_sent_at=is.null';
                    const fetchRes = await fetch(url, { headers });
                    if (fetchRes.ok) studentsToNotify = await fetchRes.json();
                }

                if (!Array.isArray(studentsToNotify) || studentsToNotify.length === 0) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        total: 0, sent: 0, skipped: 0, failed: 0,
                        message: 'No eligible students found for SMS dispatch.'
                    }));
                    return;
                }

                let sent = 0, skipped = 0, failed = 0;
                const results = [];

                for (const student of studentsToNotify) {
                    const r = await sendStudentSmsNotification({
                        studentId: student.student_no,
                        uid: student.uid,
                        phone: student.mobile_number || student.contactNumber,
                        eventType: event_type,
                        customMessage: message,
                        force
                    });
                    results.push(r);
                    if (r.success && !r.skipped) sent++;
                    else if (r.skipped) skipped++;
                    else failed++;

                    await new Promise(res => setTimeout(res, 200));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    total: studentsToNotify.length,
                    sent, skipped, failed,
                    details: results
                }));
            } catch (err) {
                console.error('[API sms/batch error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Broadcast SMS to All Registered Students ─────────────────────
    if (urlPath === '/api/sms/broadcast' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body || '{}');
                const { title, message } = payload;
                if (!message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Message content is required.' }));
                    return;
                }

                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                };

                const stuRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?select=student_no,uid,mobile_number,contactNumber`, { headers });
                if (!stuRes.ok) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Could not fetch student records.' }));
                    return;
                }

                const students = await stuRes.json();
                const phoneMap = new Map();
                for (const s of (students || [])) {
                    const p = normalizePhilippineMobile(s.mobile_number || s.contactNumber);
                    if (p && !phoneMap.has(p)) phoneMap.set(p, s);
                }

                const uniquePhones = Array.from(phoneMap.keys());
                if (uniquePhones.length === 0) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, count: 0, message: 'No registered student mobile numbers found.' }));
                    return;
                }

                const cleanT = (title || 'ScholarDoc Alert').trim().slice(0, 35);
                const smsText = `[ScholarDoc] ${cleanT}: ${message.trim().slice(0, 110)}`;

                let sentCount = 0;
                let failCount = 0;

                for (let i = 0; i < uniquePhones.length; i += 50) {
                    const chunk = uniquePhones.slice(i, i + 50);
                    const smsRes = await sendSemaphoreSms({
                        numbers: chunk,
                        message: smsText
                    });

                    if (smsRes.success) {
                        sentCount += chunk.length;
                        for (const ph of chunk) {
                            const st = phoneMap.get(ph);
                            await recordSmsLog({
                                studentId: st?.student_no,
                                granteeUid: st?.uid,
                                recipientPhone: ph,
                                message: smsText,
                                eventType: 'broadcast',
                                status: 'sent',
                                messageId: smsRes.message_id
                            });
                        }
                    } else {
                        failCount += chunk.length;
                        for (const ph of chunk) {
                            const st = phoneMap.get(ph);
                            await recordSmsLog({
                                studentId: st?.student_no,
                                granteeUid: st?.uid,
                                recipientPhone: ph,
                                message: smsText,
                                eventType: 'broadcast',
                                status: 'failed',
                                errorMessage: smsRes.error
                            });
                        }
                    }
                    if (i + 50 < uniquePhones.length) await new Promise(r => setTimeout(r, 200));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    totalNumbers: uniquePhones.length,
                    sentCount,
                    failCount,
                    message: `SMS broadcast completed. Delivered: ${sentCount}, Failed: ${failCount}`
                }));
            } catch (err) {
                console.error('[API sms/broadcast error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // ── API: Retrieve Recent SMS Logs ────────────────────────────────────
    if (urlPath === '/api/sms/logs' && req.method === 'GET') {
        try {
            const headers = {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            };
            const logsRes = await fetch(`${SUPABASE_REST_URL}/sms_logs?select=*&order=sent_at.desc&limit=50`, { headers });
            if (logsRes.ok) {
                const logs = await logsRes.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, logs: logs || [] }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, logs: [] }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    const resolvedFile = findFilePath(urlPath);

    if (!resolvedFile) {
        console.error(`404 Not Found: ${urlPath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
    }

    // Security check: ensure path is inside ROOT
    const normalizedTarget = path.normalize(resolvedFile);
    if (!normalizedTarget.startsWith(path.normalize(ROOT))) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
    }

    const ext = path.extname(normalizedTarget).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(normalizedTarget, (err, data) => {
        if (err) {
            console.error(`500 Error reading file: ${normalizedTarget}`);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 Internal Server Error');
            return;
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
        });
        res.end(data);
    });
});

// ── Automatic Notification-to-SMS Watcher Daemon ─────────────────────────
// Automatically mirrors all in-app notifications created in Supabase to SMS via Semaphore
// with identical content, ensuring any notification triggered anywhere in ScholarDoc
// immediately sends an SMS to the student's mobile number.

const processedNotificationIds = new Set();
const NOTIF_PROCESSED_FILE = path.join(__dirname, 'scratch', 'processed_sms_notification_ids.json');

function loadProcessedNotificationIds() {
    try {
        if (fs.existsSync(NOTIF_PROCESSED_FILE)) {
            const data = JSON.parse(fs.readFileSync(NOTIF_PROCESSED_FILE, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(id => processedNotificationIds.add(String(id)));
            }
        }
    } catch (_) {}
}

function saveProcessedNotificationIds() {
    try {
        const dir = path.dirname(NOTIF_PROCESSED_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        // Keep latest 2000 IDs to prevent file unbounded growth
        const arr = Array.from(processedNotificationIds).slice(-2000);
        fs.writeFileSync(NOTIF_PROCESSED_FILE, JSON.stringify(arr), 'utf8');
    } catch (_) {}
}

let isWatcherPolling = false;

async function lookupStudentForNotification(studentId, notif = null) {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };

    // If notification target is admin or superadmin, check if a specific student is mentioned in message
    if (studentId === 'admin' || studentId === 'superadmin') {
        if (notif && notif.message) {
            const nameMatch = notif.message.match(/^(?:Student\s+)?([A-Za-z\s.]+?)(?:\s+has\s+|\s+updated\s+|\s+submitted)/i);
            if (nameMatch && nameMatch[1]) {
                const studentName = nameMatch[1].trim();
                try {
                    const res = await fetch(`${SUPABASE_REST_URL}/student_grantees?or=(full_name.ilike.*${encodeURIComponent(studentName)}*,fullName.ilike.*${encodeURIComponent(studentName)}*)&limit=1`, { headers });
                    if (res.ok) {
                        const rows = await res.json();
                        if (Array.isArray(rows) && rows.length > 0) {
                            const s = rows[0];
                            const rawPhone = s.mobile_number || s.contactNumber || s.phone_number || s.documents?.contactNumber || s.familyDetails?.contactNumber;
                            if (rawPhone) {
                                return {
                                    student_no: s.student_no || s.studentId,
                                    uid: s.uid || s.id,
                                    full_name: s.full_name || s.fullName,
                                    rawPhone
                                };
                            }
                        }
                    }
                } catch (_) {}
            }
        }
        // Fallback: Notify administrator/superadmin mobile number
        const adminPhone = process.env.ADMIN_PHONE_NUMBER || '09653793139';
        return {
            student_no: studentId,
            uid: studentId,
            full_name: 'Administrator',
            rawPhone: adminPhone
        };
    }

    if (!studentId) return null;
    const cleanId = String(studentId).trim();

    // 1. Check student_grantees
    try {
        let filter;
        if (isUuidString(cleanId)) {
            filter = `or=(id.eq.${encodeURIComponent(cleanId)},uid.eq.${encodeURIComponent(cleanId)})`;
        } else if (cleanId.includes('@')) {
            filter = `or=(email.eq.${encodeURIComponent(cleanId)},email_address.eq.${encodeURIComponent(cleanId)})`;
        } else {
            filter = `or=(student_no.eq.${encodeURIComponent(cleanId)},studentId.eq.${encodeURIComponent(cleanId)})`;
        }

        const res = await fetch(`${SUPABASE_REST_URL}/student_grantees?${filter}&limit=1`, { headers });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                const s = rows[0];
                const rawPhone = s.mobile_number || s.contactNumber || s.phone_number || s.documents?.contactNumber || s.familyDetails?.contactNumber;
                return {
                    student_no: s.student_no || s.studentId,
                    uid: s.uid || s.id,
                    full_name: s.full_name || s.fullName,
                    rawPhone
                };
            }
        }
    } catch (_) {}

    // 2. Check user_fcm_tokens for mapped student_id
    if (isUuidString(cleanId)) {
        try {
            const fcmRes = await fetch(`${SUPABASE_REST_URL}/user_fcm_tokens?user_id=eq.${encodeURIComponent(cleanId)}&limit=1`, { headers });
            if (fcmRes.ok) {
                const tokens = await fcmRes.json();
                if (Array.isArray(tokens) && tokens.length > 0 && tokens[0].student_id) {
                    const stNo = tokens[0].student_id;
                    const res = await fetch(`${SUPABASE_REST_URL}/school_students?student_no=eq.${encodeURIComponent(stNo)}&limit=1`, { headers });
                    if (res.ok) {
                        const rows = await res.json();
                        if (rows.length > 0) {
                            return {
                                student_no: rows[0].student_no,
                                uid: cleanId,
                                full_name: rows[0].full_name,
                                rawPhone: rows[0].mobile_number
                            };
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // 3. Extract name from notification message (e.g. "Welcome, JARIOL, JUDE ESIDORE Z.! Your scholarship portal is ready...")
    if (notif && notif.message) {
        const welcomeMatch = notif.message.match(/Welcome,\s+([^!]+)!/i) ||
                             notif.message.match(/(?:Student\s+|grantee\s+|Dear\s+)([\w\s,.'-]+?)(?:!|\s+has|\s+updated|\s+submitted|\s+Your|\.|\$)/i);
        if (welcomeMatch && welcomeMatch[1]) {
            const extractedName = welcomeMatch[1].trim();

            // Search school_students by full_name
            try {
                const sRes = await fetch(`${SUPABASE_REST_URL}/school_students?full_name=ilike.%25${encodeURIComponent(extractedName)}%25&limit=1`, { headers });
                if (sRes.ok) {
                    const rows = await sRes.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        return {
                            student_no: rows[0].student_no,
                            uid: cleanId,
                            full_name: rows[0].full_name,
                            rawPhone: rows[0].mobile_number
                        };
                    }
                }
            } catch (_) {}

            // Search student_grantees by full_name
            try {
                const gRes = await fetch(`${SUPABASE_REST_URL}/student_grantees?or=(full_name.ilike.%25${encodeURIComponent(extractedName)}%25,fullName.ilike.%25${encodeURIComponent(extractedName)}%25)&limit=1`, { headers });
                if (gRes.ok) {
                    const rows = await gRes.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        return {
                            student_no: rows[0].student_no || rows[0].studentId,
                            uid: rows[0].uid || cleanId,
                            full_name: rows[0].full_name || rows[0].fullName,
                            rawPhone: rows[0].mobile_number || rows[0].contactNumber
                        };
                    }
                }
            } catch (_) {}
        }
    }

    // 4. Check school_students directly by cleanId (student_no, email, or id)
    try {
        let filter;
        if (isUuidString(cleanId)) {
            filter = `id=eq.${encodeURIComponent(cleanId)}`;
        } else if (cleanId.includes('@')) {
            filter = `email_address=eq.${encodeURIComponent(cleanId)}`;
        } else {
            filter = `student_no=eq.${encodeURIComponent(cleanId)}`;
        }

        const res = await fetch(`${SUPABASE_REST_URL}/school_students?${filter}&limit=1`, { headers });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                const s = rows[0];
                return {
                    student_no: s.student_no,
                    uid: s.id || cleanId,
                    full_name: s.full_name,
                    rawPhone: s.mobile_number
                };
            }
        }
    } catch (_) {}

    return null;
}

async function checkSmsAlreadySentRecently(recipientPhone, message) {
    if (!recipientPhone || !message) return false;
    try {
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const res = await fetch(
            `${SUPABASE_REST_URL}/sms_logs?recipient_phone=eq.${encodeURIComponent(recipientPhone)}&sent_at=gte.${encodeURIComponent(oneHourAgo)}&status=eq.sent&order=sent_at.desc&limit=5`,
            { headers }
        );
        if (res.ok) {
            const logs = await res.json();
            if (Array.isArray(logs)) {
                const normalizedTarget = message.trim().toLowerCase();
                for (const log of logs) {
                    if ((log.message || '').trim().toLowerCase() === normalizedTarget) {
                        return true;
                    }
                }
            }
        }
    } catch (_) {}
    return false;
}

let consecutivePollErrors = 0;

async function pollNotificationsAndSendSms() {
    if (isWatcherPolling) return;
    isWatcherPolling = true;

    try {
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        // Query the latest 30 notifications in Supabase with an 8-second timeout
        const res = await fetch(`${SUPABASE_REST_URL}/notifications?order=timestamp.desc&limit=30`, {
            headers,
            signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return;

        if (consecutivePollErrors > 0) {
            console.log('[SMS Watcher] Connection to Supabase restored.');
            consecutivePollErrors = 0;
        }

        const notifs = await res.json();
        if (!Array.isArray(notifs) || notifs.length === 0) return;

        for (const notif of notifs) {
            const notifId = String(notif.id || '');
            if (!notifId || processedNotificationIds.has(notifId)) continue;

            const targetStudentId = notif.studentId || notif.student_id;

            // Skip individual notification rows created as part of an announcement broadcast
            // (announcements already handle broadcast SMS directly via broadcastAnnouncementNotification)
            if (notif.announcementId) {
                processedNotificationIds.add(notifId);
                continue;
            }

            // Look up student details & registered phone number (or admin fallback)
            const studentInfo = await lookupStudentForNotification(targetStudentId, notif);
            if (!studentInfo || !studentInfo.rawPhone) {
                console.warn(`[SMS Watcher] Notification ${notifId}: Target ${targetStudentId} has no mobile number registered.`);
                processedNotificationIds.add(notifId);
                continue;
            }

            const normalizedPhone = normalizePhilippineMobile(studentInfo.rawPhone);
            if (!normalizedPhone) {
                console.warn(`[SMS Watcher] Notification ${notifId}: Invalid mobile number "${studentInfo.rawPhone}" for target ${targetStudentId}.`);
                processedNotificationIds.add(notifId);
                continue;
            }

            // Build SMS text identical in content to the notification
            let smsMessage = (notif.message || '').trim();
            const title = (notif.title || '').trim();
            if (title && !smsMessage.toLowerCase().includes(title.toLowerCase())) {
                smsMessage = `${title}: ${smsMessage}`;
            }
            if (!smsMessage.startsWith('[ScholarDoc]')) {
                smsMessage = `[ScholarDoc] ${smsMessage}`;
            }

            // Deduplication: verify if identical SMS was already dispatched recently
            const alreadySent = await checkSmsAlreadySentRecently(normalizedPhone, smsMessage);
            if (alreadySent) {
                console.log(`[SMS Watcher] Duplicate prevented for notification ${notifId} to ${normalizedPhone} (already logged in sms_logs).`);
                processedNotificationIds.add(notifId);
                continue;
            }

            console.log(`[SMS Watcher] Sending SMS for notification "${title}" -> ${studentInfo.full_name || targetStudentId} (${normalizedPhone})...`);

            const smsRes = await sendSemaphoreSms({
                numbers: normalizedPhone,
                message: smsMessage
            });

            // Record to sms_logs in Supabase
            await recordSmsLog({
                studentId: studentInfo.student_no || targetStudentId,
                granteeUid: studentInfo.uid,
                recipientPhone: normalizedPhone,
                message: smsMessage,
                eventType: notif.type || 'notification',
                status: smsRes.success ? 'sent' : 'failed',
                messageId: smsRes.message_id,
                network: smsRes.network,
                errorMessage: smsRes.error
            });

            if (smsRes.success) {
                console.log(`[SMS Watcher] Successfully sent SMS for notification ${notifId} to ${normalizedPhone}`);
            } else {
                console.error(`[SMS Watcher] Failed sending SMS for notification ${notifId}:`, smsRes.error);
            }

            processedNotificationIds.add(notifId);
            saveProcessedNotificationIds();

            // Delay 200ms between sends to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        saveProcessedNotificationIds();

    } catch (pollErr) {
        consecutivePollErrors++;
        // Only log once on first failure or occasionally on prolonged outage to avoid terminal spam
        if (consecutivePollErrors === 1) {
            console.warn(`[SMS Watcher] Temporary network issue reaching Supabase (${pollErr.message}). Waiting for connection...`);
        } else if (consecutivePollErrors % 20 === 0) {
            console.warn(`[SMS Watcher] Still waiting for network connection (${consecutivePollErrors} failed attempts)...`);
        }
    } finally {
        isWatcherPolling = false;
    }
}

async function startNotificationSmsWatcher() {
    loadProcessedNotificationIds();

    // Cache existing notifications on startup ONLY IF an SMS was already recorded for them
    try {
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };
        const res = await fetch(`${SUPABASE_REST_URL}/notifications?order=timestamp.desc&limit=100`, {
            headers,
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows)) {
                // Fetch recent successful SMS logs to know which notifications have already been delivered
                const smsLogsRes = await fetch(`${SUPABASE_REST_URL}/sms_logs?status=eq.sent&limit=200`, { headers });
                let existingSentSmsMessages = [];
                if (smsLogsRes.ok) {
                    const logs = await smsLogsRes.json();
                    if (Array.isArray(logs)) {
                        existingSentSmsMessages = logs.map(l => (l.message || '').trim().toLowerCase());
                    }
                }

                const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
                for (const row of rows) {
                    const notifId = String(row.id);
                    let rowMsg = (row.message || '').trim().toLowerCase();
                    const title = (row.title || '').trim().toLowerCase();
                    const isWelcome = title.includes('welcome') || rowMsg.includes('welcome');

                    const wasSent = existingSentSmsMessages.some(m => m.includes(rowMsg) || (title && m.includes(title)));
                    if (wasSent) {
                        processedNotificationIds.add(notifId);
                    } else if (isWelcome) {
                        // Ensure welcome notifications that have not been delivered via SMS are queued for delivery
                        processedNotificationIds.delete(notifId);
                    } else {
                        const rowTime = row.timestamp ? new Date(row.timestamp).getTime() : 0;
                        if (rowTime < fiveMinsAgo) {
                            processedNotificationIds.add(notifId);
                        }
                    }
                }
                saveProcessedNotificationIds();
            }
        }
    } catch (_) {}

    console.log(`[SMS Watcher] Notification-to-SMS watcher daemon started. Cached ${processedNotificationIds.size} processed IDs.`);

    // Run adaptive loop: 5s when healthy, 15s backoff during network outages
    function schedulePoll() {
        pollNotificationsAndSendSms().finally(() => {
            const delay = consecutivePollErrors > 0 ? 15000 : 5000;
            setTimeout(schedulePoll, delay);
        });
    }

    schedulePoll();
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ [ScholarDoc] Port ${PORT} is already in use!`);
        console.error(`   ScholarDoc is already running in another terminal window or background process.`);
        console.error(`   If you want to restart it:`);
        console.error(`     1. Press Ctrl+C in the terminal where it is running, OR`);
        console.error(`     2. Stop the process holding port ${PORT}.\n`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log('\n=======================================================');
        console.log(' 🎓 ScholarDoc Unified Web Platform');
        console.log(` Running at:          http://localhost:${PORT}`);
        console.log(` Landing Page:        http://localhost:${PORT}/`);
        console.log(` Unified Login:       http://localhost:${PORT}/login.html`);
        console.log(` Student Portal:      http://localhost:${PORT}/student_web/dashboard.html`);
        console.log(` Admin Portal:        http://localhost:${PORT}/admin_web/admin.html`);
        console.log(` Super Admin Portal:  http://localhost:${PORT}/superadmin_web/superadmin.html`);
        console.log('=======================================================\n');

        // Start background watcher daemon
        startNotificationSmsWatcher();
    });
}

module.exports = {
    verifyNameMatch,
    parseStickerText,
    verifyBirthdateMatch,
    verifyAtmProof,
    normalizeName,
    normalizeYear,
    normalizeSemester,
    isYearMatching,
    isSemesterMatching,
    validateGranteeEligibility,
    server
};

