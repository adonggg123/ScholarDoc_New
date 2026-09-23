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
