const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Active academic term settings
let activeAcademicYear = '2026-2027';
let activeSemester = '1st Semester';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyDKFEf2kVwuCGQQYaeBtsMaeDZiA0sXv_E';

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

    let cleaned = text.replace(/\b2[oO]2/g, '202');

    // 1. Extract Academic Year with priority
    let detectedYear = null;
    const explicitAyRegex = /(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year)\s*[:\.\-]?\s*)(20\d{2})\s*[\u2013\u2014\u2212\-/–—~\.\s]+\s*(20\d{2}|\d{2})\b/gi;
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

    if (!detectedYear) {
        const rangeRegex = /\b(202[0-9]|203[0-5])\s*[\u2013\u2014\u2212\-/–—~]\s*(202[0-9]|203[0-5]|\d{2})\b/g;
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

    if (!detectedYear) {
        const singleAyRegex = /(?:(?:A\.?\s*[YV]\.?|S\.?\s*[YV]\.?|Academic\s*Year|School\s*Year)\s*[:\.\-]?\s*)(202[0-9]|203[0-5])\b/i;
        const singleMatch = cleaned.match(singleAyRegex);
        if (singleMatch) {
            const y = parseInt(singleMatch[1], 10);
            detectedYear = `${y}-${y + 1}`;
        }
    }

    // 2. Extract Semester
    let detectedSem = null;
    const lines = cleaned.split(/[\r\n]+/);

    function checkSem(s) {
        const is2nd = /\b(?:2\s*nd|2\s*rd|second|2[\*+]|2)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev)?)?\b/i.test(s) ||
            /\bsem(?:est(?:er|el|r|ev)?)?\s*[\.\-:\/]?\s*2\b/i.test(s) ||
            /\b2\s*[\/\-]\s*sem\b/i.test(s) ||
            /\b2nd\s+semester\b/i.test(s) ||
            /\bsecond\s+semester\b/i.test(s) ||
            s.includes('2* semester') || s.includes('2* sem');
        if (is2nd) return '2nd Semester';

        const is1st = /\b(?:1\s*st|1\s*sl|1\s*si|first|[il]\s*st|1[\*+]|1)\s*[\.\-]?\s*sem(?:est(?:er|el|r|ev)?)?\b/i.test(s) ||
            /\bsem(?:est(?:er|el|r|ev)?)?\s*[\.\-:\/]?\s*1\b/i.test(s) ||
            /\b1\s*[\/\-]\s*sem\b/i.test(s) ||
            /\b1st\s+semester\b/i.test(s) ||
            /\bfirst\s+semester\b/i.test(s) ||
            /\b[il]st\s+sem(?:ester)?\b/i.test(s) ||
            s.includes('1* semester') || s.includes('1* sem');
        if (is1st) return '1st Semester';

        if (/\b(?:summer|mid\s*[\-]?year)\b/i.test(s)) {
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

    const hasValidationStamp = /\bVALIDATED\b/i.test(text) || /\bRegistrar\b/i.test(text) || /\bUSTP\b/i.test(text);
    const yearMatches = detectedYear === currentYear;
    const semMatches = detectedSem === currentSem;
    const isValid = yearMatches && semMatches;

    let message = `Validation sticker verified! Matches active school period (AY ${currentYear} • ${currentSem}).`;
    if (!detectedYear && !detectedSem) {
        message = 'Could not detect an academic year or semester validation sticker on ID.';
    } else if (!yearMatches || !semMatches) {
        const issues = [];
        if (!yearMatches) issues.push(`Year mismatch (Detected: ${detectedYear || 'None'}, Required: ${currentYear})`);
        if (!semMatches) issues.push(`Semester mismatch (Detected: ${detectedSem || 'None'}, Required: ${currentSem})`);
        message = `Validation sticker does not match current period: ${issues.join(' and ')}.`;
    }

    return {
        stickerFound: !!(detectedYear || detectedSem || hasValidationStamp),
        isValid,
        yearMatches,
        semesterMatches,
        academicYear: detectedYear,
        semester: detectedSem,
        hasValidationStamp,
        currentYear,
        currentSem,
        message,
        rawText
    };
}

const https = require('https');

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

    const smsMessage = `[ScholarDoc] Congratulations ${fullName}! You are confirmed as an official ${scholarshipName} grantee. Download the app at ${APP_DOWNLOAD_URL} to upload documents and track your stipend.`;

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

    let message = customMessage;
    if (title && message && !message.includes(title)) {
        message = `[ScholarDoc] ${title}: ${message}`;
    } else if (message && !message.startsWith('[ScholarDoc]')) {
        message = `[ScholarDoc] ${message}`;
    }

    if (!message) {
        switch (eventType) {
            case 'grantee_confirmed':
                message = `[ScholarDoc] Application Approved: Congratulations ${studentName}! You are confirmed as a ${scholarshipName} grantee. Download the app at ${APP_DOWNLOAD_URL} to upload documents and track your stipend.`;
                break;
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

async function broadcastAnnouncementNotification({ announcementId, title, content, type, forceResend, sendSms = false }) {
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

    // 6. Broadcast SMS via Semaphore if sendSms is enabled
    let smsSentCount = 0;
    let smsFailedCount = 0;
    if (sendSms) {
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
                        const cleanT = (title || 'ScholarDoc Alert').trim().slice(0, 35);
                        const cleanM = (shortMessage || 'New announcement posted.').trim().slice(0, 85);
                        const annSmsText = `[ScholarDoc] ${cleanT}: ${cleanM} Open the app for details.`;

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

    // ── API: Google Document AI Sticker Scanner ──────────────────────────
    if (urlPath === '/api/document-ai/scan-sticker' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const base64Image = parsed.image;

                if (!base64Image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No image provided' }));
                    return;
                }

                // Call Google Cloud Vision DOCUMENT_TEXT_DETECTION
                const visionPayload = JSON.stringify({
                    requests: [{
                        image: { content: base64Image },
                        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                    }]
                });

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
                            }
                        } catch (_) {}

                        if (!extractedText) {
                            extractedText = await callOcrSpace(base64Image);
                            if (extractedText) {
                                engine = 'High-Accuracy Document OCR via ScholarDoc Server';
                            }
                        }

                        const parsedSticker = parseStickerText(extractedText);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            ...parsedSticker,
                            engine
                        }));
                    });
                });

                visionReq.on('error', async (err) => {
                    console.error('Vision API error:', err.message);
                    const ocrText = await callOcrSpace(base64Image);
                    const parsedSticker = parseStickerText(ocrText);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...parsedSticker,
                        engine: ocrText ? 'High-Accuracy Document OCR via ScholarDoc Server' : 'Fallback Engine',
                        warning: err.message
                    }));
                });

                visionReq.write(visionPayload);
                visionReq.end();

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
});
