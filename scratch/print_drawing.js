const fs = require('fs');
const JSZip = require('jszip');

async function printFullDrawing() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const zip = await JSZip.loadAsync(data);
    const drawing1 = await zip.file('xl/drawings/drawing1.xml').async('string');
    console.log(drawing1);
}

printFullDrawing().catch(console.error);
