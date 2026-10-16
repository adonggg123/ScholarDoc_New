const fs = require('fs');
const JSZip = require('jszip');

async function checkStyles14And9() {
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

    const fonts = [];
    const fre = /<font\b[\s\S]*?<\/font>/g;
    while ((m = fre.exec(stylesXml)) !== null) {
        fonts.push(m[0]);
    }

    [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].forEach(i => {
        if (xfs[i]) {
            const fId = (xfs[i].attrs.match(/fontId="([^"]+)"/) || [])[1];
            console.log(`Style [${i}]: attrs=${xfs[i].attrs} | inner=${xfs[i].inner} | font=${fonts[fId]}`);
        }
    });
}

checkStyles14And9().catch(console.error);
