const fs = require('fs');
const JSZip = require('jszip');

async function findBordersInForm3() {
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

    console.log('Total xfs in Form 3:', xfs.length);
    xfs.forEach((xf, i) => {
        const borderId = (xf.attrs.match(/borderId="([^"]+)"/) || [])[1];
        if (borderId === '1' || borderId === '2' || borderId === '3' || borderId === '4') {
            console.log(`[${i}] border=${borderId} | inner=${xf.inner} | attrs=${xf.attrs}`);
        }
    });
}

findBordersInForm3().catch(console.error);
