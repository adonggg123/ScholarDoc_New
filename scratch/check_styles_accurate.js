const fs = require('fs');
const JSZip = require('jszip');

async function checkStylesAccurate(filePath) {
    console.log(`\n=== STYLES FOR ${filePath} ===`);
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');
    const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
    if (!cellXfsMatch) return;

    // Use regex to find all <xf .../> or <xf ...>...</xf>
    const xfs = [];
    const re = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g;
    let m;
    while ((m = re.exec(cellXfsMatch[1])) !== null) {
        xfs.push({ attrs: m[1], inner: m[2] || '' });
    }

    console.log('Total cellXfs:', xfs.length);
    xfs.forEach((xf, i) => {
        if (i >= 30 && i <= 42) {
            console.log(`[${i}] attrs: ${xf.attrs} | inner: ${xf.inner}`);
        }
    });

    // Check font definitions
    const fontRe = /<font\b[\s\S]*?<\/font>/g;
    const fonts = [];
    while ((m = fontRe.exec(stylesXml)) !== null) {
        fonts.push(m[0]);
    }
    console.log('Total fonts:', fonts.length);
    fonts.forEach((f, i) => console.log(`Font [${i}]: ${f}`));
}

checkStylesAccurate('assets/Annex 5-TES New Form 3.xlsx').catch(console.error);
