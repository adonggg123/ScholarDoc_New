const fs = require('fs');
const JSZip = require('jszip');

async function compareForm2And3() {
    const f2Data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const f3Data = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');

    const zip2 = await JSZip.loadAsync(f2Data);
    const zip3 = await JSZip.loadAsync(f3Data);

    const sst2 = await zip2.file('xl/sharedStrings.xml').async('string');
    const sst3 = await zip3.file('xl/sharedStrings.xml').async('string');

    const str2 = (sst2.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));
    const str3 = (sst3.match(/<si>(.*?)<\/si>/gs) || []).map(si => (si.match(/<t[^>]*>(.*?)<\/t>/gs) || []).map(t => t.replace(/<[^>]+>/g, '')).join(''));

    const sheet2 = await zip2.file('xl/worksheets/sheet1.xml').async('string');
    const sheet3 = await zip3.file('xl/worksheets/sheet1.xml').async('string');

    console.log('=== FORM 2 MERGE CELLS ===');
    const mc2 = sheet2.match(/<mergeCell\s+ref="([^"]+)"\/>/g) || [];
    mc2.forEach(m => console.log(' ', m));

    console.log('\n=== FORM 3 MERGE CELLS ===');
    const mc3 = sheet3.match(/<mergeCell\s+ref="([^"]+)"\/>/g) || [];
    mc3.forEach(m => console.log(' ', m));

    console.log('\n=== FORM 2 ROWS 1-35 ===');
    const rRegex = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    let m;
    while ((m = rRegex.exec(sheet2)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum <= 35) {
            const rowAttrs = m[2];
            const content = m[3];
            const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
            let cm;
            const cells = [];
            while ((cm = cRegex.exec(content)) !== null) {
                let val = cm[4];
                if (cm[3] === 's') val = `"${str2[parseInt(val, 10)]}"`;
                cells.push(`${cm[1]}=${val}`);
            }
            console.log(`R${rNum} [${rowAttrs}]: ${cells.join(', ')}`);
        }
    }

    console.log('\n=== FORM 3 ROWS 1-35 ===');
    const rRegex3 = /<row\s+r="(\d+)"([^>]*)>(.*?)<\/row>/gs;
    while ((m = rRegex3.exec(sheet3)) !== null) {
        const rNum = parseInt(m[1], 10);
        if (rNum <= 35) {
            const rowAttrs = m[2];
            const content = m[3];
            const cRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="([^"]*)")?(?:\s+t="([^"]*)")?>(?:<v>([^<]*)<\/v>)?<\/c>/g;
            let cm;
            const cells = [];
            while ((cm = cRegex.exec(content)) !== null) {
                let val = cm[4];
                if (cm[3] === 's') val = `"${str3[parseInt(val, 10)]}"`;
                cells.push(`${cm[1]}=${val}`);
            }
            console.log(`R${rNum} [${rowAttrs}]: ${cells.join(', ')}`);
        }
    }
}

compareForm2And3().catch(console.error);
