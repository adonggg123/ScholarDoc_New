const fs = require('fs');
const JSZip = require('jszip');

async function main() {
    const orig = await JSZip.loadAsync(fs.readFileSync('scratch/Annex 5-TES New Form 3.original.xlsx'));
    const s = await orig.file('xl/worksheets/sheet1.xml').async('string');
    const styles = await orig.file('xl/styles.xml').async('string');
    const r2 = s.match(/<row r="2"[^>]*>(.*?)<\/row>/s)[1];
    console.log('Orig row 2:', r2);
    const m = s.match(/<mergeCell ref="[A-Z0-9:]+"[^>]*\/>/g);
    console.log('Orig merges in row 2-3:', m ? m.filter(x => x.includes('2') || x.includes('3')) : []);
}
main().catch(console.error);
