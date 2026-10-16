const fs = require('fs');
const JSZip = require('jszip');

async function checkAllStyles() {
    const data = fs.readFileSync('assets/Annex 5-TES New Form 3.xlsx');
    const zip = await JSZip.loadAsync(data);
    const stylesXml = await zip.file('xl/styles.xml').async('string');
    console.log(stylesXml);
}

checkAllStyles().catch(console.error);
