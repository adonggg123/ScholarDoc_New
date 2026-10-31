const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Add download route in findFilePath
if (!content.includes("urlPath === '/download'")) {
    const target = "if (urlPath === '/otp' || urlPath === '/otp.html') {";
    const addition = "if (urlPath === '/download' || urlPath === '/download.html') {\r\n        const downloadFile = path.join(ROOT, 'student_web', 'download.html');\r\n        if (fs.existsSync(downloadFile)) return downloadFile;\r\n    }\r\n\r\n    " + target;
    content = content.replace(target, addition);
}

// 2. Set GRANTEE_EMAIL_DOWNLOAD_URL
const oldUrlDecl = "const GRANTEE_EMAIL_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/latest/download/ScholarDoc.apk';";
const newUrlDecl = "const GRANTEE_EMAIL_DOWNLOAD_URL = 'https://scholar-doc-new.vercel.app/download';\r\nconst DIRECT_APK_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/latest/download/ScholarDoc.apk';";
if (content.includes(oldUrlDecl)) {
    content = content.replace(oldUrlDecl, newUrlDecl);
}

// 3. Update CTA Box in email template to include both links
const targetCta = 'Direct link: <a href="${grantee.downloadUrl}" style="color: #0F3260; word-break: break-all;">${grantee.downloadUrl}</a>';
const replacementCta = 'Direct download page: <a href="${grantee.downloadUrl}" style="color: #0F3260; font-weight: 700; word-break: break-all;">${grantee.downloadUrl}</a>\r\n            <br><span style="color: #64748b; font-size: 11px;">Direct APK link: <a href="https://github.com/adonggg123/ScholarDoc_New/releases/latest/download/ScholarDoc.apk" style="color: #0F3260; text-decoration: underline;">Download ScholarDoc.apk directly</a></span>';

if (content.includes(targetCta)) {
    content = content.replace(targetCta, replacementCta);
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('Successfully updated server.js');

