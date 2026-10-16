const fs = require('fs');
const JSZip = require('jszip');

async function inspectAllXfs(filePath) {
    console.log(`\n=== CELL XFS FOR ${filePath} ===`);
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');
    const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
    if (!cellXfsMatch) {
        console.log('No cellXfs found');
        return;
    }
    const xfs = cellXfsMatch[1].match(/<xf\s+[^>]*>.*?<\/xf>|<xf\s+[^>]*\/>/gs) || [];
    console.log(`Found ${xfs.length} cellXfs`);
    xfs.forEach((xf, i) => console.log(`[${i}] ${xf}`));
}

inspectAllXfs('assets/Annex 5-TES New Form 3.xlsx').catch(console.error);
