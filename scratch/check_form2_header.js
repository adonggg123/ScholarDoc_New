const fs = require('fs');
const JSZip = require('jszip');

async function checkForm2Header() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');

    // Parse cellXfs
    const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
    const xfs = [];
    const re = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g;
    let m;
    while ((m = re.exec(cellXfsMatch[1])) !== null) {
        xfs.push({ attrs: m[1], inner: m[2] || '' });
    }

    // Parse fonts
    const fonts = [];
    const fre = /<font\b[\s\S]*?<\/font>/g;
    while ((m = fre.exec(stylesXml)) !== null) {
        fonts.push(m[0]);
    }

    console.log('Form 2 - B8 Style [125]:');
    console.log('attrs:', xfs[125].attrs);
    console.log('inner:', xfs[125].inner);
    const fId = (xfs[125].attrs.match(/fontId="([^"]+)"/) || [])[1];
    console.log('fontId:', fId, '->', fonts[fId]);

    console.log('\nForm 2 - B10 Style [122]:');
    console.log('attrs:', xfs[122].attrs);
    console.log('inner:', xfs[122].inner);
    const fId10 = (xfs[122].attrs.match(/fontId="([^"]+)"/) || [])[1];
    console.log('fontId:', fId10, '->', fonts[fId10]);
}

checkForm2Header().catch(console.error);
