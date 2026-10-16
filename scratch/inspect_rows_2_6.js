const fs = require('fs');
const JSZip = require('jszip');

async function main() {
    const zip = await JSZip.loadAsync(fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx'));
    const s = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const ssXml = await zip.file('xl/sharedStrings.xml').async('string');
    const sst = [];
    (ssXml.match(/<si>.*?<\/si>/gs) || []).forEach(m => {
        const t = (m.match(/<t[^>]*>(.*?)<\/t>/) || [])[1] || '';
        sst.push(t);
    });

    ['2', '3', '4', '5', '6'].forEach(rNum => {
        const rowMatch = s.match(new RegExp(`<row r="${rNum}"[^>]*>(.*?)<\\/row>`, 's'));
        if (rowMatch) {
            console.log(`--- Row ${rNum} ---`);
            const cells = rowMatch[1].match(/<c r="[A-Z0-9]+"[^>]*>(?:<v>[^<]*<\/v>)?<\/c>/g) || [];
            cells.forEach(c => {
                const r = (c.match(/r="([A-Z0-9]+)"/) || [])[1];
                const t = (c.match(/t="([^"]+)"/) || [])[1];
                const v = (c.match(/<v>([^<]*)<\/v>/) || [])[1];
                let val = v;
                if (t === 's' && v !== undefined) val = sst[parseInt(v)];
                console.log(`  ${r} (type=${t}, s=${(c.match(/s="(\d+)"/) || [])[1]}): ${val}`);
            });
        }
    });

    const merges = s.match(/<mergeCell[^>]*\/>/g) || [];
    console.log('--- Merges in rows 1-6 ---');
    merges.forEach(m => {
        if (/ref="[A-Z]+[1-6]:/.test(m)) console.log('  ', m);
    });
}

main().catch(console.error);
