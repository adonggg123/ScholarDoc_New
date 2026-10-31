const fs = require('fs');

// --- 1. Update server.js ---
let serverCode = fs.readFileSync('server.js', 'utf8');

// Replace URLs declarations
const oldDecl = "const GRANTEE_EMAIL_DOWNLOAD_URL = 'https://scholar-doc-new.vercel.app/download';\r\nconst DIRECT_APK_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/latest/download/ScholarDoc.apk';";
const newDecl = "const GRANTEE_EMAIL_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk';\r\nconst GRANTEE_RELEASE_PAGE_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/tag/v1.0.1';\r\nconst DIRECT_APK_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk';";

if (serverCode.includes(oldDecl)) {
    serverCode = serverCode.replace(oldDecl, newDecl);
} else {
    serverCode = serverCode.replace(/const GRANTEE_EMAIL_DOWNLOAD_URL = '[^']+';/, "const GRANTEE_EMAIL_DOWNLOAD_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk';\r\nconst GRANTEE_RELEASE_PAGE_URL = 'https://github.com/adonggg123/ScholarDoc_New/releases/tag/v1.0.1';");
}

// Replace Email CTA HTML
const oldCtaSearch = /<div class="cta-box">[\s\S]*?<\/div>\s*<\/div>\s*<div class="instructions">/;
const newCtaBox = `<div class="cta-box">
          <h3>Get Started with ScholarDoc Mobile</h3>
          <p>Submit your scholarship documents (Certificate of Registration, School ID, and SA form) and track your stipend disbursement seamlessly on your mobile device.</p>
          <a href="\${grantee.downloadUrl}" class="btn-download" target="_blank">Download ScholarDoc App (v1.0.1 APK)</a>
          <div style="margin-top: 14px; font-size: 11.5px; color: #64748b; line-height: 1.6;">
            Direct APK download: <a href="https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk" style="color: #0F3260; font-weight: 700; word-break: break-all;">https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk</a>
            <br>
            <span style="color: #475569;">Release notes & details: <a href="https://github.com/adonggg123/ScholarDoc_New/releases/tag/v1.0.1" style="color: #0F3260; text-decoration: underline;">https://github.com/adonggg123/ScholarDoc_New/releases/tag/v1.0.1</a></span>
            <br>
            <span style="color: #475569;">Web installation guide: <a href="https://scholar-doc-new.vercel.app/download" style="color: #0F3260; text-decoration: underline;">https://scholar-doc-new.vercel.app/download</a></span>
          </div>
        </div>
        <div class="instructions">`;

serverCode = serverCode.replace(oldCtaSearch, newCtaBox);

// Replace plain text body
const oldPlainText = 'Please download the ScholarDoc mobile app to upload your documents and track your scholarship:\\n${GRANTEE_EMAIL_DOWNLOAD_URL}\\n\\nScholarDoc Scholarship Office';
const newPlainText = 'Please download the ScholarDoc mobile app (v1.0.1) to upload your documents and track your scholarship:\\nhttps://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk\\n\\nGitHub Release: https://github.com/adonggg123/ScholarDoc_New/releases/tag/v1.0.1\\nWeb Download Guide: https://scholar-doc-new.vercel.app/download\\n\\nScholarDoc Scholarship Office';

if (serverCode.includes(oldPlainText)) {
    serverCode = serverCode.replace(oldPlainText, newPlainText);
}

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log('Updated server.js successfully');

// --- 2. Update .env ---
if (fs.existsSync('.env')) {
    let env = fs.readFileSync('.env', 'utf8');
    env = env.replace(/APP_DOWNLOAD_URL=.*/, 'APP_DOWNLOAD_URL=https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk');
    fs.writeFileSync('.env', env, 'utf8');
    console.log('Updated .env successfully');
}

// --- 3. Update Supabase Edge Function ---
const funcFile = 'supabase/functions/send-grantee-notification/index.ts';
if (fs.existsSync(funcFile)) {
    let funcCode = fs.readFileSync(funcFile, 'utf8');
    funcCode = funcCode.replace(
        /const downloadUrl = Deno\.env\.get\("APP_DOWNLOAD_URL"\) \|\| "[^"]+";/,
        'const downloadUrl = Deno.env.get("APP_DOWNLOAD_URL") || "https://github.com/adonggg123/ScholarDoc_New/releases/download/v1.0.1/ScholarDoc.apk";'
    );
    fs.writeFileSync(funcFile, funcCode, 'utf8');
    console.log('Updated edge function successfully');
}

