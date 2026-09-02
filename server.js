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
        const loginFile = path.join(ROOT, 'admin_web', 'login.html');
        if (fs.existsSync(loginFile)) return loginFile;
    }

    // 2. Direct path resolution
    const directPath = path.join(ROOT, urlPath);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return directPath;
    }

    // 3. Fallback to admin_web
    const adminPath = path.join(ROOT, 'admin_web', urlPath);
    if (fs.existsSync(adminPath) && fs.statSync(adminPath).isFile()) {
        return adminPath;
    }

    // 4. Fallback to student_web
    const studentPath = path.join(ROOT, 'student_web', urlPath);
    if (fs.existsSync(studentPath) && fs.statSync(studentPath).isFile()) {
        return studentPath;
    }

    return null;
}

const server = http.createServer((req, res) => {
    // Parse URL and strip query string / hash
    let urlPath = req.url.split('?')[0].split('#')[0];

    // Normalize path
    try {
        urlPath = decodeURIComponent(urlPath);
    } catch (_) {}

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
    console.log(` Running at:       http://localhost:${PORT}`);
    console.log(` Landing Page:     http://localhost:${PORT}/`);
    console.log(` Unified Login:    http://localhost:${PORT}/login.html`);
    console.log(` Student Portal:   http://localhost:${PORT}/student_web/dashboard.html`);
    console.log(` Admin Portal:     http://localhost:${PORT}/admin_web/admin.html`);
    console.log('=======================================================\n');
});
