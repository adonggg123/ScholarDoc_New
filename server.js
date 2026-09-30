const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function broadcastAnnouncementNotification({ announcementId, title, content, type, forceResend }) {
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

    console.log(`[Push Notification] Broadcast complete. Devices reached: ${pushSentCount}/${tokens.length}. In-app history created for ${notificationHistoryCount} student(s).`);

    return {
        success: true,
        tokensCount: tokens.length,
        notificationHistoryCount,
        pushSentCount,
        message: `Notification broadcasted to ${tokens.length} device(s) and recorded in student notification histories.`
    };
}

const server = http.createServer((req, res) => {
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
