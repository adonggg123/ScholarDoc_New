const fs = require('fs');
const JSZip = require('jszip');

async function checkHeaders() {
    for (const [name, file] of [['Form 2', 'assets/Annex 5-TES New Form 2.xlsx'], ['Form 3', 'assets/Annex 5-TES New Form 3.xlsx']]) {
        const zip = await JSZip.loadAsync(fs.readFileSync(file));
        const s = await zip.file('xl/worksheets/sheet1.xml').async('string');
        const ssXml = await zip.file('xl/sharedStrings.xml').async('string');
        const sst = [];
        const matches = ssXml.match(/<si>.*?<\/si>/gs) || [];
        matches.forEach(m => {
            const t = (m.match(/<t[^>]*>(.*?)<\/t>/) || [])[1] || '';
            sst.push(t);
        });

        console.log('=== ' + name + ' ===');
        const rows = s.match(/<row[^>]*>.*?<\/row>/gs) || [];
        rows.slice(0, 10).forEach(r => {
            const rNum = (r.match(/r="(\d+)"/) || [])[1];
            const cells = r.match(/<c[^>]*>.*?<\/c>/gs) || [];
            const cellVals = cells.map(c => {
                const ref = (c.match(/r="([A-Z0-9]+)"/) || [])[1];
                const t = (c.match(/t="([^"]+)"/) || [])[1];
                const v = (c.match(/<v>([^<]+)<\/v>/) || [])[1];
                let val = v;
                if (t === 's' && v !== undefined) val = sst[parseInt(v)];
                return ref + ': ' + val;
            });
            console.log('Row ' + rNum + ':', cellVals.join(' | '));
        });
    }
}
checkHeaders().catch(console.error);
