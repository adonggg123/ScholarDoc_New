const fs = require('fs');
const JSZip = require('jszip');

async function checkCols() {
    const f2 = fs.readFileSync('assets/Annex 5-TES New Form 2.xlsx');
    const f3 = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');

    const zip2 = await JSZip.loadAsync(f2);
    const zip3 = await JSZip.loadAsync(f3);

    const sheet2 = await zip2.file('xl/worksheets/sheet1.xml').async('string');
    const sheet3 = await zip3.file('xl/worksheets/sheet1.xml').async('string');

    console.log('=== FORM 2 COLS ===');
    const cols2 = sheet2.match(/<cols>.*?<\/cols>/s);
    console.log(cols2 ? cols2[0] : 'None');

    console.log('\n=== FORM 3 COLS ===');
    const cols3 = sheet3.match(/<cols>.*?<\/cols>/s);
    console.log(cols3 ? cols3[0] : 'None');
}

checkCols().catch(console.error);
