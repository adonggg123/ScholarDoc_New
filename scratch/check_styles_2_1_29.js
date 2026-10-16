const fs = require('fs');
const JSZip = require('jszip');

async function checkStyles2_1_29() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');

    const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s);
    const xfs = [];
    const re = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g;
    let m;
    while ((m = re.exec(cellXfsMatch[1])) !== null) {
        xfs.push({ attrs: m[1], inner: m[2] || '' });
    }

    [1, 2, 3, 13, 29, 32, 35, 36].forEach(i => {
        console.log(`Style [${i}]: attrs=${xfs[i] ? xfs[i].attrs : 'none'} | inner=${xfs[i] ? xfs[i].inner : 'none'}`);
    });
}

checkStyles2_1_29().catch(console.error);
