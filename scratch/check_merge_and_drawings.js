const fs = require('fs');
const JSZip = require('jszip');

async function checkMerge() {
    for (const [name, file] of [['Form 2', 'assets/Annex 5-TES New Form 2.xlsx'], ['Form 3', 'assets/Annex 5-TES New Form 3.xlsx']]) {
        const zip = await JSZip.loadAsync(fs.readFileSync(file));
        const s = await zip.file('xl/worksheets/sheet1.xml').async('string');
        const mc = s.match(/<mergeCell[^>]*\/>/g) || [];
        console.log('=== ' + name + ' mergeCells in rows 1-10 ===');
        mc.filter(m => {
            const ref = (m.match(/ref="([^"]+)"/) || [])[1];
            const startRow = parseInt(ref.match(/\d+/)[0]);
            return startRow <= 10;
        }).forEach(m => console.log(m));
    }
}
checkMerge().catch(console.error);
