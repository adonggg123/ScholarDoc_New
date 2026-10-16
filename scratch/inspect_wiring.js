const fs = require('fs');
const JSZip = require('jszip');

async function inspectForm2Wiring() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const zip = await JSZip.loadAsync(data);

    const ct = await zip.file('[Content_Types].xml').async('string');
    console.log('--- [Content_Types].xml ---');
    console.log(ct);

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    console.log('\n--- drawing in sheet1.xml ---');
    const drawingMatch = sheetXml.match(/<drawing[^>]*\/>/);
    console.log(drawingMatch ? drawingMatch[0] : 'None');
    // Also show surrounding tags
    const endPart = sheetXml.slice(sheetXml.lastIndexOf('<pageMargins'));
    console.log('\nEnd of sheet1.xml:');
    console.log(endPart);

    const sheetRels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
    console.log('\n--- xl/worksheets/_rels/sheet1.xml.rels ---');
    console.log(sheetRels);
}

inspectForm2Wiring().catch(console.error);
