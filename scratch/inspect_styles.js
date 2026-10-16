const fs = require('fs');
const JSZip = require('jszip');

async function inspectStyles(filePath) {
    console.log(`\n=== STYLES FOR ${filePath} ===`);
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');

    // Parse fonts
    const fonts = (stylesXml.match(/<font>.*?<\/font>/gs) || []).map((f, i) => {
        const sz = (f.match(/<sz\s+val="([^"]+)"\/>/) || [])[1];
        const b = f.includes('<b/>');
        const name = (f.match(/<name\s+val="([^"]+)"\/>/) || [])[1];
        return { i, sz, b, name };
    });

    // Parse cellXfs
    const xfs = (stylesXml.match(/<xf\s+[^>]*>/g) || []).map((xf, i) => {
        const fontId = (xf.match(/fontId="([^"]+)"/) || [])[1];
        const applyAlignment = (xf.match(/applyAlignment="([^"]+)"/) || [])[1];
        return { i, fontId, xf };
    });

    console.log('Fonts:', fonts);

    // Let's check cellXfs with full tag (including inner alignment)
    const xfsFull = (stylesXml.match(/<xf\s+[^>]*>.*?<\/xf>|<xf\s+[^>]*\/>/gs) || []);
    console.log('Total xf:', xfsFull.length);

    // print style 36, 35, 300, 305, 125, etc.
    [34, 35, 36, 37, 38, 39, 125, 305].forEach(sIdx => {
        if (xfsFull[sIdx]) {
            console.log(`Style ${sIdx}:`, xfsFull[sIdx]);
            const fId = (xfsFull[sIdx].match(/fontId="([^"]+)"/) || [])[1];
            if (fId !== undefined && fonts[fId]) {
                console.log(`   Font ${fId}:`, fonts[fId]);
            }
        }
    });
}

async function run() {
    await inspectStyles('assets/Annex 5-TES New Form 3.xlsx');
    await inspectStyles('assets/Annex 5-TES New Form 2.xlsx');
}
run().catch(console.error);
