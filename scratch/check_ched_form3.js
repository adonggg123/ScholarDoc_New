const fs = require('fs');
const JSZip = require('jszip');

async function checkCHEDForm3() {
    const data = fs.readFileSync('assets/0_Annex_5_TES_New_Billing_Form.xlsx');
    const zip = await JSZip.loadAsync(data);
    const sstXml = await zip.file('xl/sharedStrings.xml').async('string');
    const str = (sstXml.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
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

    const sheet3Xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
    const rRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    while ((m = rRegex.exec(sheet3Xml)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum >= 7 && rNum <= 12) {
            console.log(`\nRow ${rNum}: ${m[2]}`);
            const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
            let cm;
            while ((cm = cRegex.exec(m[3])) !== null) {
                let val = cm[4];
                if (cm[3] === 's') val = `"${str[parseInt(val, 10)]}"`;
                const sIdx = parseInt(cm[2] || '0', 10);
                const xf = xfs[sIdx];
                const fId = (xf && xf.attrs.match(/fontId="([^"]+)"/) || [])[1];
                const font = fonts[fId];
                console.log(`  ${cm[1]} (s=${sIdx}): val=${val} | align=${xf ? xf.inner : ''} | font=${font}`);
            }
        }
    }

    console.log('\nMergeCells in sheet3 (rows 7-12):');
    const mc = sheet3Xml.match(/<mergeCell\s+ref="([^"]+)"\/>/g) || [];
    mc.filter(m => /([7-9]|1[0-2])/.test(m)).forEach(m => console.log(' ', m));
}

checkCHEDForm3().catch(console.error);
