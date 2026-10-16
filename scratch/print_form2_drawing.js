const fs = require('fs');
const JSZip = require('jszip');

async function main() {
    const zip2 = await JSZip.loadAsync(fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx'));
    const d1 = await zip2.file('xl/drawings/drawing1.xml').async('string');
    const rels = await zip2.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
    console.log('=== drawing1.xml.rels ===');
    console.log(rels);
    console.log('\n=== drawing1.xml ===');
    console.log(d1);
}
main().catch(console.error);
