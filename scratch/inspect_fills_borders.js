const fs = require('fs');
const JSZip = require('jszip');

async function inspectFillsAndBorders() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');

    console.log('--- FILLS ---');
    const fills = stylesXml.match(/<fill>.*?<\/fill>/gs) || [];
    fills.forEach((f, i) => console.log(`Fill [${i}]: ${f}`));

    console.log('\n--- BORDERS ---');
    const borders = stylesXml.match(/<border>.*?<\/border>|<border\/>/gs) || [];
    borders.forEach((b, i) => console.log(`Border [${i}]: ${b}`));

    // Also check row 7 and row 8 in sheet1.xml
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const r7 = sheetXml.match(/<row r="7"[^>]*>.*?<\/row>/s);
    const r8 = sheetXml.match(/<row r="8"[^>]*>.*?<\/row>/s);
    console.log('\nRow 7 XML:', r7 ? r7[0] : 'not found');
    console.log('\nRow 8 XML:', r8 ? r8[0] : 'not found');
}

inspectFillsAndBorders().catch(console.error);
