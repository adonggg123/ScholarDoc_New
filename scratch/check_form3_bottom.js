const fs = require('fs');
const JSZip = require('jszip');

async function checkForm3Bottom() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');
    const zip = await JSZip.loadAsync(data);
    const sstXml = await zip.file('xl/sharedStrings.xml').async('string');
    const str = (sstXml.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const rRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    let m;
    while ((m = rRegex.exec(sheetXml)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum >= 34 && rNum <= 55) {
            const cells = [];
            const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
            let cm;
            while ((cm = cRegex.exec(m[3])) !== null) {
                let val = cm[4];
                if (cm[3] === 's') val = `"${str[parseInt(val, 10)]}"`;
                if (val !== undefined) cells.push(`${cm[1]}=${val}`);
            }
            console.log(`Row ${rNum} [${m[2]}]: ${cells.join(', ')}`);
        }
    }
}

checkForm3Bottom().catch(console.error);
